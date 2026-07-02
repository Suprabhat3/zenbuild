import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";

/**
 * 404 for the authenticated app segment — shown when a page calls `notFound()`
 * (e.g. a feature request or review id that doesn't exist in this workspace).
 * Renders inside the app shell so the user keeps their sidebar and context.
 */
export default function AppNotFound() {
  return (
    <div className="app-panel">
      <EmptyState
        icon={SearchX}
        title="We couldn't find that"
        description="It may have been deleted, or it belongs to a different workspace. Check you're in the right workspace, or head back to the dashboard."
        action={
          <Link
            href="/dashboard"
            className="text-primary text-sm font-medium hover:underline"
          >
            Go to dashboard
          </Link>
        }
      />
    </div>
  );
}
