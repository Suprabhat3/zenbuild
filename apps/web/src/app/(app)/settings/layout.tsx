import { SettingsNav } from "@/components/app/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
