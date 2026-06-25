import { serverEnv } from "@zenbuild/env";
import { App, Octokit } from "octokit";

/**
 * GitHub App access. ZenBuild runs as a single shared GitHub App (created once by
 * us, the vendor); each customer org *installs* it on their GitHub account/org.
 * We authenticate as the App (JWT) to mint short-lived, per-installation tokens —
 * the App class caches those tokens internally.
 *
 * All of this is gated on the GITHUB_APP_* env being present so the app boots in
 * earlier phases / unconfigured environments. Call `assertGithubConfigured()` (or
 * check `isGithubConfigured()`) before any operation that needs live GitHub.
 */

export interface GithubConfig {
  appId: string;
  appSlug: string;
  privateKey: string;
  webhookSecret: string;
}

/**
 * Reads + validates the GitHub App config from env. Returns null when the App is
 * not configured (so callers can degrade gracefully rather than throw on boot).
 */
export function getGithubConfig(): GithubConfig | null {
  const appId = serverEnv.GITHUB_APP_ID;
  const appSlug = serverEnv.GITHUB_APP_SLUG;
  const privateKeyRaw = serverEnv.GITHUB_APP_PRIVATE_KEY;
  const webhookSecret = serverEnv.GITHUB_WEBHOOK_SECRET;

  if (!appId || !appSlug || !privateKeyRaw || !webhookSecret) return null;

  return {
    appId,
    appSlug,
    // Env vars commonly store PEM keys with literal "\n" escapes — normalize.
    privateKey: privateKeyRaw.includes("\\n")
      ? privateKeyRaw.replace(/\\n/g, "\n")
      : privateKeyRaw,
    webhookSecret,
  };
}

export function isGithubConfigured(): boolean {
  return getGithubConfig() !== null;
}

/** Throws a clear error when a live-GitHub operation is attempted unconfigured. */
export function assertGithubConfigured(): GithubConfig {
  const config = getGithubConfig();
  if (!config) {
    throw new Error(
      "GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET.",
    );
  }
  return config;
}

// One App instance per process; created lazily on first use.
let appInstance: App | null = null;

function getApp(): App {
  const config = assertGithubConfigured();
  if (!appInstance) {
    appInstance = new App({
      appId: config.appId,
      privateKey: config.privateKey,
    });
  }
  return appInstance;
}

/** App-authenticated (JWT) Octokit — for endpoints that act as the App itself. */
export function getAppOctokit(): Octokit {
  return getApp().octokit;
}

/**
 * Installation-authenticated Octokit — the workhorse for repo/PR reads. The App
 * class mints and caches an installation access token internally.
 */
export function getInstallationOctokit(
  installationId: number | bigint,
): Promise<Octokit> {
  return getApp().getInstallationOctokit(Number(installationId));
}

export { Octokit };
