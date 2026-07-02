import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** When set, the whole card becomes a link — metrics should be drillable. */
  href?: string;
}) {
  const body = (
    <>
      <div className="app-stat-card-head">
        <span className="app-stat-card-label">{label}</span>
        <span className="app-stat-card-icon">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="app-stat-card-value">{value}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="app-stat-card">
        {body}
      </Link>
    );
  }
  return <div className="app-stat-card">{body}</div>;
}
