import type { Metadata } from "next";

import { KanbanBoard } from "@/components/app/kanban-board";
import { PlanningPanel } from "@/components/app/planning-panel";
import { StageLocked } from "@/components/app/stage-locked";
import {
  STATUS_STAGE_INDEX,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { requireFeatureRequest } from "@/server/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Plan · ZenBuild" };
export const dynamic = "force-dynamic";

/**
 * Plan stage: generate the task plan from the approved PRD, then manage it on
 * the Kanban board and approve it to enter development. The board's only home.
 */
export default async function PlanStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await requireFeatureRequest(id);
  const status = request.status as FeatureRequestStatus;
  const hasTasks = request._count.tasks > 0;

  // Planning opens once the PRD gate has passed (stage index 3 = Plan).
  if (!hasTasks && STATUS_STAGE_INDEX[status] < 3) {
    return (
      <StageLocked
        title="Tasks are generated after the PRD is approved"
        description="Once you approve the PRD, the AI engineering lead breaks it into an ordered, build-ready plan you can edit on the board."
        action={{ href: `/requests/${id}/prd`, label: "Go to PRD" }}
      />
    );
  }

  const [board, activeOrg] = await Promise.all([
    api.task.board({ featureRequestId: id }),
    api.viewer.activeOrganization(),
  ]);
  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";

  return (
    <div className="space-y-4">
      {!hasTasks ? (
        <PlanningPanel featureRequestId={id} status={status} />
      ) : (
        <>
          <p className="app-page-lede">
            Engineering plan — drag tasks across columns, edit details, assign
            owners, and approve the plan to enter development.
          </p>
          <KanbanBoard
            featureRequestId={id}
            initialData={board}
            canApprove={canApprove}
          />
        </>
      )}
    </div>
  );
}
