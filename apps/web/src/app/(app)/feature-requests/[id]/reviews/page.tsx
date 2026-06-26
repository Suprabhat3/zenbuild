import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { ReviewHistoryTimeline } from "@/components/app/review-history-timeline";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const fr = await api.featureRequest.byId({ id });
    return { title: `Review History · ${fr.title} · ZenBuild` };
  } catch {
    return { title: "Review History · ZenBuild" };
  }
}

export default async function FeatureReviewHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request: Awaited<ReturnType<typeof api.featureRequest.byId>>;
  let history: Awaited<ReturnType<typeof api.review.history>>;
  try {
    [request, history] = await Promise.all([
      api.featureRequest.byId({ id }),
      api.review.history({ featureRequestId: id }),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const status = request.status as FeatureRequestStatus;

  return (
    <div className="space-y-8">
      <Link href={`/feature-requests/${id}`} className="app-back-link">
        <ArrowLeft className="size-4" />
        Feature request
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[status]}>
            {STATUS_LABELS[status]}
          </Badge>
          <Badge variant="outline">
            {history.totalIterations} review iteration
            {history.totalIterations === 1 ? "" : "s"}
          </Badge>
        </div>
        <h1 className="app-page-title">Review history</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Complete audit trail for <strong>{request.title}</strong> — every review
          version, issue, trigger source, GitHub comment link, and state
          transition across all linked pull requests.
        </p>
      </header>

      <ReviewHistoryTimeline featureRequestId={id} initialData={history} />
    </div>
  );
}
