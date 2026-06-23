import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInPanel } from "@/components/auth/sign-in-panel";
import { isGithubEnabled, isGoogleEnabled } from "@/server/auth-providers";
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

  if (await getServerSession()) redirect(target);

  return (
    <>
      <span className="auth-mobile-mark">
        Zen<b>Build</b>
      </span>
      <h2 className="auth-title">Welcome back</h2>
      <p className="auth-subtitle">Sign in to your ZenBuild workspace.</p>

      <SignInPanel
        redirectTo={target}
        githubEnabled={isGithubEnabled()}
        googleEnabled={isGoogleEnabled()}
      />
    </>
  );
}
