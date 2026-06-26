import { getInstallationOctokit } from "./app";

export type GithubReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface InlineReviewComment {
  path: string;
  line: number;
  body: string;
}

export interface PostPullRequestReviewInput {
  installationId: number | bigint;
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  body: string;
  event: GithubReviewEvent;
  /** Inline comments on the diff (GitHub caps at ~30 per review). */
  comments?: InlineReviewComment[];
}

export interface PostedPullRequestReview {
  id: number;
  url: string;
  /** How many inline comments were successfully attached. */
  inlineCommentCount: number;
}

const MAX_INLINE = 25;

/**
 * Posts a pull-request review (summary + optional inline comments) as the GitHub
 * App. If inline comments fail (e.g. stale line numbers), falls back to a
 * summary-only review so the run still completes.
 */
export async function postPullRequestReview(
  input: PostPullRequestReviewInput,
): Promise<PostedPullRequestReview> {
  const octokit = await getInstallationOctokit(input.installationId);
  const comments = (input.comments ?? []).slice(0, MAX_INLINE);

  const base = {
    owner: input.owner,
    repo: input.repo,
    pull_number: input.pullNumber,
    commit_id: input.commitSha,
    body: input.body,
    event: input.event,
  };

  if (comments.length === 0) {
    const res = await octokit.rest.pulls.createReview(base);
    return {
      id: res.data.id,
      url: res.data.html_url,
      inlineCommentCount: 0,
    };
  }

  try {
    const res = await octokit.rest.pulls.createReview({
      ...base,
      comments: comments.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
      })),
    });
    return {
      id: res.data.id,
      url: res.data.html_url,
      inlineCommentCount: comments.length,
    };
  } catch {
    // Line numbers often drift; still land the summary review.
    const res = await octokit.rest.pulls.createReview(base);
    return {
      id: res.data.id,
      url: res.data.html_url,
      inlineCommentCount: 0,
    };
  }
}

/**
 * Renders a GitHub-friendly markdown body for an AI review.
 */
export function formatReviewBody(args: {
  version: number;
  summary: string;
  blockingCount: number;
  nonBlockingCount: number;
  reviewUrl?: string;
  isReReview?: boolean;
}): string {
  const title = args.isReReview
    ? `ZenBuild AI Re-Review (v${args.version})`
    : `ZenBuild AI Review (v${args.version})`;
  const lines = [
    `## ${title}`,
    "",
    args.summary,
    "",
    `**Issues:** ${args.blockingCount} blocking · ${args.nonBlockingCount} non-blocking`,
    "",
    "_Reviewed against the approved PRD, engineering tasks, and acceptance criteria._",
  ];
  if (args.reviewUrl) {
    lines.push("", `[View full review in ZenBuild](${args.reviewUrl})`);
  }
  return lines.join("\n");
}

/** Deep-link to a posted PR review on GitHub. */
export function buildGithubReviewUrl(
  pullRequestUrl: string,
  githubReviewId: number | bigint | null | undefined,
): string | null {
  if (githubReviewId == null) return null;
  const base = pullRequestUrl.split("#")[0]!.replace(/\/$/, "");
  return `${base}#pullrequestreview-${githubReviewId.toString()}`;
}
