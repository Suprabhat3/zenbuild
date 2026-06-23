import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GithubButton } from "@/components/auth/oauth-buttons";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { isGithubEnabled } from "@/server/auth-providers";
import { getServerSession } from "@/server/auth";
import { safeRedirectTarget } from "@/lib/validators/auth";

export const metadata: Metadata = { title: "Sign up · ZenBuild" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const target = safeRedirectTarget(redirectTo);

  if (await getServerSession()) redirect(target);

  const githubEnabled = isGithubEnabled();

  return (
    <>
      <span className="auth-mobile-mark">
        Zen<b>Build</b>
      </span>
      <h2 className="auth-title">Create your account</h2>
      <p className="auth-subtitle">
        Start shipping features calmly. We&apos;ll email you a code to verify your
        address.
      </p>

      {githubEnabled && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <GithubButton redirectTo={target} />
          <div className="auth-divider">or</div>
        </div>
      )}

      <SignUpForm redirectTo={target} />
    </>
  );
}
