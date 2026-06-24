import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { triggerClarification } from "../lib/discovery";
import { createTRPCRouter, orgProcedure } from "../trpc";

/** States from which discovery may (re)start clarification. */
const CLARIFIABLE = ["DRAFT", "CLARIFYING"] as const;

/**
 * Drives the clarification loop. `start` kicks off the agent; `answer` records
 * the requester's reply and re-runs the agent so it can decide ASK / EDUCATE /
 * PROCEED again with the new context. All work happens async in Inngest; the UI
 * polls `workflowRun.latest`.
 */
export const clarificationRouter = createTRPCRouter({
  start: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }
      if (!CLARIFIABLE.includes(fr.status as (typeof CLARIFIABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot clarify a request in ${fr.status}.`,
        });
      }

      const run = await triggerClarification(ctx.db, {
        organizationId: ctx.organizationId,
        featureRequestId: fr.id,
        actorId: ctx.user.id,
      });
      return { workflowRunId: run.id };
    }),

  answer: orgProcedure
    .input(
      z.object({
        featureRequestId: z.string(),
        content: z
          .string()
          .trim()
          .min(1, "Write an answer first.")
          .max(5000, "Answer is too long."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }
      if (!CLARIFIABLE.includes(fr.status as (typeof CLARIFIABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request is past the clarification stage.",
        });
      }

      await ctx.db.clarificationMessage.create({
        data: {
          featureRequestId: fr.id,
          role: "USER",
          content: input.content,
        },
      });

      const run = await triggerClarification(ctx.db, {
        organizationId: ctx.organizationId,
        featureRequestId: fr.id,
        actorId: ctx.user.id,
      });
      return { workflowRunId: run.id };
    }),
});
