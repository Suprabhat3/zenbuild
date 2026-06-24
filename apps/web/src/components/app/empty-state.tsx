import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-empty">
      <span className="app-empty-icon">
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="app-empty-title">{title}</p>
        <p className="app-empty-desc">{description}</p>
      </div>
      {action}
    </div>
  );
}
