import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("app-page-header", className)}>
      {eyebrow && <span className="app-eyebrow">{eyebrow}</span>}
      <div className="app-page-header-row">
        <div className="min-w-0">
          <h1 className="app-page-title">{title}</h1>
          {description && <p className="app-page-lede">{description}</p>}
        </div>
        {actions && <div className="app-page-actions">{actions}</div>}
      </div>
    </header>
  );
}
