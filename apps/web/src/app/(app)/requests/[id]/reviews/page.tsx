import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { FixNeededPanel } from "@/components/app/fix-needed-panel";
import { ReviewHistoryTimeline } from "@/components/app/review-history-timeline";
import { ReviewPanel } from "@/components/app/review-panel";
import { StageLocked } from "@/components/app/stage-locked";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_STAGE_INDEX,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { requireFeatureRequest } from "@/server/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Reviews · ZenBuild" };
export const dynamic = "force-dynamic";

/**
 * Review stage: the fix-needed workspace when blocking issues are open, the
 * latest AI review per pull request (with manual re-review), and the full
 * review-iteration timeline.
 */
export default async function ReviewsStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await requireFeatureRequest(id);
  const status = request.status as FeatureRequestStatus;

  // Reviews start accumulating during development (stage index 4), as soon as
  // pull requests open.
  if (request._count.reviews === 0 && STATUS_STAGE_INDEX[status] < 4) {
    return (
      <StageLocked
        title="No reviews yet"
        description="Every pull request gets an AI review against the PRD and acceptance criteria. Reviews appear here once development starts and PRs open."
        action={{ href: `/requests/${id}/plan`, label: "Go to Plan" }}
      />
    );
  }

  let history: Awaited<ReturnType<typeof api.review.history>>;
  try {
    history = await api.review.history({ featureRequestId: id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <FixNeededPanel featureRequestId={id} status={status} />

      <ReviewPanel featureRequestId={id} status={status} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {history.totalIterations} review iteration
            {history.totalIterations === 1 ? "" : "s"}
          </Badge>
          <p className="text-muted-foreground text-sm">
            Every review version, issue, trigger source, GitHub comment link,
            and state transition across all linked pull requests.
          </p>
        </div>
        <ReviewHistoryTimeline featureRequestId={id} initialData={history} />
      </section>
    </div>
  );
}
