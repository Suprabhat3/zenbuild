import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { DiscoveryPanel, type ClarificationMessageView } from "@/components/app/discovery-panel";
import { FixNeededPanel } from "@/components/app/fix-needed-panel";
import { PlanningPanel } from "@/components/app/planning-panel";
import { ReviewPanel } from "@/components/app/review-panel";
import { PrdEditor, type PrdContent } from "@/components/app/prd-editor";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Feature Request · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function FeatureRequestDetailPage({
  params,
}: {
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

  const [prd, activeOrg] = await Promise.all([
    api.prd.get({ featureRequestId: id }),
    api.viewer.activeOrganization(),
  ]);
  const status = request.status as FeatureRequestStatus;
  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";

  const messages: ClarificationMessageView[] = request.clarifications.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    metadata: (m.metadata as ClarificationMessageView["metadata"]) ?? null,
    createdAt: m.createdAt,
  }));

  return (
    <div className="space-y-8">
      <Link href="/feature-requests" className="app-back-link">
        <ArrowLeft className="size-4" />
        Feature requests
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[status]}>
            {STATUS_LABELS[status]}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {SOURCE_LABELS[request.source] ?? request.source} ·{" "}
            {PRIORITY_LABELS[request.priority] ?? request.priority} priority
          </span>
        </div>
        <h1 className="app-page-title">{request.title}</h1>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {request.requesterName && <span>From {request.requesterName}</span>}
          {request.requesterEmail && <span>{request.requesterEmail}</span>}
          {request.project && (
            <Link
              href={`/projects/${request.project.id}`}
              className="font-medium text-primary hover:underline"
            >
              Project: {request.project.name} ({request.project.key})
            </Link>
          )}
        </div>
      </header>

      <div className="app-detail-grid">
        <div className="space-y-6">
          <FixNeededPanel featureRequestId={request.id} status={status} />

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {request.description}
              </p>
            </CardContent>
          </Card>

          <DiscoveryPanel
            featureRequestId={request.id}
            status={status}
            messages={messages}
            hasPrd={Boolean(prd)}
          />

          {prd && (
            <PrdEditor
              featureRequestId={request.id}
              content={prd.content as unknown as PrdContent}
              version={prd.version}
              approvedAt={prd.approvedAt}
              status={status}
              canApprove={canApprove}
            />
          )}

          <PlanningPanel
            featureRequestId={request.id}
            status={status}
            taskCount={request._count.tasks}
          />

          <ReviewPanel featureRequestId={request.id} status={status} />
        </div>

        <div className="space-y-6">
          <Card className="app-meta-card">
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaRow label="PRD" value={request.prd ? `v${request.prd.version}` : "—"} />
              <MetaRow label="Tasks" value={String(request._count.tasks)} />
              <MetaRow
                label="Pull requests"
                value={String(request._count.pullRequests)}
              />
              <MetaRow label="Reviews" value={String(request._count.reviews)} />
            </CardContent>
          </Card>

          {request.rawPayload != null && (
            <Card>
              <CardHeader>
                <CardTitle>Inbound payload</CardTitle>
                <CardDescription>
                  Original payload received via the intake webhook.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="app-code">
                  {JSON.stringify(request.rawPayload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-meta-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
