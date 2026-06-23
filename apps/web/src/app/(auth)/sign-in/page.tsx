import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GithubButton } from "@/components/auth/oauth-buttons";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isGithubEnabled } from "@/server/auth-providers";
import { getServerSession } from "@/server/auth";
import { safeRedirectTarget } from "@/lib/validators/auth";

export const metadata: Metadata = { title: "Sign in · ZenBuild" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const target = safeRedirectTarget(redirectTo);

  // Already authenticated → skip the form.
  if (await getServerSession()) redirect(target);

  const githubEnabled = isGithubEnabled();

  return (
    <>
      <span className="auth-mobile-mark">
        Zen<b>Build</b>
      </span>
      <h2 className="auth-title">Welcome back</h2>
      <p className="auth-subtitle">Sign in to your ZenBuild workspace.</p>

      {githubEnabled && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <GithubButton redirectTo={target} />
          <div className="auth-divider">or</div>
        </div>
      )}

      <SignInForm redirectTo={target} />
    </>
  );
}
