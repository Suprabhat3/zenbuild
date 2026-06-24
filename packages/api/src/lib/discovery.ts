import type { PrismaClient, WorkflowType } from "@zenbuild/db";
import {
  clarifyRequested,
  inngest,
  prdRequested,
  tasksRequested,
} from "@zenbuild/jobs";

/**
 * Kicks off an async product-discovery workflow: creates a `WorkflowRun` row
 * (QUEUED) for in-app progress, then emits the matching Inngest event. The two
 * are correlated by `workflowRunId` so the function can drive the run's status.
 *
 * The WorkflowRun is created first and the event is sent after — if Inngest is
 * unreachable (e.g. dev server not running) the run simply stays QUEUED and the
 * error surfaces to the caller, rather than losing the audit trail of the intent.
 */
async function triggerDiscovery(
  db: PrismaClient,
  args: {
    type: Extract<WorkflowType, "CLARIFY" | "PRD_GENERATE" | "TASKS_GENERATE">;
    organizationId: string;
    featureRequestId: string;
    actorId: string;
  },
) {
  const { type, organizationId, featureRequestId, actorId } = args;

  const run = await db.workflowRun.create({
    data: {
      type,
      status: "QUEUED",
      organizationId,
      featureRequestId,
      input: { featureRequestId, triggeredBy: actorId },
    },
  });

  const payload = {
    featureRequestId,
    organizationId,
    workflowRunId: run.id,
    triggeredBy: actorId,
  };
  const event =
    type === "CLARIFY"
      ? clarifyRequested.create(payload)
      : type === "PRD_GENERATE"
        ? prdRequested.create(payload)
        : tasksRequested.create(payload);

  await inngest.send(event);

  return run;
}

export function triggerClarification(
  db: PrismaClient,
  args: { organizationId: string; featureRequestId: string; actorId: string },
) {
  return triggerDiscovery(db, { ...args, type: "CLARIFY" });
}

export function triggerPrdGeneration(
  db: PrismaClient,
  args: { organizationId: string; featureRequestId: string; actorId: string },
) {
  return triggerDiscovery(db, { ...args, type: "PRD_GENERATE" });
}

export function triggerTaskGeneration(
  db: PrismaClient,
  args: { organizationId: string; featureRequestId: string; actorId: string },
) {
  return triggerDiscovery(db, { ...args, type: "TASKS_GENERATE" });
}
