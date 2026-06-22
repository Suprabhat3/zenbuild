import { createTRPCRouter, orgProcedure } from "../trpc";

/**
 * Read-only views of the active workspace's members and pending invitations.
 * Membership mutations (invite / update role / remove / cancel) are performed
 * through the BetterAuth organization client on the browser, which enforces the
 * plugin's role-based access control. These queries are org-isolated by
 * `orgProcedure` (scoped to `ctx.organizationId`).
 */
export const memberRouter = createTRPCRouter({
  list: orgProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.member.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      isSelf: m.userId === ctx.user.id,
      user: m.user,
    }));
  }),

  pendingInvitations: orgProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.db.invitation.findMany({
      where: { organizationId: ctx.organizationId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        inviter: { select: { name: true, email: true } },
      },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      invitedBy: inv.inviter.name || inv.inviter.email,
    }));
  }),
});
