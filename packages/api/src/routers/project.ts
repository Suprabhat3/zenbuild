import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

/** Project key: short uppercase slug used to namespace work (e.g. "WEB"). */
const projectKeySchema = z
  .string()
  .trim()
  .min(2, "Key must be at least 2 characters.")
  .max(10, "Key must be at most 10 characters.")
  .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only.")
  .transform((v) => v.toUpperCase());

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(80, "Name is too long.");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description is too long.")
  .optional();

/**
 * Projects group an org's feature requests and repositories. Reads are org-scoped
 * via `orgProcedure`; create/update are open to any member, delete is restricted
 * to owners/admins. Soft-delete (`deletedAt`) preserves history and the unique
 * `(organizationId, key)` constraint is enforced against live rows.
 */
export const projectRouter = createTRPCRouter({
  list: orgProcedure.query(async ({ ctx }) => {
    const projects = await ctx.db.project.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { featureRequests: true, repositories: true } },
      },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      createdAt: p.createdAt,
      featureRequestCount: p._count.featureRequests,
      repositoryCount: p._count.repositories,
    }));
  }),

  byId: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          _count: { select: { featureRequests: true, repositories: true } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      }

      return {
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        featureRequestCount: project._count.featureRequests,
        repositoryCount: project._count.repositories,
      };
    }),

  create: orgProcedure
    .input(
      z.object({
        name: nameSchema,
        key: projectKeySchema,
        description: descriptionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Reject keys that collide with a live project (a soft-deleted project may
      // still hold the row, so check liveness explicitly).
      const clash = await ctx.db.project.findFirst({
        where: {
          organizationId: ctx.organizationId,
          key: input.key,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (clash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A project with key "${input.key}" already exists.`,
        });
      }

      const project = await ctx.db.$transaction(async (tx) => {
        // The DB unique constraint covers soft-deleted rows too; if a key was
        // previously used and soft-deleted, free it by suffixing the dead row.
        const dead = await tx.project.findUnique({
          where: {
            organizationId_key: {
              organizationId: ctx.organizationId,
              key: input.key,
            },
          },
          select: { id: true, deletedAt: true },
        });
        if (dead?.deletedAt) {
          await tx.project.update({
            where: { id: dead.id },
            data: { key: `${input.key}-${dead.id.slice(0, 6)}` },
          });
        }

        const created = await tx.project.create({
          data: {
            organizationId: ctx.organizationId,
            name: input.name,
            key: input.key,
            description: input.description,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "project.create",
            entityType: "project",
            entityId: created.id,
            metadata: { name: created.name, key: created.key },
          },
        });
        return created;
      });

      return { id: project.id, key: project.key };
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string(),
        name: nameSchema.optional(),
        description: descriptionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.project.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      }

      await ctx.db.project.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
        },
      });

      return { id: input.id };
    }),

  delete: requireRole("owner", "admin")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.project.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true, name: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: input.id },
          data: { deletedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "project.delete",
            entityType: "project",
            entityId: input.id,
            metadata: { name: existing.name },
          },
        });
      });

      return { id: input.id };
    }),
});
