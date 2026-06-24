import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { triggerPrdGeneration } from "../lib/discovery";
import { createTRPCRouter, orgProcedure } from "../trpc";

/** States from which a PRD may be (re)generated. */
const PRD_GENERATABLE = ["CLARIFYING", "PRD_DRAFTED"] as const;

/**
 * PRD reads + async generation. Generation is gated to requests that have at
 * least entered clarification (so the agent has run once). Editing/approval land
 * in Phase 5; here we expose the generated document and its version history.
 */
export const prdRouter = createTRPCRouter({
  get: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Scope through the parent request to enforce tenant isolation.
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }

      const prd = await ctx.db.prd.findUnique({
        where: { featureRequestId: fr.id },
        select: {
          id: true,
          version: true,
          content: true,
          markdown: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return prd;
    }),

  generate: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }
      if (!PRD_GENERATABLE.includes(fr.status as (typeof PRD_GENERATABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot generate a PRD from ${fr.status}. Run clarification first.`,
        });
      }

      const run = await triggerPrdGeneration(ctx.db, {
        organizationId: ctx.organizationId,
        featureRequestId: fr.id,
        actorId: ctx.user.id,
      });
      return { workflowRunId: run.id };
    }),
});
