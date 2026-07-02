"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";

/**
 * Error boundary for the authenticated app segment. Keeps the sidebar/shell
 * intact and offers a retry, so a single failed page doesn't feel like the
 * whole product crashed.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="app-panel">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="This page hit an unexpected error. It's usually temporary — trying again often fixes it."
        action={
          <button
            type="button"
            onClick={reset}
            className="text-primary text-sm font-medium hover:underline"
          >
            Try again
          </button>
        }
      />
    </div>
  );
}
