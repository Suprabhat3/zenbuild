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
 * Live status for async workflows, polled by the UI. `latest` returns the most
 * recent run for a feature request (optionally filtered by type) so a panel can
 * show progress/step/error while an Inngest function executes.
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
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          step: true,
          error: true,
          createdAt: true,
          finishedAt: true,
        },
      });
      return run;
    }),
});
