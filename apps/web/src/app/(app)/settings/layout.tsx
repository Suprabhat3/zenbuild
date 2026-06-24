import { SettingsNav } from "@/components/app/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="app-page-header">
        <span className="app-eyebrow">Workspace</span>
        <div className="app-page-header-row">
          <div>
            <h1 className="app-page-title">Settings</h1>
            <p className="app-page-lede">
              Manage your workspace and team.
            </p>
          </div>
        </div>
      </header>
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
