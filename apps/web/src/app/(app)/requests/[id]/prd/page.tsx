import type { Metadata } from "next";

import { PrdEditor, type PrdContent } from "@/components/app/prd-editor";
import { StageLocked } from "@/components/app/stage-locked";
import { type FeatureRequestStatus } from "@/lib/feature-request";
import { requireFeatureRequest } from "@/server/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "PRD · ZenBuild" };
export const dynamic = "force-dynamic";

/**
 * PRD stage: the drafted requirements document — editable until approved,
 * with section regeneration, version history/restore, and the approval gate.
 */
export default async function PrdStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await requireFeatureRequest(id);
  const [prd, activeOrg] = await Promise.all([
    api.prd.get({ featureRequestId: id }),
    api.viewer.activeOrganization(),
  ]);
  const status = request.status as FeatureRequestStatus;

  if (!prd) {
    return (
      <StageLocked
        title="No PRD yet"
        description="The PRD is drafted from the discovery conversation. Finish clarifying the request, then generate the PRD."
        action={{ href: `/requests/${id}/discovery`, label: "Go to Discovery" }}
      />
    );
  }

  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";

  return (
    <PrdEditor
      featureRequestId={request.id}
      content={prd.content as unknown as PrdContent}
      version={prd.version}
      approvedAt={prd.approvedAt}
      status={status}
      canApprove={canApprove}
    />
  );
}
