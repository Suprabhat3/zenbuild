import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="app-stat-card">
      <div className="app-stat-card-head">
        <span className="app-stat-card-label">{label}</span>
        <span className="app-stat-card-icon">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="app-stat-card-value">{value}</div>
    </div>
  );
}
