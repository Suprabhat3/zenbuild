import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createFeatureRequest } from "../lib/intake";
import { createTRPCRouter, orgProcedure } from "../trpc";

const sourceSchema = z.enum(["FORM", "EMAIL", "TICKET", "CALL", "API"]);
const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const FEATURE_REQUEST_STATUSES = [
  "DRAFT",
  "CLARIFYING",
  "PRD_DRAFTED",
  "PRD_APPROVED",
  "TASKS_READY",
  "IN_DEVELOPMENT",
  "IN_REVIEW",
  "FIX_NEEDED",
  "APPROVED",
  "SHIPPED",
  "REJECTED",
  "DECLINED_DUPLICATE",
] as const;

const statusSchema = z.enum(FEATURE_REQUEST_STATUSES);

/**
 * Feature requests are the entry point of the core loop. Reads are org-scoped via
 * `orgProcedure`; creation goes through the shared `createFeatureRequest` helper
 * (the same path the inbound webhook uses). Later phases mutate status as the
 * request moves through clarification → PRD → tasks → review → ship.
 */
export const featureRequestRouter = createTRPCRouter({
  list: orgProcedure
    .input(
      z
        .object({
          status: statusSchema.optional(),
          projectId: z.string().nullable().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const requests = await ctx.db.featureRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.projectId !== undefined
            ? { projectId: input.projectId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true, key: true } },
        },
      });

      return requests.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        source: r.source,
        priority: r.priority,
        requesterName: r.requesterName,
        createdAt: r.createdAt,
        project: r.project,
      }));
    }),

  byId: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.featureRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: {
          project: { select: { id: true, name: true, key: true } },
          clarifications: { orderBy: { createdAt: "asc" } },
          prd: { select: { id: true, version: true, approvedAt: true } },
          _count: { select: { tasks: true, pullRequests: true, reviews: true } },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature request not found.",
        });
      }

      return request;
    }),

  create: orgProcedure
    .input(
      z.object({
        title: z
          .string()
          .trim()
          .min(3, "Title must be at least 3 characters.")
          .max(160, "Title is too long."),
        description: z
          .string()
          .trim()
          .min(10, "Describe the request in a little more detail.")
          .max(10000, "Description is too long."),
        source: sourceSchema.default("FORM"),
        priority: prioritySchema.default("MEDIUM"),
        requesterName: z.string().trim().max(120).optional(),
        requesterEmail: z.email("Enter a valid email.").optional().or(z.literal("")),
        projectId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If a project is specified, confirm it belongs to this org and is live.
      if (input.projectId) {
        const project = await ctx.db.project.findFirst({
          where: {
            id: input.projectId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!project) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected project does not exist.",
          });
        }
      }

      const created = await createFeatureRequest(ctx.db, {
        organizationId: ctx.organizationId,
        actorId: ctx.user.id,
        payload: {
          title: input.title,
          description: input.description,
          source: input.source,
          priority: input.priority,
          requesterName: input.requesterName || null,
          requesterEmail: input.requesterEmail || null,
          projectId: input.projectId ?? null,
        },
      });

      return { id: created.id };
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string(),
        title: z
          .string()
          .trim()
          .min(3, "Title must be at least 3 characters.")
          .max(160, "Title is too long."),
        description: z
          .string()
          .trim()
          .min(10, "Describe the request in a little more detail.")
          .max(10000, "Description is too long."),
        priority: prioritySchema,
        projectId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.featureRequest.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature request not found.",
        });
      }
      // Closed requests are a decision record; reopen by creating a new
      // request instead of rewriting history.
      if (
        existing.status === "SHIPPED" ||
        existing.status === "REJECTED" ||
        existing.status === "DECLINED_DUPLICATE"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request is closed and can no longer be edited.",
        });
      }

      if (input.projectId) {
        const project = await ctx.db.project.findFirst({
          where: {
            id: input.projectId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!project) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected project does not exist.",
          });
        }
      }

      const updated = await ctx.db.$transaction(async (tx) => {
        const request = await tx.featureRequest.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            description: input.description,
            priority: input.priority,
            projectId: input.projectId,
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "featureRequest.update",
            entityType: "featureRequest",
            entityId: request.id,
            metadata: { title: input.title },
          },
        });
        return request;
      });

      return { id: updated.id };
    }),
});
