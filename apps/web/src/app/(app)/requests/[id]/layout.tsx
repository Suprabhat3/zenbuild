import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleSlash } from "lucide-react";

import { EditRequestDialog } from "@/components/app/edit-request-dialog";
import { PipelineStepper } from "@/components/app/pipeline-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NEXT_ACTION,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { requireFeatureRequest } from "@/server/feature-request";
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

/**
 * Shell for the request workspace. The pipeline stepper doubles as the
 * navigation between stage surfaces (discovery → ship); under it, a single
 * next-action banner tells the user what the request is waiting on. Each stage
 * page renders below as `children`.
 */
export default async function FeatureRequestLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await requireFeatureRequest(id);
  const status = request.status as FeatureRequestStatus;
  const action = NEXT_ACTION[status];
  const editable = !TERMINAL_STATUSES.includes(status);
  const projects = editable ? await api.project.list() : [];

  return (
    <div className="space-y-6">
      <div>
        <nav className="app-back-link" aria-label="Breadcrumb">
          <ArrowLeft className="size-4" />
          <Link href="/requests" className="hover:underline">
            Requests
          </Link>
          {request.project && (
            <>
              <span aria-hidden>/</span>
              <Link
                href={`/projects/${request.project.id}`}
                className="hover:underline"
              >
                {request.project.name}
              </Link>
            </>
          )}
        </nav>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[status]}>
              {STATUS_LABELS[status]}
            </Badge>
            <span className="text-muted-foreground text-sm">
              {SOURCE_LABELS[request.source] ?? request.source} ·{" "}
              {PRIORITY_LABELS[request.priority] ?? request.priority} priority
            </span>
            {editable && (
              <span className="ml-auto">
                <EditRequestDialog
                  request={{
                    id: request.id,
                    title: request.title,
                    description: request.description,
                    priority: request.priority,
                    projectId: request.project?.id ?? null,
                  }}
                  projects={projects.map((p) => ({
                    id: p.id,
                    name: p.name,
                    key: p.key,
                  }))}
                />
              </span>
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

      {action ? (
        <div className="app-next-action">
          <p className="app-next-action-hint">
            <strong>Next up:</strong> {action.hint}
          </p>
          <Button size="sm" render={<Link href={action.href(id)} />}>
            {action.label}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : status === "SHIPPED" ? (
        <div className="app-next-action">
          <p className="app-next-action-hint">
            <CheckCircle2 className="mr-1.5 inline size-4 align-text-bottom" />
            <strong>Shipped.</strong> This feature completed the full delivery
            loop — every stage is browsable read-only.
          </p>
        </div>
      ) : (
        <div className="app-closed-banner">
          <p className="app-next-action-hint">
            <CircleSlash className="mr-1.5 inline size-4 align-text-bottom" />
            <strong>
              Closed —{" "}
              {status === "DECLINED_DUPLICATE"
                ? "declined as a duplicate"
                : "rejected"}
              .
            </strong>{" "}
            This request left the pipeline and won't move forward.
          </p>
        </div>
      )}

      {children}
    </div>
  );
}
