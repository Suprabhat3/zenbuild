import { initTRPC, TRPCError } from "@trpc/server";
import { InsufficientCreditsError, PlanLimitError } from "@zenbuild/billing";
import superjson from "superjson";
import { z, ZodError } from "zod";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    // Structured billing upsell: lets the client distinguish "out of credits" /
    // "plan limit" from generic FORBIDDEN and render an upgrade CTA.
    const billingError =
      cause instanceof InsufficientCreditsError
        ? {
            type: "INSUFFICIENT_CREDITS" as const,
            plan: cause.plan,
            remaining: cause.remaining,
            required: cause.required,
          }
        : cause instanceof PlanLimitError
          ? { type: "PLAN_LIMIT" as const, plan: cause.plan, kind: cause.kind }
          : null;

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? z.flattenError(error.cause)
            : null,
        billingError,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const mergeRouters = t.mergeRouters;

/** Public — no auth required. */
export const publicProcedure = t.procedure;

/** Requires an authenticated session. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // narrow session to non-null for downstream procedures
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

/**
 * Requires an authenticated session AND an active organization the user is a
 * member of. Enforces tenant isolation: every org-scoped query/mutation runs
 * through this, and `ctx.organizationId` is the trusted scope for all DB access.
 */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const activeId = ctx.session.activeOrganizationId;

  let membership = activeId
    ? await ctx.db.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: activeId,
            userId: ctx.session.user.id,
          },
        },
      })
    : null;

  // The session pointer can be null or stale (e.g. a session created before
  // onboarding finished, or the user was removed from that org). Fall back to
  // the user's first membership — the same rule the session-create hook and the
  // app shell use — instead of failing every org-scoped call until the client
  // manages to call `organization.setActive`.
  if (!membership) {
    membership = await ctx.db.member.findFirst({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization selected.",
    });
  }

  return next({
    ctx: {
      organizationId: membership.organizationId,
      membership,
      role: membership.role,
    },
  });
});

/** Helper to gate a procedure to specific org roles. */
export function requireRole(...roles: string[]) {
  return orgProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires role: ${roles.join(" or ")}.`,
      });
    }
    return next();
  });
}
