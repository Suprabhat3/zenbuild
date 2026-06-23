"use client";

import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type SocialButtonProps = {
  redirectTo: string;
  disabled?: boolean;
};

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17" className="fill-current">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.74-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.82 0c2.22-1.49 3.2-1.18 3.2-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

async function startSocialSignIn(
  provider: "github" | "google",
  redirectTo: string,
  setLoading: (loading: boolean) => void,
) {
  setLoading(true);
  const { error } = await authClient.signIn.social({
    provider,
    callbackURL: redirectTo,
  });
  if (error) {
    setLoading(false);
    const label = provider === "github" ? "GitHub" : "Google";
    toast.error(error.message ?? `Could not start ${label} sign-in.`);
  }
}

export function GithubButton({ redirectTo, disabled }: SocialButtonProps) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="auth-btn auth-btn-ghost"
      onClick={() => startSocialSignIn("github", redirectTo, setLoading)}
      disabled={disabled || loading}
    >
      <GithubIcon />
      Continue with GitHub
    </button>
  );
}

export function GoogleButton({ redirectTo, disabled }: SocialButtonProps) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="auth-btn auth-btn-ghost"
      onClick={() => startSocialSignIn("google", redirectTo, setLoading)}
      disabled={disabled || loading}
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );
}

type OAuthButtonsProps = {
  redirectTo: string;
  githubEnabled: boolean;
  googleEnabled: boolean;
  disabled?: boolean;
};

export function OAuthButtons({
  redirectTo,
  githubEnabled,
  googleEnabled,
  disabled,
}: OAuthButtonsProps) {
  if (!githubEnabled && !googleEnabled) return null;

  return (
    <div className="auth-oauth-stack">
      {googleEnabled && <GoogleButton redirectTo={redirectTo} disabled={disabled} />}
      {githubEnabled && <GithubButton redirectTo={redirectTo} disabled={disabled} />}
    </div>
  );
}
