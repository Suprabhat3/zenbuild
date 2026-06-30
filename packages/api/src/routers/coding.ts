import { TRPCError } from "@trpc/server";
import { isGithubConfigured } from "@zenbuild/github";
import { z } from "zod";

import { guardWorkflowCredits } from "../lib/billingGuards";
import { triggerRepoAnalyze, triggerTaskImplement } from "../lib/coding";
import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

/** Feature-request states from which the coding agent may run (post plan-approval). */
const IMPLEMENTABLE = ["IN_DEVELOPMENT", "IN_REVIEW", "FIX_NEEDED"] as const;

/**
 * Phase-8 coding agent surface: trigger repository analysis, kick off async
 * implementation of a task into a real PR, and read per-task run/PR status for
 * live progress. All reads/writes are tenant-isolated through the active org.
 */
export const codingRouter = createTRPCRouter({
  /**
   * Repositories a feature's tasks can target — connected repos in the
   * feature's project (or any connected org repo if it has no project), with
   * their analysis state. Drives the Implement button's repo picker.
   */
  repos: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true, projectId: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }

      const repos = await ctx.db.repository.findMany({
        where: {
          organizationId: ctx.organizationId,
          installationId: { not: null },
          ...(fr.projectId ? { projectId: fr.projectId } : {}),
        },
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
          defaultBranch: true,
          analyzedAt: true,
        },
      });

      return {
        configured: isGithubConfigured(),
        canImplement: IMPLEMENTABLE.includes(
          fr.status as (typeof IMPLEMENTABLE)[number],
        ),
        status: fr.status,
        repos,
      };
    }),

  /**
   * Implement a single task into a branch + PR (async). One PR per task. When
   * the feature's project has exactly one connected repo it's auto-selected;
   * otherwise the caller must pass `repositoryId`.
   */
  implement: orgProcedure
    .input(
      z.object({
        taskId: z.string(),
        repositoryId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isGithubConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub App is not configured on this deployment.",
        });
      }

      const task = await ctx.db.task.findFirst({
        where: {
          id: input.taskId,
          featureRequest: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          featureRequestId: true,
          featureRequest: { select: { status: true, projectId: true } },
        },
      });
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
      }
      const frStatus = task.featureRequest.status;
      if (!IMPLEMENTABLE.includes(frStatus as (typeof IMPLEMENTABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            frStatus === "TASKS_READY"
              ? "Approve the plan before implementing tasks."
              : `Cannot implement tasks while the request is in ${frStatus}.`,
        });
      }

      // Resolve the target repo (least surprise: auto-pick a sole connected repo).
      const candidates = await ctx.db.repository.findMany({
        where: {
          organizationId: ctx.organizationId,
          installationId: { not: null },
          ...(task.featureRequest.projectId
            ? { projectId: task.featureRequest.projectId }
            : {}),
        },
        select: { id: true },
      });
      if (candidates.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Connect a GitHub repository to this project first.",
        });
      }

      let repositoryId = input.repositoryId;
      if (repositoryId) {
        if (!candidates.some((r) => r.id === repositoryId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That repository is not connected to this feature's project.",
          });
        }
      } else if (candidates.length === 1) {
        repositoryId = candidates[0]!.id;
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Multiple repositories are connected — choose one to implement in.",
        });
      }

      await guardWorkflowCredits(ctx.db, ctx.organizationId, "TASK_IMPLEMENT");

      const run = await triggerTaskImplement(ctx.db, {
        organizationId: ctx.organizationId,
        featureRequestId: task.featureRequestId,
        taskId: task.id,
        repositoryId,
        actorId: ctx.user.id,
      });

      return { workflowRunId: run.id, repositoryId };
    }),

  /** Trigger (or refresh) analysis of a connected repository. Owners/admins. */
  analyzeRepo: requireRole("owner", "admin")
    .input(z.object({ repositoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isGithubConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub App is not configured on this deployment.",
        });
      }
      const repo = await ctx.db.repository.findFirst({
        where: { id: input.repositoryId, organizationId: ctx.organizationId },
        select: { id: true, installationId: true },
      });
      if (!repo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found." });
      }
      if (!repo.installationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Repository has no active GitHub installation.",
        });
      }

      await guardWorkflowCredits(ctx.db, ctx.organizationId, "REPO_ANALYZE");

      const run = await triggerRepoAnalyze(ctx.db, {
        organizationId: ctx.organizationId,
        repositoryId: repo.id,
        actorId: ctx.user.id,
      });
      return { workflowRunId: run.id };
    }),

  /**
   * Latest implementation run + resulting PR for a single task — polled by the
   * Implement button for live progress.
   */
  taskStatus: orgProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Confirm the task is in the active org before exposing anything.
      const task = await ctx.db.task.findFirst({
        where: {
          id: input.taskId,
          featureRequest: { organizationId: ctx.organizationId },
        },
        select: { id: true, status: true },
      });
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
      }

      const run = await ctx.db.workflowRun.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "TASK_IMPLEMENT",
          input: { path: ["taskId"], equals: input.taskId },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          progress: true,
          step: true,
          error: true,
          output: true,
          createdAt: true,
          finishedAt: true,
        },
      });

      const pr = await ctx.db.pullRequest.findFirst({
        where: { organizationId: ctx.organizationId, taskId: input.taskId },
        orderBy: { createdAt: "desc" },
        select: {
          number: true,
          url: true,
          status: true,
          headRef: true,
          repository: { select: { fullName: true } },
        },
      });

      return { taskStatus: task.status, run, pr };
    }),
});
