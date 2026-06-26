import {
  analyzeRepo,
  implementTask,
  RepoContextSchema,
  type RepoContext,
  type RequestContext,
} from "@zenbuild/ai";
import { db } from "@zenbuild/db";
import {
  buildZenbuildBranch,
  buildZenbuildMarker,
  openPullRequestWithChanges,
} from "@zenbuild/github";
import type { InngestFunction } from "inngest";

import { githubPrSyncRequested, inngest, taskImplementRequested } from "../client";
import { markCompleted, markFailed, markRunning, updateProgress } from "../workflow";
import { buildOctokitToolkit } from "./repoToolkit";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * `coding/task.implement` → the Phase-8 coding agent. Grounds itself in the
 * repository's `RepoContext` (analyzing on the fly if none is cached), generates
 * a whole-file patch set for one task, and lands it as a branch + commit + PR
 * (one PR per task). The task moves to IN_REVIEW and the feature into the review
 * pipeline; a confidence/risk score + self-check + reproducibility record are
 * stored on the WorkflowRun. Idempotent on re-run (branch/PR are reused).
 */
export const taskImplementFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "coding-task-implement",
    name: "Implement task",
    retries: 1, // code generation is expensive + side-effecting; limit retries
    triggers: [taskImplementRequested],
  },
  async ({ event, step, runId }) => {
    const { organizationId, featureRequestId, taskId, repositoryId, workflowRunId } =
      event.data;

    try {
      await step.run("mark-running", () =>
        markRunning(workflowRunId, runId ?? null, "Loading task & repository"),
      );

      const loaded = await step.run("load-context", async () => {
        const task = await db.task.findFirst({
          where: { id: taskId, featureRequest: { organizationId } },
          include: {
            featureRequest: {
              include: {
                project: { select: { name: true } },
                clarifications: { orderBy: { createdAt: "asc" } },
                prd: { select: { markdown: true, approvedAt: true } },
              },
            },
          },
        });
        if (!task) throw new Error("Task not found.");
        if (task.featureRequestId !== featureRequestId) {
          throw new Error("Task does not belong to the given feature request.");
        }
        const fr = task.featureRequest;
        if (!fr.prd?.approvedAt) {
          throw new Error("The PRD must be approved before implementation.");
        }

        const repo = await db.repository.findFirst({
          where: { id: repositoryId, organizationId },
          include: { installation: true },
        });
        if (!repo) throw new Error("Repository not found.");
        if (!repo.installation) {
          throw new Error("Repository has no active GitHub installation.");
        }

        const ctx: RequestContext = {
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

        return {
          ctx,
          prdMarkdown: fr.prd.markdown,
          task: {
            title: task.title,
            description: task.description,
            acceptanceCriteria: toStringArray(task.acceptanceCriteria),
            suggestedAreas: toStringArray(task.suggestedAreas),
          },
          repo: {
            owner: repo.owner,
            name: repo.name,
            fullName: repo.fullName,
            defaultBranch: repo.defaultBranch,
            private: repo.private,
            installationId: repo.installation.installationId.toString(),
            analysis: repo.analysis,
          },
        };
      });

      // Ensure we have a RepoContext to ground generation (self-heal if missing
      // or schema-incompatible).
      const repoContext: RepoContext = await step.run("ensure-analysis", async () => {
        const cached = RepoContextSchema.safeParse(loaded.repo.analysis);
        if (cached.success) return cached.data;

        const { toolkit } = await buildOctokitToolkit({
          installationId: BigInt(loaded.repo.installationId),
          owner: loaded.repo.owner,
          repo: loaded.repo.name,
          ref: loaded.repo.defaultBranch,
        });
        const analysis = await analyzeRepo({
          toolkit,
          repoMeta: {
            fullName: loaded.repo.fullName,
            defaultBranch: loaded.repo.defaultBranch,
            private: loaded.repo.private,
          },
        });
        await db.repository.update({
          where: { id: repositoryId },
          data: { analysis: analysis.context, analyzedAt: new Date() },
        });
        return analysis.context;
      });

      await step.run("progress-implementing", () =>
        updateProgress(workflowRunId, 45, "Writing code"),
      );

      const result = await step.run("implement", async () => {
        const { toolkit } = await buildOctokitToolkit({
          installationId: BigInt(loaded.repo.installationId),
          owner: loaded.repo.owner,
          repo: loaded.repo.name,
          ref: loaded.repo.defaultBranch,
        });
        const impl = await implementTask({
          ctx: loaded.ctx,
          prdMarkdown: loaded.prdMarkdown,
          task: loaded.task,
          repoContext,
          repoMeta: {
            fullName: loaded.repo.fullName,
            defaultBranch: loaded.repo.defaultBranch,
            private: loaded.repo.private,
          },
          toolkit,
        });
        return impl;
      });

      await step.run("progress-opening-pr", () =>
        updateProgress(workflowRunId, 80, "Opening pull request"),
      );

      const opened = await step.run("open-pr", async () => {
        const branch = buildZenbuildBranch(featureRequestId, taskId);
        const marker = buildZenbuildMarker(featureRequestId, taskId);
        const impl = result.implementation;
        const body = `${impl.prBody}\n\n${marker}`;

        return openPullRequestWithChanges({
          installationId: BigInt(loaded.repo.installationId),
          owner: loaded.repo.owner,
          repo: loaded.repo.name,
          baseBranch: loaded.repo.defaultBranch,
          headBranch: branch,
          files: impl.files.map((f: { path: string; contents: string }) => ({
            path: f.path,
            contents: f.contents,
          })),
          deletions: impl.deletions,
          commitMessage: impl.commitMessage,
          prTitle: impl.prTitle,
          prBody: body,
        });
      });

      await step.run("persist-pull-request", async () => {
        const impl = result.implementation;
        const changedFiles = [
          ...impl.files.map((f: { path: string; kind: string }) => ({
            path: f.path,
            status: f.kind === "ADD" ? "added" : "modified",
            additions: 0,
            deletions: 0,
          })),
          ...impl.deletions.map((p: string) => ({
            path: p,
            status: "removed",
            additions: 0,
            deletions: 0,
          })),
        ];

        const prData = {
          title: impl.prTitle,
          body: `${impl.prBody}\n\n${buildZenbuildMarker(featureRequestId, taskId)}`,
          status: "OPEN" as const,
          headRef: opened.headRef,
          baseRef: opened.baseRef,
          headSha: opened.headSha,
          url: opened.url,
          changedFiles,
          featureRequestId,
          taskId,
        };

        await db.$transaction(async (tx) => {
          await tx.pullRequest.upsert({
            where: {
              repositoryId_number: { repositoryId, number: opened.number },
            },
            create: {
              organizationId,
              repositoryId,
              number: opened.number,
              origin: "AGENT",
              ...prData,
            },
            update: prData,
          });

          await tx.task.update({
            where: { id: taskId },
            data: { status: "IN_REVIEW" },
          });

          // Advance the feature into the review pipeline (only from active
          // development — never downgrade a later state).
          await tx.featureRequest.updateMany({
            where: { id: featureRequestId, status: "IN_DEVELOPMENT" },
            data: { status: "IN_REVIEW" },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              actorId: event.data.triggeredBy ?? null,
              action: "task.implement",
              entityType: "task",
              entityId: taskId,
              metadata: {
                model: result.model,
                prNumber: opened.number,
                confidence: impl.confidence,
                risk: impl.risk,
                fileCount: impl.files.length,
                reused: opened.reused,
              },
            },
          });
        });
      });

      // Enrich the tracked PR with the real changed-files + unified diff from
      // GitHub (the patch set we stored has no diff/line counts).
      await step.run("emit-pr-sync", () =>
        inngest.send(
          githubPrSyncRequested.create({
            organizationId,
            repositoryId,
            prNumber: opened.number,
            reason: "agent-implement",
          }),
        ),
      );

      await step.run("mark-completed", () => {
        const impl = result.implementation;
        return markCompleted(workflowRunId, {
          model: result.model,
          summary: impl.summary,
          confidence: impl.confidence,
          risk: impl.risk,
          riskReasons: impl.riskReasons,
          testsAdded: impl.testsAdded,
          selfChecks: impl.selfChecks,
          followUps: impl.followUps,
          pr: { number: opened.number, url: opened.url, branch: opened.headRef },
          // Reproducibility: pinned context snapshot + what the agent touched.
          reproducibility: {
            taskId,
            repositoryId,
            baseRef: loaded.repo.defaultBranch,
            model: result.model,
            promptTokens: result.usage.promptTokens ?? null,
            completionTokens: result.usage.completionTokens ?? null,
            filesRead: result.filesRead,
            toolCalls: result.toolCalls,
          },
        });
      });

      return {
        ok: true,
        prNumber: opened.number,
        confidence: result.implementation.confidence,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await step.run("mark-failed", () => markFailed(workflowRunId, message));
      throw err;
    }
  },
);
