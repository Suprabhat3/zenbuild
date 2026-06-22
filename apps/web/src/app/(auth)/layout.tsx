import Link from "next/link";

/**
 * Centered, minimal layout for unauthenticated auth screens.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        ZenBuild
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-muted-foreground max-w-sm text-center text-xs">
        By continuing you agree to ship features calmly — from request to release.
      </p>
    </div>
  );
}
