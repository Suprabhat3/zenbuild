import { z } from "zod";

import { createTRPCRouter, orgProcedure } from "../trpc";

const WORKFLOW_TYPES = [
  "CLARIFY",
  "PRD_GENERATE",
  "TASKS_GENERATE",
  "REPO_ANALYZE",
  "TASK_IMPLEMENT",
  "PR_REVIEW",
  "RELEASE_READINESS",
] as const;

/**
 * A run that has sat in QUEUED this long was never picked up by a worker
 * (Inngest offline or the app not synced). Inngest itself acks within
 * seconds, so two minutes is far past any healthy queue delay.
 */
const STUCK_QUEUED_MS = 2 * 60 * 1000;

const RUN_SELECT = {
  id: true,
  type: true,
  status: true,
  progress: true,
  step: true,
  error: true,
  createdAt: true,
  finishedAt: true,
} as const;

/**
 * Live status for async workflows, polled by the UI. `latest` returns the most
 * recent run for a feature request (optionally filtered by type) so a panel can
 * show progress/step/error while an Inngest function executes.
 *
 * Watchdog: a run still QUEUED after {@link STUCK_QUEUED_MS} is marked FAILED
 * here, self-healing on the next poll — the UI must never spin forever on a
 * job no worker will ever execute.
 */
export const workflowRunRouter = createTRPCRouter({
  latest: orgProcedure
    .input(
      z.object({
        featureRequestId: z.string(),
        type: z.enum(WORKFLOW_TYPES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.workflowRun.findFirst({
        where: {
          organizationId: ctx.organizationId,
          featureRequestId: input.featureRequestId,
          ...(input.type ? { type: input.type } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: RUN_SELECT,
      });

      if (
        run &&
        run.status === "QUEUED" &&
        Date.now() - run.createdAt.getTime() > STUCK_QUEUED_MS
      ) {
        return ctx.db.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            step: "Failed",
            error:
              "The background worker never picked this job up. Make sure Inngest is running and synced with the app (locally: `npx inngest-cli@latest dev` alongside `pnpm dev`), then try again.",
            finishedAt: new Date(),
          },
          select: RUN_SELECT,
        });
      }

      return run;
    }),
});
