import Link from "next/link";
import { Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/**
 * Empty state for a stage surface the request hasn't reached yet. Explains
 * what unlocks the stage and routes the user back to the gate that's actually
 * open, so clicking ahead on the stepper never dead-ends.
 */
export function StageLocked({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="app-panel">
      <div className="app-empty">
        <span className="app-empty-icon">
          <Lock className="size-5" />
        </span>
        <h2 className="app-empty-title">{title}</h2>
        <p className="app-empty-desc">{description}</p>
        {action && (
          <Link
            href={action.href}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
