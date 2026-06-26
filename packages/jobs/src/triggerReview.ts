import { db } from "@zenbuild/db";

import { inngest, prReviewRequested } from "./client";

const REVIEWABLE_FEATURE_STATUSES = [
  "IN_DEVELOPMENT",
  "IN_REVIEW",
  "FIX_NEEDED",
] as const;

const AUTO_REVIEW_REASONS = new Set([
  "opened",
  "synchronize",
  "reopened",
  "agent-implement",
  "push",
]);

/**
 * Whether an inbound PR sync should enqueue a fresh AI review. Skips when the
 * PR is not linked, the feature is not in a reviewable state, the commit was
 * already reviewed, or a review is already in flight.
 */
export async function shouldAutoReviewAfterSync(args: {
  organizationId: string;
  pullRequestId: string;
  headSha: string | null;
  featureRequestId: string | null;
  featureStatus: string | null;
  reason?: string;
  /** Manual retriggers bypass the headSha dedupe. */
  force?: boolean;
}): Promise<{ enqueue: boolean; skipReason?: string }> {
  if (!args.featureRequestId) {
    return { enqueue: false, skipReason: "unlinked-pr" };
  }
  if (
    !args.featureStatus ||
    !REVIEWABLE_FEATURE_STATUSES.includes(
      args.featureStatus as (typeof REVIEWABLE_FEATURE_STATUSES)[number],
    )
  ) {
    return { enqueue: false, skipReason: "feature-not-reviewable" };
  }
  if (!args.force && args.reason && !AUTO_REVIEW_REASONS.has(args.reason)) {
    return { enqueue: false, skipReason: "reason-not-reviewable" };
  }

  const inflight = await db.workflowRun.findFirst({
    where: {
      organizationId: args.organizationId,
      type: "PR_REVIEW",
      status: { in: ["QUEUED", "RUNNING"] },
      input: { path: ["pullRequestId"], equals: args.pullRequestId },
    },
    select: { id: true },
  });
  if (inflight) {
    return { enqueue: false, skipReason: "review-in-flight" };
  }

  if (!args.force && args.headSha) {
    const last = await db.workflowRun.findFirst({
      where: {
        organizationId: args.organizationId,
        type: "PR_REVIEW",
        status: "COMPLETED",
        input: { path: ["pullRequestId"], equals: args.pullRequestId },
      },
      orderBy: { finishedAt: "desc" },
      select: { input: true },
    });
    const lastSha = (last?.input as { headSha?: string | null } | null)?.headSha;
    if (lastSha && lastSha === args.headSha) {
      return { enqueue: false, skipReason: "already-reviewed-sha" };
    }
  }

  return { enqueue: true };
}

/**
 * Creates a `WorkflowRun` (PR_REVIEW) and emits the Inngest event. Shared by the
 * webhook-driven auto trigger and the manual "Review now" API.
 */
export async function enqueuePrReview(args: {
  organizationId: string;
  pullRequestId: string;
  featureRequestId: string;
  headSha?: string | null;
  triggeredBy?: string;
}) {
  const run = await db.workflowRun.create({
    data: {
      type: "PR_REVIEW",
      status: "QUEUED",
      organizationId: args.organizationId,
      featureRequestId: args.featureRequestId,
      input: {
        pullRequestId: args.pullRequestId,
        headSha: args.headSha ?? null,
        triggeredBy: args.triggeredBy ?? "webhook",
      },
    },
  });

  await inngest.send(
    prReviewRequested.create({
      organizationId: args.organizationId,
      pullRequestId: args.pullRequestId,
      featureRequestId: args.featureRequestId,
      workflowRunId: run.id,
      ...(args.triggeredBy ? { triggeredBy: args.triggeredBy } : {}),
    }),
  );

  return run;
}
