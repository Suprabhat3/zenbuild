import type { PrismaClient } from "@zenbuild/db";

import { inngest } from "./client";

type WorkflowEvent = Parameters<typeof inngest.send>[0];

/**
 * Sends the Inngest event that drives a just-created `WorkflowRun`. If the send
 * fails (Inngest unreachable/misconfigured), the run is marked FAILED instead of
 * stranding forever in QUEUED — a QUEUED row with no event behind it would show
 * as a phantom in-flight run that the UI polls indefinitely. The original send
 * error is rethrown so the caller can surface it.
 */
export async function sendWorkflowEvent(
  db: Pick<PrismaClient, "workflowRun">,
  workflowRunId: string,
  event: WorkflowEvent,
): Promise<void> {
  try {
    await inngest.send(event);
  } catch (err) {
    await db.workflowRun
      .update({
        where: { id: workflowRunId },
        data: {
          status: "FAILED",
          step: "Failed",
          error:
            "Could not queue the workflow — the background job service is unreachable. Please try again.",
          finishedAt: new Date(),
        },
      })
      .catch(() => {
        // Best effort: the send failure is the error worth surfacing.
      });
    throw err;
  }
}
