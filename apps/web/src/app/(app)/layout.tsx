import Link from "next/link";
import { redirect } from "next/navigation";

import { EnsureActiveOrg } from "@/components/app/ensure-active-org";
import { MobileNav } from "@/components/app/mobile-nav";
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
    <div className="app-shell">
        <EnsureActiveOrg
          desiredId={active.id}
          sessionActiveId={session.activeOrganizationId}
        />

        <aside className="app-sidebar">
          <Link href="/dashboard" className="app-wordmark">
            ZenBuild
          </Link>
          <div className="px-1 pb-3">
            <OrgSwitcher organizations={organizations} activeOrgId={active.id} />
          </div>
          <SidebarNav />
          <div className="app-sidebar-foot">
            {active.role === "owner" || active.role === "admin"
              ? "Workspace admin"
              : "Member"}
          </div>
        </aside>

        <div className="app-main">
          <header className="app-topbar">
            <div className="flex items-center gap-2 md:hidden">
              <MobileNav />
              <OrgSwitcher organizations={organizations} activeOrgId={active.id} />
            </div>
            <div className="ml-auto">
              <UserMenu user={me} />
            </div>
          </header>
          <main className="app-content">
            <div className="app-content-inner">{children}</div>
          </main>
        </div>
    </div>
  );
}
