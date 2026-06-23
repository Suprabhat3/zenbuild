import Link from "next/link";
import { redirect } from "next/navigation";

import { EnsureActiveOrg } from "@/components/app/ensure-active-org";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { UserMenu } from "@/components/app/user-menu";
import { requireSession } from "@/server/auth";
import { api } from "@/trpc/server";

/**
 * Authenticated application shell: fixed sidebar (workspace switcher + nav) and
 * a top bar with the user menu. Guards the whole `(app)` segment — unauthorized
 * requests are redirected to sign-in.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const [me, organizations] = await Promise.all([
    api.viewer.me(),
    api.viewer.organizations(),
  ]);

  // No workspace at all → the user hasn't finished onboarding yet.
  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  // Resolve the active workspace from the session, falling back to the first
  // membership if the session pointer is stale.
  const active =
    organizations.find((o) => o.id === session.activeOrganizationId) ??
    organizations[0];

  return (
    <div className="bg-background flex min-h-svh">
      <EnsureActiveOrg
        desiredId={active.id}
        sessionActiveId={session.activeOrganizationId}
      />

      <aside className="bg-muted/20 hidden w-64 shrink-0 flex-col border-r p-3 md:flex">
        <div className="px-1 pb-3">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            ZenBuild
          </Link>
        </div>
        <div className="pb-3">
          <OrgSwitcher organizations={organizations} activeOrgId={active.id} />
        </div>
        <SidebarNav />
        <div className="text-muted-foreground mt-auto px-1 pt-3 text-xs">
          {active.role === "owner" || active.role === "admin"
            ? "Workspace admin"
            : "Member"}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4 md:px-6">
          <div className="md:hidden">
            <OrgSwitcher organizations={organizations} activeOrgId={active.id} />
          </div>
          <div className="ml-auto">
            <UserMenu user={me} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
