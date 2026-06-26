import {
  REVIEW_CATEGORY_LABELS,
  REVIEW_SEVERITY_LABELS,
  reviewPullRequest,
  type ReviewIssueOutput,
} from "@zenbuild/ai";
import { db } from "@zenbuild/db";
import {
  formatReviewBody,
  postPullRequestReview,
  type GithubReviewEvent,
} from "@zenbuild/github";
import type { InngestFunction } from "inngest";

import { inngest, prReviewRequested } from "../client";
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

function verdictToGithubEvent(verdict: string): GithubReviewEvent {
  if (verdict === "APPROVE") return "APPROVE";
  if (verdict === "REQUEST_CHANGES") return "REQUEST_CHANGES";
  return "COMMENT";
}

function formatInlineComment(issue: ReviewIssueOutput): string {
  const parts = [
    `**[${REVIEW_SEVERITY_LABELS[issue.severity]} · ${REVIEW_CATEGORY_LABELS[issue.category]}] ${issue.title}**`,
    "",
    issue.explanation,
  ];
  if (issue.suggestion?.trim()) {
    parts.push("", `**Suggested fix:** ${issue.suggestion.trim()}`);
  }
  return parts.join("\n");
}

/**
 * `review/pr.requested` → the Phase-9 QA agent. Loads the PR diff plus the
 * linked PRD + tasks, produces a structured review with categorized issues,
 * posts a summary (+ inline comments when possible) to GitHub, and moves the
 * feature into FIX_NEEDED when blocking issues exist.
 */
export const prReviewFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "review-pr",
    name: "Review pull request",
    retries: 2,
    triggers: [prReviewRequested],
  },
  async ({ event, step, runId }) => {
    const {
      organizationId,
      pullRequestId,
      featureRequestId,
      workflowRunId,
    } = event.data;

    try {
      await step.run("mark-running", () =>
        markRunning(workflowRunId, runId ?? null, "Loading pull request context"),
      );

      const loaded = await step.run("load-context", async () => {
        const pr = await db.pullRequest.findFirst({
          where: { id: pullRequestId, organizationId },
          include: {
            repository: { include: { installation: true } },
          },
        });
        if (!pr) throw new Error("Pull request not found.");
        if (pr.status !== "OPEN") {
          throw new Error("Only open pull requests can be reviewed.");
        }
        if (!pr.repository.installation) {
          throw new Error("Repository has no active GitHub installation.");
        }
        if (!pr.headSha) {
          throw new Error("Pull request is missing a head commit SHA.");
        }

        const fr = await db.featureRequest.findFirst({
          where: { id: featureRequestId, organizationId },
          include: {
            project: { select: { name: true } },
            clarifications: { orderBy: { createdAt: "asc" } },
            prd: { select: { markdown: true, approvedAt: true } },
            tasks: { orderBy: { rank: "asc" } },
          },
        });
        if (!fr) throw new Error("Feature request not found.");
        if (!fr.prd?.approvedAt) {
          throw new Error("The PRD must be approved before AI review.");
        }

        const maxVersion = await db.review.aggregate({
          where: { pullRequestId },
          _max: { version: true },
        });
        const version = (maxVersion._max.version ?? 0) + 1;

        return {
          version,
          pr: {
            number: pr.number,
            title: pr.title,
            headRef: pr.headRef,
            baseRef: pr.baseRef,
            headSha: pr.headSha,
            diff: pr.diff ?? "",
            changedFiles: toChangedFiles(pr.changedFiles),
            taskId: pr.taskId,
          },
          repo: {
            owner: pr.repository.owner,
            name: pr.repository.name,
            installationId: pr.repository.installation.installationId.toString(),
          },
          fr: {
            title: fr.title,
            description: fr.description,
            priority: fr.priority,
            source: fr.source,
            status: fr.status,
            projectName: fr.project?.name ?? null,
            conversation: fr.clarifications.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            prdMarkdown: fr.prd.markdown,
            tasks: fr.tasks.map((t) => ({
              title: t.title,
              description: t.description,
              acceptanceCriteria: toStringArray(t.acceptanceCriteria),
              status: t.status,
            })),
          },
        };
      });

      await step.run("progress-reviewing", () =>
        updateProgress(workflowRunId, 40, "Analyzing code against requirements"),
      );

      const result = await step.run("run-review-agent", () =>
        reviewPullRequest({
          ctx: {
            title: loaded.fr.title,
            description: loaded.fr.description,
            priority: loaded.fr.priority,
            source: loaded.fr.source,
            projectName: loaded.fr.projectName,
            conversation: loaded.fr.conversation,
          },
          prdMarkdown: loaded.fr.prdMarkdown,
          tasks: loaded.fr.tasks,
          pullRequest: {
            number: loaded.pr.number,
            title: loaded.pr.title,
            headRef: loaded.pr.headRef,
            baseRef: loaded.pr.baseRef,
            changedFiles: loaded.pr.changedFiles,
            diff: loaded.pr.diff,
          },
        }),
      );

      const blockingCount = result.review.issues.filter(
        (i: ReviewIssueOutput) => i.severity === "BLOCKING",
      ).length;
      const nonBlockingCount = result.review.issues.length - blockingCount;

      await step.run("progress-posting", () =>
        updateProgress(workflowRunId, 75, "Posting review to GitHub"),
      );

      const persisted = await step.run("persist-review", async () => {
        const reviewOutput = result.review;
        const reviewId = await db.$transaction(async (tx) => {
          const review = await tx.review.create({
            data: {
              organizationId,
              pullRequestId,
              featureRequestId,
              version: loaded.version,
              status: "RUNNING",
              verdict: reviewOutput.verdict,
              summary: reviewOutput.summary,
              model: result.model,
              promptTokens: result.usage.promptTokens ?? null,
              completionTokens: result.usage.completionTokens ?? null,
              triggeredBy: event.data.triggeredBy ?? "webhook",
              issues: {
                create: reviewOutput.issues.map((issue: ReviewIssueOutput) => ({
                  severity: issue.severity,
                  category: issue.category,
                  title: issue.title,
                  explanation: issue.explanation,
                  suggestion: issue.suggestion?.trim() || null,
                  filePath: issue.filePath?.trim() || null,
                  line: issue.line ?? null,
                })),
              },
            },
            select: { id: true },
          });

          const nextStatus = blockingCount > 0 ? "FIX_NEEDED" : "IN_REVIEW";
          await tx.featureRequest.updateMany({
            where: {
              id: featureRequestId,
              status: {
                in: ["IN_DEVELOPMENT", "IN_REVIEW", "FIX_NEEDED"],
              },
            },
            data: { status: nextStatus },
          });

          return review.id;
        });

        return { reviewId, blockingCount, nonBlockingCount };
      });

      const posted = await step.run("post-github-review", async () => {
        const inline = result.review.issues
          .filter(
            (
              i: ReviewIssueOutput,
            ): i is ReviewIssueOutput & { filePath: string; line: number } =>
              Boolean(i.filePath?.trim() && i.line && i.line > 0),
          )
          .map((i: ReviewIssueOutput & { filePath: string; line: number }) => ({
            path: i.filePath.trim(),
            line: i.line,
            body: formatInlineComment(i),
          }));

        const body = formatReviewBody({
          version: loaded.version,
          summary: result.review.summary,
          blockingCount,
          nonBlockingCount,
        });

        return postPullRequestReview({
          installationId: BigInt(loaded.repo.installationId),
          owner: loaded.repo.owner,
          repo: loaded.repo.name,
          pullNumber: loaded.pr.number,
          commitSha: loaded.pr.headSha,
          body,
          event: verdictToGithubEvent(result.review.verdict),
          comments: inline,
        });
      });

      await step.run("finalize-review", async () => {
        await db.$transaction(async (tx) => {
          await tx.review.update({
            where: { id: persisted.reviewId },
            data: {
              status: "COMPLETED",
              githubReviewId: BigInt(posted.id),
              completedAt: new Date(),
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              actorId:
                event.data.triggeredBy &&
                event.data.triggeredBy !== "webhook"
                  ? event.data.triggeredBy
                  : null,
              action: "pr.review",
              entityType: "pull_request",
              entityId: pullRequestId,
              metadata: {
                reviewId: persisted.reviewId,
                version: loaded.version,
                verdict: result.review.verdict,
                blockingCount,
                nonBlockingCount,
                githubReviewUrl: posted.url,
                model: result.model,
              },
            },
          });
        });
      });

      await step.run("mark-completed", () =>
        markCompleted(workflowRunId, {
          reviewId: persisted.reviewId,
          version: loaded.version,
          verdict: result.review.verdict,
          summary: result.review.summary,
          blockingCount,
          nonBlockingCount,
          issueCount: result.review.issues.length,
          githubReview: { id: posted.id, url: posted.url },
          model: result.model,
          promptTokens: result.usage.promptTokens ?? null,
          completionTokens: result.usage.completionTokens ?? null,
        }),
      );

      return {
        ok: true,
        reviewId: persisted.reviewId,
        version: loaded.version,
        blockingCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await step.run("mark-failed", () => markFailed(workflowRunId, message));
      throw err;
    }
  },
);
