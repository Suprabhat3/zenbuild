import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { FeatureRequestTabs } from "@/components/app/feature-request-tabs";
import { PipelineStepper } from "@/components/app/pipeline-stepper";
import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

/**
 * Shared shell for the feature-request workspace. Every surface of the
 * delivery loop (overview, task board, reviews, release) renders inside the
 * same header + pipeline stepper + tab bar, so the user never loses track of
 * where the request is or how to reach the other stages.
 */
export default async function FeatureRequestLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request: Awaited<ReturnType<typeof api.featureRequest.byId>>;
  try {
    request = await api.featureRequest.byId({ id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const status = request.status as FeatureRequestStatus;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/feature-requests" className="app-back-link">
          <ArrowLeft className="size-4" />
          All requests
        </Link>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[status]}>
              {STATUS_LABELS[status]}
            </Badge>
            <span className="text-muted-foreground text-sm">
              {SOURCE_LABELS[request.source] ?? request.source} ·{" "}
              {PRIORITY_LABELS[request.priority] ?? request.priority} priority
            </span>
            {request.project && (
              <Link
                href={`/projects/${request.project.id}`}
                className="text-primary text-sm font-medium hover:underline"
              >
                {request.project.name} ({request.project.key})
              </Link>
            )}
          </div>
          <h1 className="app-page-title">{request.title}</h1>
          {(request.requesterName ?? request.requesterEmail) && (
            <p className="text-muted-foreground text-sm">
              Requested by {request.requesterName ?? request.requesterEmail}
              {request.requesterName && request.requesterEmail
                ? ` · ${request.requesterEmail}`
                : ""}
            </p>
          )}
        </header>
      </div>

      <PipelineStepper featureRequestId={id} status={status} />

      <FeatureRequestTabs id={id} />

      {children}
    </div>
  );
}
