import type { PrismaClient } from "@zenbuild/db";
import { inngest, releaseReadinessRequested } from "@zenbuild/jobs";

/**
 * Kicks off an AI release-readiness assessment for a feature request. Creates the
 * `WorkflowRun` row first (intent is never lost if Inngest is unreachable) then
 * emits the Inngest event, correlated by `workflowRunId`.
 */
export async function triggerReleaseReadiness(
  db: PrismaClient,
  args: { organizationId: string; featureRequestId: string; actorId: string },
) {
  const { organizationId, featureRequestId, actorId } = args;

  const run = await db.workflowRun.create({
    data: {
      type: "RELEASE_READINESS",
      status: "QUEUED",
      organizationId,
      featureRequestId,
      input: { featureRequestId, triggeredBy: actorId },
    },
  });

  await inngest.send(
    releaseReadinessRequested.create({
      organizationId,
      featureRequestId,
      workflowRunId: run.id,
      triggeredBy: actorId,
    }),
  );

  return run;
}
