import { assertGithubConfigured } from "./app";
import { signInstallState } from "./state";

/**
 * Build the URL that starts the GitHub App install flow for a given org/user.
 * GitHub shows its install/permissions screen, then redirects to the App's
 * configured "Setup URL" (our /api/github/callback) with `installation_id` and
 * the signed `state` we attach here.
 */
export function buildInstallUrl(
  args: { organizationId: string; userId: string },
  now: number,
): string {
  const { appSlug } = assertGithubConfigured();
  const state = signInstallState(args, now);
  const params = new URLSearchParams({ state });
  return `https://github.com/apps/${appSlug}/installations/new?${params.toString()}`;
}

/** URL to manage an existing installation's repo access on GitHub. */
export function buildManageInstallationUrl(accountLogin: string): string {
  return `https://github.com/organizations/${accountLogin}/settings/installations`;
}
