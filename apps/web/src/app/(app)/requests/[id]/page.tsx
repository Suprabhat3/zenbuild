import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { DiscoveryPanel, type ClarificationMessageView } from "@/components/app/discovery-panel";
import { FixNeededPanel } from "@/components/app/fix-needed-panel";
import { PlanningPanel } from "@/components/app/planning-panel";
import { ReleasePanel } from "@/components/app/release-panel";
import { ReviewPanel } from "@/components/app/review-panel";
import { PrdEditor, type PrdContent } from "@/components/app/prd-editor";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type FeatureRequestStatus } from "@/lib/feature-request";
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

        <ReleasePanel featureRequestId={request.id} status={status} />
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
            <div className="mt-3 flex flex-col gap-1.5">
              {request._count.tasks > 0 && (
                <Link
                  href={`/feature-requests/${request.id}/board`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Open the task board →
                </Link>
              )}
              {request._count.reviews > 0 && (
                <Link
                  href={`/feature-requests/${request.id}/reviews`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  View review history →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {request.rawPayload != null && (
          <Card>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm font-semibold">
                  Original intake payload
                </summary>
                <p className="text-muted-foreground mt-1 mb-2 text-xs">
                  Raw payload received via the intake webhook, kept for
                  traceability.
                </p>
                <pre className="app-code">
                  {JSON.stringify(request.rawPayload, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}
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
