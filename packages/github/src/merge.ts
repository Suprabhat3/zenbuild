import { getInstallationOctokit } from "./app";

export type MergeMethod = "merge" | "squash" | "rebase";

export interface MergePullRequestInput {
  installationId: number | bigint;
  owner: string;
  repo: string;
  pullNumber: number;
  /** Defaults to "squash" — keeps a single, clean commit per shipped feature. */
  method?: MergeMethod;
  commitTitle?: string;
  commitMessage?: string;
}

export type MergeFailureReason =
  | "not_mergeable" // conflicts, failing required checks, branch protection
  | "already_merged"
  | "not_found"
  | "forbidden" // token lacks permission / protected branch
  | "unknown";

export type MergePullRequestResult =
  | { merged: true; sha: string; mergedAt: Date }
  | { merged: false; reason: MergeFailureReason; message: string };

interface OctokitishError {
  status?: number;
  message?: string;
}

function asOctokitError(err: unknown): OctokitishError {
  if (typeof err === "object" && err !== null) {
    const e = err as { status?: unknown; message?: unknown };
    return {
      status: typeof e.status === "number" ? e.status : undefined,
      message: typeof e.message === "string" ? e.message : undefined,
    };
  }
  return {};
}

/**
 * Merges a pull request as the GitHub App. Never throws on a "GitHub said no"
 * outcome (conflicts, branch protection, failing checks, already-merged) — those
 * come back as `{ merged: false, reason }` so the caller can fall back to
 * mark-shipped-without-merge. Only truly unexpected errors propagate.
 */
export async function mergePullRequest(
  input: MergePullRequestInput,
): Promise<MergePullRequestResult> {
  const octokit = await getInstallationOctokit(input.installationId);

  try {
    const res = await octokit.rest.pulls.merge({
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pullNumber,
      merge_method: input.method ?? "squash",
      ...(input.commitTitle ? { commit_title: input.commitTitle } : {}),
      ...(input.commitMessage ? { commit_message: input.commitMessage } : {}),
    });

    return {
      merged: true,
      sha: res.data.sha,
      mergedAt: new Date(),
    };
  } catch (err) {
    const { status, message } = asOctokitError(err);
    const reason: MergeFailureReason =
      status === 405 || status === 409
        ? "not_mergeable"
        : status === 404
          ? "not_found"
          : status === 403
            ? "forbidden"
            : "unknown";

    // A genuinely unexpected failure (5xx, network) should surface for retry.
    if (reason === "unknown" && (status === undefined || status >= 500)) {
      throw err;
    }

    return {
      merged: false,
      reason,
      message:
        message ??
        "GitHub declined to merge the pull request (it may have conflicts, failing checks, or branch protection).",
    };
  }
}
