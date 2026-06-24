import { generateTasks, type RequestContext } from "@zenbuild/ai";
import { db, initialRanks } from "@zenbuild/db";
import type { InngestFunction } from "inngest";

import { inngest, tasksRequested } from "../client";
import { markCompleted, markFailed, markRunning, updateProgress } from "../workflow";

/**
 * `feature/tasks.requested` → turns an APPROVED PRD into an ordered set of
 * engineering tasks, persists them onto a fresh Kanban board (Backlog column,
 * lexorank-ordered) with their dependency edges, and moves the request
 * PRD_APPROVED→TASKS_READY. Re-running regenerates the plan: it replaces any
 * previously generated tasks (planning happens before development begins).
 */
export const generateTasksFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "feature-tasks-generate",
    name: "Generate tasks",
    retries: 2,
    triggers: [tasksRequested],
  },
  async ({ event, step, runId }) => {
    const { featureRequestId, organizationId, workflowRunId } = event.data;

    try {
      await step.run("mark-running", () =>
        markRunning(workflowRunId, runId ?? null, "Loading approved PRD"),
      );

      const { ctx, prdMarkdown } = await step.run("load-context", async () => {
        const fr = await db.featureRequest.findFirst({
          where: { id: featureRequestId, organizationId },
          include: {
            project: { select: { name: true } },
            clarifications: { orderBy: { createdAt: "asc" } },
            prd: { select: { markdown: true, approvedAt: true } },
          },
        });
        if (!fr) throw new Error("Feature request not found.");
        if (!fr.prd) throw new Error("No PRD exists for this request.");
        if (!fr.prd.approvedAt) {
          throw new Error("The PRD must be approved before generating tasks.");
        }

        const context: RequestContext = {
          title: fr.title,
          description: fr.description,
          priority: fr.priority,
          source: fr.source,
          projectName: fr.project?.name ?? null,
          conversation: fr.clarifications.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        };
        return { ctx: context, prdMarkdown: fr.prd.markdown };
      });

      await step.run("progress-planning", () =>
        updateProgress(workflowRunId, 45, "Planning engineering tasks"),
      );

      const result = await step.run("generate-tasks", () =>
        generateTasks({ ctx, prdMarkdown }),
      );

      await step.run("persist-tasks", async () => {
        const ranks = initialRanks(result.tasks.length);

        await db.$transaction(async (tx) => {
          // Regeneration replaces the prior generated plan (planning precedes
          // development; tasks are not yet referenced by PRs at this stage).
          await tx.task.deleteMany({ where: { featureRequestId } });

          // Create tasks first so dependency edges can reference their IDs.
          const createdIds: string[] = [];
          for (let i = 0; i < result.tasks.length; i++) {
            const t = result.tasks[i]!;
            const created = await tx.task.create({
              data: {
                featureRequestId,
                title: t.title,
                description: t.description,
                acceptanceCriteria: t.acceptanceCriteria,
                status: "BACKLOG",
                priority: t.priority,
                estimate: t.estimate,
                rank: ranks[i]!,
                suggestedAreas: t.suggestedAreas,
              },
              select: { id: true },
            });
            createdIds.push(created.id);
          }

          // Map 1-based dependsOn indices → task IDs. Only earlier tasks may be
          // depended upon (keeps the graph acyclic); out-of-range/self/forward
          // references from the model are ignored defensively.
          const edges: { dependentId: string; dependencyId: string }[] = [];
          const seen = new Set<string>();
          for (let i = 0; i < result.tasks.length; i++) {
            for (const idx of result.tasks[i]!.dependsOn) {
              const depPos = idx - 1;
              if (depPos < 0 || depPos >= i) continue; // forward/self/oob
              const key = `${i}:${depPos}`;
              if (seen.has(key)) continue;
              seen.add(key);
              edges.push({
                dependentId: createdIds[i]!,
                dependencyId: createdIds[depPos]!,
              });
            }
          }
          if (edges.length > 0) {
            await tx.taskDependency.createMany({ data: edges });
          }

          await tx.featureRequest.update({
            where: { id: featureRequestId },
            data: { status: "TASKS_READY" },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              actorId: null,
              action: "tasks.generate",
              entityType: "feature_request",
              entityId: featureRequestId,
              metadata: {
                count: result.tasks.length,
                model: result.model,
              },
            },
          });
        });
      });

      await step.run("mark-completed", () =>
        markCompleted(workflowRunId, {
          model: result.model,
          count: result.tasks.length,
        }),
      );

      return { ok: true, count: result.tasks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await step.run("mark-failed", () => markFailed(workflowRunId, message));
      throw err;
    }
  },
);
