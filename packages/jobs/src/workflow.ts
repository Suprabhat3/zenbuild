import { meterWorkflowRun } from "@zenbuild/billing";
import { db } from "@zenbuild/db";
import type { Prisma } from "@zenbuild/db";

/**
 * Helpers for keeping a `WorkflowRun` row in sync with an Inngest run so the UI
 * can show live progress. Each is a single DB write meant to be wrapped in an
 * Inngest `step.run(...)` for durability/idempotency.
 */

export async function markRunning(
  workflowRunId: string,
  inngestRunId: string | null,
  step: string,
) {
  await db.workflowRun.update({
    where: { id: workflowRunId },
    data: {
      status: "RUNNING",
      inngestRunId: inngestRunId ?? undefined,
      step,
      progress: 5,
      startedAt: new Date(),
      error: null,
    },
  });
}

export async function updateProgress(
  workflowRunId: string,
  progress: number,
  step: string,
) {
  await db.workflowRun.update({
    where: { id: workflowRunId },
    data: { progress, step },
  });
}

export async function markCompleted(
  workflowRunId: string,
  output: Prisma.InputJsonValue,
) {
  // Mark complete and meter credits together: a successful AI run is the single
  // point at which the org is charged, so failed/abandoned runs cost nothing.
  // `meterWorkflowRun` is idempotent on the run id, so a step replay is safe.
  await db.$transaction(async (tx) => {
    const run = await tx.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        status: "COMPLETED",
        progress: 100,
        step: "Done",
        output,
        finishedAt: new Date(),
      },
      select: { id: true, type: true, organizationId: true },
    });
    await meterWorkflowRun(tx, run);
  });
}

export async function markFailed(workflowRunId: string, error: string) {
  await db.workflowRun.update({
    where: { id: workflowRunId },
    data: {
      status: "FAILED",
      step: "Failed",
      error,
      finishedAt: new Date(),
    },
  });
}
