import { analyzeRepo } from "@zenbuild/ai";
import { db } from "@zenbuild/db";
import type { InngestFunction } from "inngest";

import { inngest, repoAnalyzeRequested } from "../client";
import { markCompleted, markFailed, markRunning, updateProgress } from "../workflow";
import { buildOctokitToolkit } from "./repoToolkit";

/**
 * `coding/repo.analyze` → explores a connected repository with read-only tools
 * and caches a durable `RepoContext` on `Repository.analysis`. This grounds the
 * code-generation agent so it writes code that fits the existing project. Runs
 * on connect and is re-runnable; `task.implement` self-heals by triggering this
 * if no analysis exists yet.
 */
export const repoAnalyzeFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "coding-repo-analyze",
    name: "Analyze repository",
    retries: 2,
    triggers: [repoAnalyzeRequested],
  },
  async ({ event, step, runId }) => {
    const { organizationId, repositoryId, workflowRunId } = event.data;

    try {
      await step.run("mark-running", () =>
        markRunning(workflowRunId, runId ?? null, "Loading repository"),
      );

      const repo = await step.run("load-repository", async () => {
        const r = await db.repository.findFirst({
          where: { id: repositoryId, organizationId },
          include: { installation: true },
        });
        if (!r) throw new Error("Repository not found.");
        if (!r.installation) {
          throw new Error("Repository has no active GitHub installation.");
        }
        return {
          owner: r.owner,
          name: r.name,
          fullName: r.fullName,
          defaultBranch: r.defaultBranch,
          private: r.private,
          installationId: r.installation.installationId.toString(),
        };
      });

      await step.run("progress-analyzing", () =>
        updateProgress(workflowRunId, 35, "Exploring the codebase"),
      );

      // The agentic exploration + structured summary run inside one durable
      // step (the toolkit holds live closures + the fetched tree).
      const result = await step.run("analyze", async () => {
        const { toolkit } = await buildOctokitToolkit({
          installationId: BigInt(repo.installationId),
          owner: repo.owner,
          repo: repo.name,
          ref: repo.defaultBranch,
        });
        return analyzeRepo({
          toolkit,
          repoMeta: {
            fullName: repo.fullName,
            defaultBranch: repo.defaultBranch,
            private: repo.private,
          },
        });
      });

      await step.run("persist-analysis", async () => {
        await db.repository.update({
          where: { id: repositoryId },
          data: {
            analysis: result.context,
            analyzedAt: new Date(),
          },
        });
        await db.auditLog.create({
          data: {
            organizationId,
            actorId: event.data.triggeredBy ?? null,
            action: "repo.analyze",
            entityType: "repository",
            entityId: repositoryId,
            metadata: {
              model: result.model,
              filesRead: result.filesRead.length,
              promptTokens: result.usage.promptTokens ?? null,
              completionTokens: result.usage.completionTokens ?? null,
            },
          },
        });
      });

      await step.run("mark-completed", () =>
        markCompleted(workflowRunId, {
          model: result.model,
          filesRead: result.filesRead,
          primaryLanguage: result.context.primaryLanguage,
        }),
      );

      return { ok: true, repositoryId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await step.run("mark-failed", () => markFailed(workflowRunId, message));
      throw err;
    }
  },
);
