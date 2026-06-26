import type { PrismaClient } from "@zenbuild/db";
import { buildGithubReviewUrl } from "@zenbuild/github";

/** Human-readable label for who/what triggered a review run. */
export async function resolveReviewTriggerLabel(
  db: PrismaClient,
  triggeredBy: string | null | undefined,
): Promise<{ key: string; label: string }> {
  if (!triggeredBy || triggeredBy === "webhook") {
    return { key: "webhook", label: "GitHub webhook (auto)" };
  }
  if (triggeredBy === "manual") {
    return { key: "manual", label: "Manual trigger" };
  }

  const user = await db.user.findUnique({
    where: { id: triggeredBy },
    select: { name: true, email: true },
  });
  return {
    key: triggeredBy,
    label: user?.name?.trim() || user?.email || "Team member",
  };
}

export function reviewTransitionLabel(args: {
  version: number;
  blockingCount: number;
  verdict: string | null;
}): string {
  if (args.blockingCount > 0) {
    return args.version > 1
      ? "Re-review found blocking issues → Fix needed"
      : "Review found blocking issues → Fix needed";
  }
  if (args.verdict === "APPROVE") {
    return args.version > 1
      ? "Re-review passed → Ready for human approval"
      : "Review passed → Ready for human approval";
  }
  return args.version > 1
    ? "Re-review completed (advisory feedback only)"
    : "Review completed (advisory feedback only)";
}

export async function enrichReviewRow(
  db: PrismaClient,
  review: {
    id: string;
    version: number;
    status: string;
    verdict: string | null;
    summary: string | null;
    githubReviewId: bigint | null;
    triggeredBy: string | null;
    model: string | null;
    createdAt: Date;
    completedAt: Date | null;
    pullRequest: {
      id: string;
      number: number;
      url: string;
      title: string;
      headRef: string;
      status: string;
      repository: { fullName: string };
    };
    issues: {
      id: string;
      severity: string;
      category: string;
      status: string;
      title: string;
      explanation: string;
      suggestion: string | null;
      filePath: string | null;
      line: number | null;
      createdAt: Date;
    }[];
  },
) {
  const blockingCount = review.issues.filter((i) => i.severity === "BLOCKING").length;
  const nonBlockingCount = review.issues.length - blockingCount;
  const trigger = await resolveReviewTriggerLabel(db, review.triggeredBy);

  return {
    ...review,
    blockingCount,
    nonBlockingCount,
    isReReview: review.version > 1,
    triggeredByLabel: trigger.label,
    triggeredByKey: trigger.key,
    githubReviewUrl: buildGithubReviewUrl(
      review.pullRequest.url,
      review.githubReviewId,
    ),
    transitionLabel: reviewTransitionLabel({
      version: review.version,
      blockingCount,
      verdict: review.verdict,
    }),
  };
}
