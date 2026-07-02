import { db } from "@zenbuild/db";
import type { InngestFunction } from "inngest";

import { inngest } from "../client";

/** A run still QUEUED after this long lost its event (or the worker never picked it up). */
const QUEUED_TTL_MS = 15 * 60 * 1000;
/** Generous ceiling: the longest function (task implement) finishes well within this, retries included. */
const RUNNING_TTL_MS = 60 * 60 * 1000;

/**
 * Safety net for `WorkflowRun` liveness. Rows are created QUEUED before the
 * Inngest event is sent and moved along by the functions themselves; if an event
 * is lost or a worker dies between `markRunning` and `markCompleted`, the row
 * would otherwise sit QUEUED/RUNNING forever — a phantom "in-flight" run on the
 * dashboard and a poll that never settles. This cron fails anything stuck past
 * its TTL so the UI shows a retryable error instead. Credits are only metered on
 * `markCompleted`, so failing a stale run never charges the org.
 */
export const workflowReconcileFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "workflow-reconcile",
    name: "Reconcile stuck workflow runs",
    retries: 1,
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("fail-stuck-runs", async () => {
      const now = Date.now();
      const failedData = {
        status: "FAILED",
        step: "Failed",
        finishedAt: new Date(),
      } as const;

      const queued = await db.workflowRun.updateMany({
        where: {
          status: "QUEUED",
          createdAt: { lt: new Date(now - QUEUED_TTL_MS) },
        },
        data: {
          ...failedData,
          error:
            "The workflow was queued but never picked up by the background job service. Please try again.",
        },
      });

      const running = await db.workflowRun.updateMany({
        where: {
          status: "RUNNING",
          startedAt: { lt: new Date(now - RUNNING_TTL_MS) },
        },
        data: {
          ...failedData,
          error:
            "The workflow stopped reporting progress and was marked as failed. Please try again.",
        },
      });

      return { queuedFailed: queued.count, runningFailed: running.count };
    });

    return { ok: true, ...result };
  },
);
