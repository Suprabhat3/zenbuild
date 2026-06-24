import { SettingsNav } from "@/components/app/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your workspace and team.
        </p>
      </div>
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
