import type { Metadata } from "next";

import { ReleaseApprovalView } from "@/components/app/release-approval-view";
import { StageLocked } from "@/components/app/stage-locked";
import { Badge } from "@/components/ui/badge";
import { type FeatureRequestStatus } from "@/lib/feature-request";
import { requireFeatureRequest } from "@/server/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Ship · ZenBuild" };
export const dynamic = "force-dynamic";

const OPEN_STATUSES: FeatureRequestStatus[] = [
  "IN_REVIEW",
  "APPROVED",
  "SHIPPED",
  "REJECTED",
];

/**
 * Ship stage: the AI readiness assessment and the human ship/reject decision —
 * the final gate of the pipeline. Only an explicit human approval ships.
 */
export default async function ShipStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await requireFeatureRequest(id);
  const status = request.status as FeatureRequestStatus;

  if (!OPEN_STATUSES.includes(status)) {
    return (
      <StageLocked
        title="The ship decision isn't open yet"
        description="Once AI review passes with no blocking issues, the readiness assessment and the human ship/reject decision appear here."
        action={{ href: `/requests/${id}`, label: "Go to the current stage" }}
      />
    );
  }

  const [summary, activeOrg] = await Promise.all([
    api.release.summary({ featureRequestId: id }),
    api.viewer.activeOrganization(),
  ]);
  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {summary.prd && (
          <Badge variant="outline">PRD v{summary.prd.version}</Badge>
        )}
        <p className="text-muted-foreground text-sm">
          The AI readiness verdict, PRD coverage, outstanding issues, and linked
          pull requests — only an explicit human approval can ship this.
        </p>
      </div>

      <ReleaseApprovalView
        featureRequestId={id}
        canApprove={canApprove}
        initialData={summary}
      />
    </div>
  );
}
