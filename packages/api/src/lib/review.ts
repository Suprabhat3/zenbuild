import type { PrismaClient } from "@zenbuild/db";
import { enqueuePrReview } from "@zenbuild/jobs";

/**
 * Kicks off an AI code review for a tracked pull request. Creates the
 * `WorkflowRun` row first (intent is never lost) then emits the Inngest event.
 */
export async function triggerPrReview(
  db: PrismaClient,
  args: {
    organizationId: string;
    pullRequestId: string;
    featureRequestId: string;
    headSha?: string | null;
    actorId?: string | null;
    /** Bypass headSha dedupe (manual "Review now"). */
    force?: boolean;
    isReReview?: boolean;
  },
) {
  return enqueuePrReview({
    organizationId: args.organizationId,
    pullRequestId: args.pullRequestId,
    featureRequestId: args.featureRequestId,
    headSha: args.headSha ?? null,
    triggeredBy: args.actorId ?? "manual",
    isReReview: args.isReReview ?? false,
  });
}
