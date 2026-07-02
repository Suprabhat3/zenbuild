"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root error boundary for everything outside the app shell (landing, auth,
 * legal, onboarding). The warm theme is global, so no scope wrapper is needed.
 */
export default function RootError({
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
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <span className="auth-wordmark mb-8">ZenBuild</span>
        <h1 className="auth-title mb-2">Something went wrong</h1>
        <p className="auth-subtitle mx-auto mb-8 max-w-md">
          An unexpected error interrupted this page. It&apos;s usually
          temporary — trying again often fixes it.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="auth-btn auth-btn-primary px-5"
          >
            Try again
          </button>
          <Link href="/" className="auth-btn auth-btn-ghost px-5">
            Back to home
          </Link>
        </div>
    </div>
  );
}
