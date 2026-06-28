import { assessReleaseReadiness } from "@zenbuild/ai";
import { db } from "@zenbuild/db";
import type { InngestFunction } from "inngest";

import { inngest, releaseReadinessRequested } from "../client";
import { markCompleted, markFailed, markRunning, updateProgress } from "../workflow";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toChangedFiles(value: unknown): {
  path: string;
  status: string;
  additions: number;
  deletions: number;
}[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({
      path: String(f.path ?? ""),
      status: String(f.status ?? "modified"),
      additions: Number(f.additions ?? 0),
      deletions: Number(f.deletions ?? 0),
    }))
    .filter((f) => f.path.length > 0);
}

/**
 * `release/readiness.requested` → the Phase-12 release-readiness agent. Loads the
 * approved PRD, tasks, and every linked PR (with its latest review), then produces
 * an ADVISORY readiness verdict surfaced on the human-approval screen. It does NOT
 * change the feature's state — only a human can ship.
 */
export const releaseReadinessFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "release-readiness",
    name: "Assess release readiness",
    retries: 2,
    triggers: [releaseReadinessRequested],
  },
  async ({ event, step, runId }) => {
    const { organizationId, featureRequestId, workflowRunId } = event.data;

    try {
      await step.run("mark-running", () =>
        markRunning(workflowRunId, runId ?? null, "Loading feature context"),
      );

      const loaded = await step.run("load-context", async () => {
        const fr = await db.featureRequest.findFirst({
          where: { id: featureRequestId, organizationId },
          include: {
            project: { select: { name: true } },
            prd: { select: { markdown: true, approvedAt: true } },
            tasks: { orderBy: { rank: "asc" } },
          },
        });
        if (!fr) throw new Error("Feature request not found.");
        if (!fr.prd?.approvedAt) {
          throw new Error("The PRD must be approved before a release assessment.");
        }

        const pullRequests = await db.pullRequest.findMany({
          where: { featureRequestId, organizationId },
          orderBy: { createdAt: "desc" },
          include: {
            reviews: {
              where: { status: "COMPLETED" },
              orderBy: { version: "desc" },
              take: 1,
              include: {
                issues: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
              },
            },
          },
        });

        return {
          fr: {
            title: fr.title,
            description: fr.description,
            priority: fr.priority,
            source: fr.source,
            projectName: fr.project?.name ?? null,
            prdMarkdown: fr.prd.markdown,
            tasks: fr.tasks.map((t) => ({
              title: t.title,
              description: t.description,
              acceptanceCriteria: toStringArray(t.acceptanceCriteria),
              status: t.status,
            })),
          },
          pullRequests: pullRequests.map((pr) => {
            const latest = pr.reviews[0] ?? null;
            return {
              number: pr.number,
              title: pr.title,
              status: pr.status,
              headRef: pr.headRef,
              baseRef: pr.baseRef,
              changedFiles: toChangedFiles(pr.changedFiles),
              diff: pr.diff ?? "",
              latestReview: latest
                ? {
                    version: latest.version,
                    verdict: latest.verdict,
                    summary: latest.summary,
                    issues: latest.issues.map((i) => ({
                      severity: i.severity,
                      category: i.category,
                      title: i.title,
                      explanation: i.explanation,
                      status: i.status,
                    })),
                  }
                : null,
            };
          }),
        };
      });

      await step.run("progress-assessing", () =>
        updateProgress(workflowRunId, 45, "Assessing PRD coverage and readiness"),
      );

      const result = await step.run("run-readiness-agent", () =>
        assessReleaseReadiness({
          ctx: {
            title: loaded.fr.title,
            description: loaded.fr.description,
            priority: loaded.fr.priority,
            source: loaded.fr.source,
            projectName: loaded.fr.projectName,
          },
          prdMarkdown: loaded.fr.prdMarkdown,
          tasks: loaded.fr.tasks,
          pullRequests: loaded.pullRequests,
        }),
      );

      await step.run("audit", async () => {
        await db.auditLog.create({
          data: {
            organizationId,
            actorId:
              event.data.triggeredBy && event.data.triggeredBy !== "manual"
                ? event.data.triggeredBy
                : null,
            action: "release.readiness",
            entityType: "feature_request",
            entityId: featureRequestId,
            metadata: {
              verdict: result.readiness.verdict,
              model: result.model,
              usage: result.usage,
            },
          },
        });
      });

      await step.run("mark-completed", () =>
        markCompleted(workflowRunId, {
          readiness: result.readiness,
          model: result.model,
          promptTokens: result.usage.promptTokens ?? null,
          completionTokens: result.usage.completionTokens ?? null,
        }),
      );

      return { ok: true, verdict: result.readiness.verdict };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await step.run("mark-failed", () => markFailed(workflowRunId, message));
      throw err;
    }
  },
);
