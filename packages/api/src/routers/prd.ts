import { TRPCError } from "@trpc/server";
import {
  PrdSchema,
  PrdSectionKeySchema,
  regeneratePrdSection,
  renderPrdMarkdown,
  type Prd,
} from "@zenbuild/ai";
import { z } from "zod";

import { guardWorkflowCredits } from "../lib/billingGuards";
import { triggerPrdGeneration } from "../lib/discovery";
import { loadRequestContext } from "../lib/prdContext";
import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

/** States from which a PRD may be (re)generated. */
const PRD_GENERATABLE = ["CLARIFYING", "PRD_DRAFTED"] as const;

/**
 * Loads a PRD scoped through its parent feature request so tenant isolation is
 * enforced on every PRD operation. Throws NOT_FOUND if either is missing.
 */
async function loadPrdForEdit(
  db: Parameters<typeof loadRequestContext>[0],
  args: { featureRequestId: string; organizationId: string },
) {
  const fr = await db.featureRequest.findFirst({
    where: { id: args.featureRequestId, organizationId: args.organizationId },
    select: { id: true, status: true },
  });
  if (!fr) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
  }

  const prd = await db.prd.findUnique({
    where: { featureRequestId: fr.id },
    select: { id: true, version: true, content: true, approvedAt: true },
  });
  if (!prd) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No PRD has been generated yet." });
  }

  return { fr, prd };
}

/**
 * PRD reads, async generation, and the Phase-5 human review surface: section-
 * based editing (every save snapshots a new version), AI section regeneration,
 * version history + restore, and role-gated approval. Approval (PRD_DRAFTED →
 * PRD_APPROVED) gates planning in Phase 6 and is audit-logged.
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
          approvedById: true,
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

      await guardWorkflowCredits(ctx.db, ctx.organizationId, "PRD_GENERATE");

      const run = await triggerPrdGeneration(ctx.db, {
        organizationId: ctx.organizationId,
        featureRequestId: fr.id,
        actorId: ctx.user.id,
      });
      return { workflowRunId: run.id };
    }),

  /**
   * Persists a human-edited PRD. Every save bumps the version and writes a
   * PrdVersion snapshot (full editable history). Editing is blocked once the PRD
   * is approved — re-open by regenerating only happens before approval.
   */
  update: orgProcedure
    .input(z.object({ featureRequestId: z.string(), content: PrdSchema }))
    .mutation(async ({ ctx, input }) => {
      const { prd } = await loadPrdForEdit(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      if (prd.approvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This PRD is approved and locked. It cannot be edited.",
        });
      }

      const version = prd.version + 1;
      const markdown = renderPrdMarkdown(input.content);

      await ctx.db.$transaction(async (tx) => {
        await tx.prd.update({
          where: { id: prd.id },
          data: { version, content: input.content, markdown },
        });
        await tx.prdVersion.create({
          data: { prdId: prd.id, version, content: input.content, markdown },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "prd.edit",
            entityType: "feature_request",
            entityId: input.featureRequestId,
            metadata: { version },
          },
        });
      });

      return { version };
    }),

  /**
   * Regenerates a single PRD section with the AI, grounded in the current PRD and
   * the original request. Returns the proposed value for the reviewer to accept
   * and save — it does NOT persist, so versioning stays tied to explicit saves.
   * The regeneration (and its token usage) is audit-logged for cost visibility.
   */
  regenerateSection: orgProcedure
    .input(
      z.object({
        featureRequestId: z.string(),
        section: PrdSectionKeySchema,
        instruction: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { prd } = await loadPrdForEdit(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      if (prd.approvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This PRD is approved and locked. It cannot be edited.",
        });
      }

      const requestContext = await loadRequestContext(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      if (!requestContext) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }

      const current = PrdSchema.parse(prd.content);
      let result;
      try {
        result = await regeneratePrdSection(input.section, {
          ctx: requestContext,
          current,
          instruction: input.instruction,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? `Section regeneration failed: ${err.message}`
              : "Section regeneration failed.",
        });
      }

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorId: ctx.user.id,
          action: "prd.section.regenerate",
          entityType: "feature_request",
          entityId: input.featureRequestId,
          metadata: {
            section: input.section,
            model: result.model,
            usage: result.usage,
          },
        },
      });

      return { section: input.section, value: result.value };
    }),

  /** Full version history (newest first) for the version-history viewer. */
  versions: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }

      const prd = await ctx.db.prd.findUnique({
        where: { featureRequestId: fr.id },
        select: { id: true, version: true },
      });
      if (!prd) return [];

      const versions = await ctx.db.prdVersion.findMany({
        where: { prdId: prd.id },
        orderBy: { version: "desc" },
        select: { version: true, content: true, markdown: true, createdAt: true },
      });

      return versions.map((v) => ({
        version: v.version,
        content: v.content,
        markdown: v.markdown,
        createdAt: v.createdAt,
        isCurrent: v.version === prd.version,
      }));
    }),

  /**
   * Restores a previous version by copying its content forward as a new version
   * (history stays append-only). Blocked once the PRD is approved.
   */
  restoreVersion: orgProcedure
    .input(z.object({ featureRequestId: z.string(), version: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { prd } = await loadPrdForEdit(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      if (prd.approvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This PRD is approved and locked. It cannot be edited.",
        });
      }

      const snapshot = await ctx.db.prdVersion.findUnique({
        where: { prdId_version: { prdId: prd.id, version: input.version } },
        select: { content: true },
      });
      if (!snapshot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That version does not exist." });
      }

      const content = PrdSchema.parse(snapshot.content);
      const markdown = renderPrdMarkdown(content);
      const version = prd.version + 1;

      await ctx.db.$transaction(async (tx) => {
        await tx.prd.update({
          where: { id: prd.id },
          data: { version, content, markdown },
        });
        await tx.prdVersion.create({
          data: { prdId: prd.id, version, content, markdown },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "prd.restore",
            entityType: "feature_request",
            entityId: input.featureRequestId,
            metadata: { restoredFrom: input.version, version },
          },
        });
      });

      return { version };
    }),

  /**
   * Approves the PRD: PRD_DRAFTED → PRD_APPROVED. Role-gated (owner/admin),
   * audit-logged, and stamps approver + timestamp. Approval unlocks Phase 6
   * (task generation) and locks further PRD editing.
   */
  approve: requireRole("owner", "admin")
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { fr, prd } = await loadPrdForEdit(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      if (prd.approvedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This PRD is already approved." });
      }
      if (fr.status !== "PRD_DRAFTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve a PRD while the request is in ${fr.status}.`,
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.prd.update({
          where: { id: prd.id },
          data: { approvedAt: new Date(), approvedById: ctx.user.id },
        });
        await tx.featureRequest.update({
          where: { id: fr.id },
          data: { status: "PRD_APPROVED" },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "prd.approve",
            entityType: "feature_request",
            entityId: input.featureRequestId,
            metadata: { version: prd.version },
          },
        });
      });

      return { approved: true };
    }),
});

// Re-exported for callers/tests that need the structured PRD shape.
export type { Prd };
