import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? z.flattenError(error.cause)
            : null,
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
  const organizationId = ctx.session.activeOrganizationId;
  if (!organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization selected.",
    });
  }

  const membership = await ctx.db.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: ctx.session.user.id,
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of the active organization.",
    });
  }

  return next({
    ctx: {
      organizationId,
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
