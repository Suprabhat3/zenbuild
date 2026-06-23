import "server-only";

import { serverEnv } from "@zenbuild/env";

/** Whether GitHub OAuth is configured (controls the "Continue with GitHub" button). */
export function isGithubEnabled(): boolean {
  return Boolean(serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET);
}

/** Whether Google OAuth is configured (controls the "Continue with Google" button). */
export function isGoogleEnabled(): boolean {
  return Boolean(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET);
}

/** Whether any social login provider is available. */
export function isSocialLoginEnabled(): boolean {
  return isGithubEnabled() || isGoogleEnabled();
}
