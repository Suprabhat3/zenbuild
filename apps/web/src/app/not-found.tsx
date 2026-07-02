import Link from "next/link";

/**
 * Global 404 for any URL that doesn't match a route. Uses the `.authx` scope so
 * it shares the warm editorial brand without needing the app shell (the visitor
 * may not be signed in).
 */
export default function NotFound() {
  return (
    <div className="authx">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Link href="/" className="auth-wordmark mb-8">
          ZenBuild
        </Link>
        <p className="auth-pill mb-4">404</p>
        <h1 className="auth-title mb-2">This page doesn&apos;t exist</h1>
        <p className="auth-subtitle mx-auto mb-8 max-w-md">
          The link may be outdated, or the page may have moved. Head back to
          somewhere familiar.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="auth-btn auth-btn-primary px-5">
            Go to dashboard
          </Link>
          <Link href="/" className="auth-btn auth-btn-ghost px-5">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
