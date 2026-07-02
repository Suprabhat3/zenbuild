import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { ReviewHistoryTimeline } from "@/components/app/review-history-timeline";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Review history · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function FeatureReviewHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let history: Awaited<ReturnType<typeof api.review.history>>;
  try {
    history = await api.review.history({ featureRequestId: id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {history.totalIterations} review iteration
          {history.totalIterations === 1 ? "" : "s"}
        </Badge>
        <p className="text-muted-foreground text-sm">
          Every review version, issue, trigger source, GitHub comment link, and
          state transition across all linked pull requests.
        </p>
      </div>

      <ReviewHistoryTimeline featureRequestId={id} initialData={history} />
    </div>
  );
}
