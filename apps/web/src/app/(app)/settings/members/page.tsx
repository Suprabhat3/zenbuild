import type { Metadata } from "next";

import { MembersManager } from "@/components/app/members-manager";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Members · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [org, members, invitations] = await Promise.all([
    api.viewer.activeOrganization(),
    api.member.list(),
    api.member.pendingInvitations(),
  ]);

  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <MembersManager
      organizationId={org.id}
      canManage={canManage}
      members={members.map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        isSelf: m.isSelf,
        user: m.user,
      }))}
      invitations={invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        invitedBy: inv.invitedBy,
      }))}
    />
  );
}
