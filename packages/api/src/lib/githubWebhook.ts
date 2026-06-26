import { db } from "@zenbuild/db";
import {
  branchFromPushRef,
  verifyWebhookSignature,
  type InstallationWebhookPayload,
  type PullRequestWebhookPayload,
  type PushWebhookPayload,
} from "@zenbuild/github";
import {
  githubInstallationSyncRequested,
  githubPrSyncRequested,
  inngest,
} from "@zenbuild/jobs";

/** Headers GitHub sends on every webhook delivery. */
export const GITHUB_EVENT_HEADER = "x-github-event";
export const GITHUB_SIGNATURE_HEADER = "x-hub-signature-256";
export const GITHUB_DELIVERY_HEADER = "x-github-delivery";

export type GithubWebhookResult =
  | { ok: true; handled: boolean; detail?: string }
  | { ok: false; status: number; error: string };

/**
 * Verify + dispatch an inbound GitHub webhook. Heavy work (fetching diffs,
 * upserting PRs) is deferred to Inngest so we acknowledge GitHub fast; this
 * handler only verifies the signature, resolves the org/repo from our DB, and
 * emits the right event(s).
 *
 * Security: the HMAC is computed over the *raw* body, so the route handler must
 * pass the exact received bytes (not a re-serialized object). No valid signature
 * → no processing.
 */
export async function handleGithubWebhook(
  rawBody: string,
  headers: Headers,
): Promise<GithubWebhookResult> {
  const signature = headers.get(GITHUB_SIGNATURE_HEADER);
  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return { ok: false, status: 401, error: "Invalid or missing signature." };
  }

  const event = headers.get(GITHUB_EVENT_HEADER);
  if (!event) {
    return { ok: false, status: 400, error: "Missing event header." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "Body is not valid JSON." };
  }

  switch (event) {
    case "ping":
      return { ok: true, handled: true, detail: "pong" };

    case "installation":
    case "installation_repositories":
      return handleInstallation(payload as InstallationWebhookPayload);

    case "pull_request":
      return handlePullRequest(payload as PullRequestWebhookPayload);

    case "push":
      return handlePush(payload as PushWebhookPayload);

    // pull_request_review (and review comments) are consumed by the review
    // pipeline in a later phase; acknowledge so GitHub doesn't retry.
    default:
      return { ok: true, handled: false, detail: `Ignored event: ${event}` };
  }
}

/**
 * Resolve the connected `Repository` for a webhook delivery. We key off the
 * installation id (precise, even if the same repo is connected by multiple orgs)
 * and the GitHub repo id.
 */
async function resolveRepository(
  installationId: number | undefined,
  repoGithubId: number,
) {
  if (!installationId) return null;
  const installation = await db.githubInstallation.findUnique({
    where: { installationId: BigInt(installationId) },
    select: { organizationId: true },
  });
  if (!installation) return null;

  const repository = await db.repository.findFirst({
    where: {
      organizationId: installation.organizationId,
      githubId: BigInt(repoGithubId),
    },
    select: { id: true, organizationId: true },
  });
  return repository;
}

async function handlePullRequest(
  payload: PullRequestWebhookPayload,
): Promise<GithubWebhookResult> {
  const repo = await resolveRepository(
    payload.installation?.id,
    payload.repository.id,
  );
  if (!repo) return { ok: true, handled: false, detail: "Repo not connected." };

  await inngest.send(
    githubPrSyncRequested.create({
      organizationId: repo.organizationId,
      repositoryId: repo.id,
      prNumber: payload.number,
      reason: payload.action,
    }),
  );
  return { ok: true, handled: true };
}

async function handlePush(
  payload: PushWebhookPayload,
): Promise<GithubWebhookResult> {
  const branch = branchFromPushRef(payload.ref);
  if (!branch) return { ok: true, handled: false, detail: "Non-branch ref." };

  const repo = await resolveRepository(
    payload.installation?.id,
    payload.repository.id,
  );
  if (!repo) return { ok: true, handled: false, detail: "Repo not connected." };

  // Re-sync any open PRs whose head is the pushed branch (keeps diffs current;
  // FIX_NEEDED features auto re-review via `github/pr.sync` → `review/pr.requested`).
  const openPrs = await db.pullRequest.findMany({
    where: { repositoryId: repo.id, headRef: branch, status: "OPEN" },
    select: { number: true },
  });
  if (openPrs.length === 0) {
    return { ok: true, handled: false, detail: "No open PRs on branch." };
  }

  await inngest.send(
    openPrs.map((pr) =>
      githubPrSyncRequested.create({
        organizationId: repo.organizationId,
        repositoryId: repo.id,
        prNumber: pr.number,
        reason: "push",
      }),
    ),
  );
  return { ok: true, handled: true, detail: `Re-syncing ${openPrs.length} PR(s).` };
}

async function handleInstallation(
  payload: InstallationWebhookPayload,
): Promise<GithubWebhookResult> {
  // We only need to react to the App being uninstalled; the install itself is
  // recorded by the OAuth callback. Forward the change for async cleanup.
  await inngest.send(
    githubInstallationSyncRequested.create({
      installationId: payload.installation.id,
      action: payload.action,
    }),
  );
  return { ok: true, handled: true, detail: `installation:${payload.action}` };
}
