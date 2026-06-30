import { hasCreditsFor, workflowCreditCost } from "@zenbuild/billing";
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

/** Re-review is triggered by push/sync/agent re-implement while FIX_NEEDED. */
const REREVIEW_REASONS = new Set(["synchronize", "push", "agent-implement"]);

/**
 * Whether an inbound PR sync should enqueue a fresh AI review. Skips when the
 * PR is not linked, the feature is not in a reviewable state, the commit was
 * already reviewed, or a review is already in flight.
 *
 * Phase 10: when the feature is `FIX_NEEDED`, only `push` / `synchronize`
 * (new commits) enqueue a re-review — not passive sync reasons like `opened`.
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
}): Promise<{ enqueue: boolean; skipReason?: string; isReReview?: boolean }> {
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

  const isReReview = args.featureStatus === "FIX_NEEDED";

  if (!args.force && isReReview && args.reason && !REREVIEW_REASONS.has(args.reason)) {
    return { enqueue: false, skipReason: "fix-needed-awaiting-push" };
  }

  if (!args.force && !isReReview && args.reason && !AUTO_REVIEW_REASONS.has(args.reason)) {
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

  // Plan gate: don't auto-burn an AI review when the org is out of credits.
  // Manual "Review now" surfaces an upsell instead (handled at the API layer).
  if (!(await hasCreditsFor(db, args.organizationId, workflowCreditCost("PR_REVIEW")))) {
    return { enqueue: false, skipReason: "out-of-credits" };
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

  return { enqueue: true, isReReview };
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
  isReReview?: boolean;
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
        isReReview: args.isReReview ?? false,
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
