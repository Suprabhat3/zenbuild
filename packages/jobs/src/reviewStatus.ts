import type { Prisma, PrismaClient } from "@zenbuild/db";

export type FeatureReviewPipelineStatus = "FIX_NEEDED" | "IN_REVIEW";

type DbLike = PrismaClient | Prisma.TransactionClient;

/**
 * Computes the feature-request status after one or more PR reviews complete.
 * Convergence rule (Phase 10): the feature stays `FIX_NEEDED` while *any* open,
 * linked PR's latest completed review still has blocking issues. It moves to
 * `IN_REVIEW` only when every open linked PR has been reviewed and none have
 * blocking issues remaining.
 */
export async function computeFeatureReviewStatus(
  db: DbLike,
  featureRequestId: string,
): Promise<FeatureReviewPipelineStatus> {
  const openPrs = await db.pullRequest.findMany({
    where: { featureRequestId, status: "OPEN" },
    select: { id: true },
  });

  if (openPrs.length === 0) {
    return "IN_REVIEW";
  }

  for (const pr of openPrs) {
    const latest = await db.review.findFirst({
      where: { pullRequestId: pr.id, status: "COMPLETED" },
      orderBy: { version: "desc" },
      select: { id: true },
    });

    // Still waiting for an initial review on this PR — stay in the pipeline.
    if (!latest) {
      return "IN_REVIEW";
    }

    const blocking = await db.reviewIssue.count({
      where: { reviewId: latest.id, severity: "BLOCKING" },
    });
    if (blocking > 0) {
      return "FIX_NEEDED";
    }
  }

  return "IN_REVIEW";
}
