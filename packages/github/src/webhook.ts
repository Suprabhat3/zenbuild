import { verify } from "@octokit/webhooks-methods";

import { getGithubConfig } from "./app";

/**
 * Verify the signature GitHub attaches to every webhook delivery
 * (`X-Hub-Signature-256: sha256=…`). The HMAC is computed over the *raw* request
 * body, so the route handler must pass the exact bytes it received — never a
 * re-serialized object. Returns false when the App is unconfigured or the
 * signature header is missing/invalid.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const config = getGithubConfig();
  if (!config || !signatureHeader) return false;
  try {
    return await verify(config.webhookSecret, rawBody, signatureHeader);
  } catch {
    return false;
  }
}

// --- Minimal shapes of the webhook payloads we consume -----------------------
// (We intentionally type only the fields ZenBuild reads, rather than pull in the
// full @octokit/webhooks-types surface.)

export interface WebhookRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch?: string;
  private?: boolean;
}

export interface PullRequestWebhookPayload {
  action: string;
  number: number;
  repository: WebhookRepository;
  installation?: { id: number };
}

export interface PushWebhookPayload {
  ref: string; // e.g. "refs/heads/feature-branch"
  repository: WebhookRepository;
  installation?: { id: number };
}

export interface InstallationWebhookPayload {
  action: string; // "created" | "deleted" | "suspend" | "unsuspend" | ...
  installation: { id: number; account?: { login?: string } };
}

/** Extract the branch name from a push `ref`, or null for non-branch refs. */
export function branchFromPushRef(ref: string): string | null {
  const prefix = "refs/heads/";
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : null;
}
