import { TRPCError } from "@trpc/server";
import { rankBetween } from "@zenbuild/db";
import { z } from "zod";

import { triggerTaskGeneration } from "../lib/discovery";
import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const taskStatusSchema = z.enum(TASK_STATUSES);
const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

/** States from which the AI may (re)generate the task plan. */
const GENERATABLE = ["PRD_APPROVED", "TASKS_READY"] as const;
/** States in which the board may be edited (planning + active development). */
const BOARD_EDITABLE = ["TASKS_READY", "IN_DEVELOPMENT"] as const;

/** Coerces a Prisma `Json` column we control into a clean string[]. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Loads a feature request scoped to the active org so every task operation is
 * tenant-isolated. Throws NOT_FOUND if it doesn't belong to the caller's org.
 */
async function loadFeatureRequest(
  db: Parameters<typeof triggerTaskGeneration>[0],
  args: { featureRequestId: string; organizationId: string },
) {
  const fr = await db.featureRequest.findFirst({
    where: { id: args.featureRequestId, organizationId: args.organizationId },
    select: { id: true, status: true },
  });
  if (!fr) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
  }
  return fr;
}

/** Loads a single task, enforcing it belongs to a request in the active org. */
async function loadTask(
  db: Parameters<typeof triggerTaskGeneration>[0],
  args: { taskId: string; organizationId: string },
) {
  const task = await db.task.findFirst({
    where: {
      id: args.taskId,
      featureRequest: { organizationId: args.organizationId },
    },
    select: {
      id: true,
      status: true,
      rank: true,
      featureRequestId: true,
      featureRequest: { select: { status: true } },
    },
  });
  if (!task) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  }
  return task;
}

function assertBoardEditable(status: string) {
  if (!BOARD_EDITABLE.includes(status as (typeof BOARD_EDITABLE)[number])) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The board cannot be edited while the request is in ${status}.`,
    });
  }
}

/**
 * Phase-6 planning surface: turns an approved PRD into engineering tasks
 * (async, via Inngest), exposes a Kanban board (org-scoped), supports manual
 * task CRUD + drag-ordering (lexorank) + assignment, and role-gated plan
 * approval (TASKS_READY → IN_DEVELOPMENT). All reads/writes are tenant-isolated
 * through the parent feature request.
 */
export const taskRouter = createTRPCRouter({
  /** Full board: ordered tasks (+ dependency labels), assignable members, state. */
  board: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fr = await loadFeatureRequest(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });

      const [tasks, members] = await Promise.all([
        ctx.db.task.findMany({
          where: { featureRequestId: fr.id },
          orderBy: { rank: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            acceptanceCriteria: true,
            status: true,
            priority: true,
            estimate: true,
            rank: true,
            suggestedAreas: true,
            assigneeId: true,
            createdAt: true,
            dependsOn: { select: { dependencyId: true } },
          },
        }),
        ctx.db.member.findMany({
          where: { organizationId: ctx.organizationId },
          orderBy: { createdAt: "asc" },
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        }),
      ]);

      const titleById = new Map(tasks.map((t) => [t.id, t.title]));

      return {
        status: fr.status,
        canEdit: BOARD_EDITABLE.includes(
          fr.status as (typeof BOARD_EDITABLE)[number],
        ),
        canGenerate: GENERATABLE.includes(
          fr.status as (typeof GENERATABLE)[number],
        ),
        members: members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
        })),
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          acceptanceCriteria: toStringArray(t.acceptanceCriteria),
          status: t.status,
          priority: t.priority,
          estimate: t.estimate,
          rank: t.rank,
          suggestedAreas: toStringArray(t.suggestedAreas),
          assigneeId: t.assigneeId,
          createdAt: t.createdAt,
          dependsOn: t.dependsOn
            .map((d) => ({
              id: d.dependencyId,
              title: titleById.get(d.dependencyId) ?? "(unknown)",
            }))
            .filter((d) => titleById.has(d.id)),
        })),
      };
    }),

  /**
   * Triggers async task generation from the approved PRD. Allowed from
   * PRD_APPROVED (first plan) or TASKS_READY (regenerate — replaces the plan).
   */
  generate: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fr = await loadFeatureRequest(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      if (!GENERATABLE.includes(fr.status as (typeof GENERATABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            fr.status === "PRD_DRAFTED"
              ? "Approve the PRD before generating tasks."
              : `Cannot generate tasks from ${fr.status}.`,
        });
      }

      const run = await triggerTaskGeneration(ctx.db, {
        organizationId: ctx.organizationId,
        featureRequestId: fr.id,
        actorId: ctx.user.id,
      });
      return { workflowRunId: run.id };
    }),

  /** Adds a manual task to the end of a column. */
  create: orgProcedure
    .input(
      z.object({
        featureRequestId: z.string(),
        title: z.string().trim().min(1, "Title is required.").max(200),
        description: z.string().trim().max(5000).default(""),
        status: taskStatusSchema.default("BACKLOG"),
        priority: taskPrioritySchema.default("MEDIUM"),
        estimate: z.number().int().min(1).max(13).nullable().default(null),
        acceptanceCriteria: z.array(z.string().trim().min(1)).max(40).default([]),
        suggestedAreas: z.array(z.string().trim().min(1)).max(40).default([]),
        assigneeId: z.string().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fr = await loadFeatureRequest(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      assertBoardEditable(fr.status);
      await assertAssignee(ctx, input.assigneeId);

      // Append after the last card in the target column.
      const last = await ctx.db.task.findFirst({
        where: { featureRequestId: fr.id, status: input.status },
        orderBy: { rank: "desc" },
        select: { rank: true },
      });
      const rank = rankBetween(last?.rank ?? null, null);

      const task = await ctx.db.task.create({
        data: {
          featureRequestId: fr.id,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          estimate: input.estimate,
          acceptanceCriteria: input.acceptanceCriteria,
          suggestedAreas: input.suggestedAreas,
          assigneeId: input.assigneeId,
          rank,
        },
        select: { id: true },
      });
      return { id: task.id };
    }),

  /** Edits a task's content (not its column/position — use `move`). */
  update: orgProcedure
    .input(
      z.object({
        taskId: z.string(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(5000).optional(),
        priority: taskPrioritySchema.optional(),
        estimate: z.number().int().min(1).max(13).nullable().optional(),
        acceptanceCriteria: z.array(z.string().trim().min(1)).max(40).optional(),
        suggestedAreas: z.array(z.string().trim().min(1)).max(40).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx.db, {
        taskId: input.taskId,
        organizationId: ctx.organizationId,
      });
      assertBoardEditable(task.featureRequest.status);

      const { taskId, ...rest } = input;
      await ctx.db.task.update({
        where: { id: taskId },
        data: {
          ...(rest.title !== undefined ? { title: rest.title } : {}),
          ...(rest.description !== undefined ? { description: rest.description } : {}),
          ...(rest.priority !== undefined ? { priority: rest.priority } : {}),
          ...(rest.estimate !== undefined ? { estimate: rest.estimate } : {}),
          ...(rest.acceptanceCriteria !== undefined
            ? { acceptanceCriteria: rest.acceptanceCriteria }
            : {}),
          ...(rest.suggestedAreas !== undefined
            ? { suggestedAreas: rest.suggestedAreas }
            : {}),
        },
      });
      return { ok: true };
    }),

  /**
   * Moves a task to a column and/or position. The client passes the IDs of the
   * cards that should sit immediately before/after it in the target column; the
   * server computes a lexorank strictly between their ranks. Pass null for an
   * end of the column.
   */
  move: orgProcedure
    .input(
      z.object({
        taskId: z.string(),
        status: taskStatusSchema,
        beforeTaskId: z.string().nullable().default(null),
        afterTaskId: z.string().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx.db, {
        taskId: input.taskId,
        organizationId: ctx.organizationId,
      });
      assertBoardEditable(task.featureRequest.status);

      // Resolve neighbour ranks, ensuring both belong to the same request.
      const neighbourIds = [input.beforeTaskId, input.afterTaskId].filter(
        (id): id is string => Boolean(id),
      );
      const neighbours = neighbourIds.length
        ? await ctx.db.task.findMany({
            where: { id: { in: neighbourIds }, featureRequestId: task.featureRequestId },
            select: { id: true, rank: true },
          })
        : [];
      const rankOf = (id: string | null) =>
        id ? (neighbours.find((n) => n.id === id)?.rank ?? null) : null;

      let rank: string;
      try {
        rank = rankBetween(rankOf(input.beforeTaskId), rankOf(input.afterTaskId));
      } catch {
        // Neighbour ranks were stale/adjacent — fall back to appending to the
        // end of the target column so the move still succeeds.
        const last = await ctx.db.task.findFirst({
          where: { featureRequestId: task.featureRequestId, status: input.status },
          orderBy: { rank: "desc" },
          select: { rank: true },
        });
        rank = rankBetween(last?.rank ?? null, null);
      }

      await ctx.db.task.update({
        where: { id: input.taskId },
        data: { status: input.status, rank },
      });
      return { ok: true, rank };
    }),

  /** Assigns (or unassigns) a task to an org member. */
  assign: orgProcedure
    .input(z.object({ taskId: z.string(), assigneeId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx.db, {
        taskId: input.taskId,
        organizationId: ctx.organizationId,
      });
      assertBoardEditable(task.featureRequest.status);
      await assertAssignee(ctx, input.assigneeId);

      await ctx.db.task.update({
        where: { id: input.taskId },
        data: { assigneeId: input.assigneeId },
      });
      return { ok: true };
    }),

  /** Deletes a task (and, via cascade, its dependency edges). */
  remove: orgProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx.db, {
        taskId: input.taskId,
        organizationId: ctx.organizationId,
      });
      assertBoardEditable(task.featureRequest.status);
      await ctx.db.task.delete({ where: { id: input.taskId } });
      return { ok: true };
    }),

  /**
   * Approves the plan: TASKS_READY → IN_DEVELOPMENT. Role-gated (owner/admin),
   * requires at least one task, audit-logged. Unlocks the development phase.
   */
  approvePlan: requireRole("owner", "admin")
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fr = await loadFeatureRequest(ctx.db, {
        featureRequestId: input.featureRequestId,
        organizationId: ctx.organizationId,
      });
      if (fr.status !== "TASKS_READY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve the plan while the request is in ${fr.status}.`,
        });
      }
      const count = await ctx.db.task.count({ where: { featureRequestId: fr.id } });
      if (count === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add at least one task before approving the plan.",
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.featureRequest.update({
          where: { id: fr.id },
          data: { status: "IN_DEVELOPMENT" },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "plan.approve",
            entityType: "feature_request",
            entityId: fr.id,
            metadata: { taskCount: count },
          },
        });
      });

      return { approved: true };
    }),
});

/** Validates that an assignee (if any) is a member of the active org. */
async function assertAssignee(
  ctx: { db: Parameters<typeof triggerTaskGeneration>[0]; organizationId: string },
  assigneeId: string | null,
) {
  if (!assigneeId) return;
  const member = await ctx.db.member.findFirst({
    where: { organizationId: ctx.organizationId, userId: assigneeId },
    select: { id: true },
  });
  if (!member) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Assignee must be a member of this workspace.",
    });
  }
}
