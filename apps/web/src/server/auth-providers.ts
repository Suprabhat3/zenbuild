import "server-only";

import { serverEnv } from "@zenbuild/env";

/** Whether GitHub OAuth is configured (controls the "Continue with GitHub" button). */
export function isGithubEnabled(): boolean {
  return Boolean(serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET);
}
