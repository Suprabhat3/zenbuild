import { TRPCError } from "@trpc/server";

import { createTRPCRouter, orgProcedure, protectedProcedure } from "../trpc";

/**
 * Read-only router backing the authenticated app shell. Mutations that touch the
 * session/cookie (sign in/out, create/switch org, invites) go through the
 * BetterAuth client on the browser; this router exposes the org-isolated *reads*
 * the shell needs (current user, the user's workspaces, the active workspace).
 */
export const viewerRouter = createTRPCRouter({
  /** The current authenticated user. */
  me: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      image: ctx.user.image ?? null,
    };
  }),

  /**
   * Every workspace the user belongs to, with their role and a lightweight
   * member count. Powers the org switcher.
   */
  organizations: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.member.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "asc" },
      include: {
        organization: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logo: m.organization.logo,
      role: m.role,
      memberCount: m.organization._count.members,
    }));
  }),

  /**
   * The active workspace plus the caller's role and subscription summary. Null
   * activeOrganizationId surfaces as a FORBIDDEN via `orgProcedure`, so a missing
   * active org is handled upstream by the shell (which prompts to create one).
   */
  activeOrganization: orgProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUnique({
      where: { id: ctx.organizationId },
      include: {
        subscription: true,
        _count: { select: { members: true, projects: true } },
      },
    });

    if (!org) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Active organization not found.",
      });
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      role: ctx.role,
      memberCount: org._count.members,
      projectCount: org._count.projects,
      subscription: org.subscription
        ? {
            plan: org.subscription.plan,
            status: org.subscription.status,
            reviewCreditsTotal: org.subscription.reviewCreditsTotal,
            reviewCreditsUsed: org.subscription.reviewCreditsUsed,
          }
        : null,
    };
  }),
});
