import { TRPCError } from "@trpc/server";
import { isGithubConfigured } from "@zenbuild/github";
import { computeFeatureReviewStatus, shouldAutoReviewAfterSync } from "@zenbuild/jobs";
import { z } from "zod";

import { triggerPrReview } from "../lib/review";
import { createTRPCRouter, orgProcedure } from "../trpc";

const REVIEWABLE_FEATURE = ["IN_DEVELOPMENT", "IN_REVIEW", "FIX_NEEDED"] as const;

const issueSelect = {
  id: true,
  severity: true,
  category: true,
  status: true,
  title: true,
  explanation: true,
  suggestion: true,
  filePath: true,
  line: true,
  createdAt: true,
} as const;

/**
 * Phase-9 AI code review surface: list reviews, read a review with issues,
 * trigger a manual re-review, and poll the latest run for live progress.
 */
export const reviewRouter = createTRPCRouter({
  /** Org-wide review feed for the Reviews page. */
  list: orgProcedure
    .input(
      z
        .object({
          featureRequestId: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const reviews = await ctx.db.review.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input?.featureRequestId
            ? { featureRequestId: input.featureRequestId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          version: true,
          status: true,
          verdict: true,
          summary: true,
          createdAt: true,
          completedAt: true,
          pullRequest: {
            select: {
              id: true,
              number: true,
              url: true,
              title: true,
              status: true,
              repository: { select: { fullName: true } },
            },
          },
          featureRequest: {
            select: { id: true, title: true, status: true },
          },
          _count: { select: { issues: true } },
        },
      });

      const enriched = await Promise.all(
        reviews.map(async (r) => {
          const counts = await ctx.db.reviewIssue.groupBy({
            by: ["severity"],
            where: { reviewId: r.id },
            _count: true,
          });
          const blocking =
            counts.find((c) => c.severity === "BLOCKING")?._count ?? 0;
          const nonBlocking =
            counts.find((c) => c.severity === "NON_BLOCKING")?._count ?? 0;
          return { ...r, blockingCount: blocking, nonBlockingCount: nonBlocking };
        }),
      );

      return enriched;
    }),

  /** Full review detail with every issue — for the review detail panel. */
  byId: orgProcedure
    .input(z.object({ reviewId: z.string() }))
    .query(async ({ ctx, input }) => {
      const review = await ctx.db.review.findFirst({
        where: { id: input.reviewId, organizationId: ctx.organizationId },
        include: {
          issues: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
          pullRequest: {
            select: {
              id: true,
              number: true,
              url: true,
              title: true,
              headRef: true,
              status: true,
              repository: { select: { fullName: true } },
            },
          },
          featureRequest: {
            select: { id: true, title: true, status: true },
          },
        },
      });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found." });
      }
      return review;
    }),

  /** Reviews for a feature request, newest first. */
  forFeature: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!fr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature request not found.",
        });
      }

      const [reviews, pullRequests] = await Promise.all([
        ctx.db.review.findMany({
          where: {
            organizationId: ctx.organizationId,
            featureRequestId: input.featureRequestId,
          },
          orderBy: [{ pullRequestId: "asc" }, { version: "desc" }],
          select: {
            id: true,
            version: true,
            status: true,
            verdict: true,
            summary: true,
            createdAt: true,
            completedAt: true,
            pullRequestId: true,
            pullRequest: {
              select: { number: true, url: true, title: true, status: true },
            },
            issues: { select: issueSelect },
          },
        }),
        ctx.db.pullRequest.findMany({
          where: {
            organizationId: ctx.organizationId,
            featureRequestId: input.featureRequestId,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            url: true,
            title: true,
            status: true,
            headSha: true,
            headRef: true,
            repository: { select: { fullName: true } },
          },
        }),
      ]);

      return { reviews, pullRequests };
    }),

  /** Manual "Review now" for a tracked pull request. */
  trigger: orgProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isGithubConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub App is not configured on this deployment.",
        });
      }

      const pr = await ctx.db.pullRequest.findFirst({
        where: { id: input.pullRequestId, organizationId: ctx.organizationId },
        include: {
          featureRequest: { select: { id: true, status: true } },
        },
      });
      if (!pr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found." });
      }
      if (pr.status !== "OPEN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only open pull requests can be reviewed.",
        });
      }
      if (!pr.featureRequestId || !pr.featureRequest) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This pull request is not linked to a feature request.",
        });
      }
      if (
        !REVIEWABLE_FEATURE.includes(
          pr.featureRequest.status as (typeof REVIEWABLE_FEATURE)[number],
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot review while the feature is in ${pr.featureRequest.status}.`,
        });
      }

      const inflight = await ctx.db.workflowRun.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "PR_REVIEW",
          status: { in: ["QUEUED", "RUNNING"] },
          input: { path: ["pullRequestId"], equals: pr.id },
        },
      });
      if (inflight) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A review is already in progress for this pull request.",
        });
      }

      const run = await triggerPrReview(ctx.db, {
        organizationId: ctx.organizationId,
        pullRequestId: pr.id,
        featureRequestId: pr.featureRequestId,
        headSha: pr.headSha,
        actorId: ctx.user.id,
        force: true,
        isReReview: pr.featureRequest.status === "FIX_NEEDED",
      });

      return { workflowRunId: run.id };
    }),

  /**
   * Latest review workflow run for a pull request — polled after triggering
   * "Review now" or while waiting on an auto-review.
   */
  prStatus: orgProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const pr = await ctx.db.pullRequest.findFirst({
        where: { id: input.pullRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true, url: true, number: true },
      });
      if (!pr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found." });
      }

      const run = await ctx.db.workflowRun.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "PR_REVIEW",
          input: { path: ["pullRequestId"], equals: input.pullRequestId },
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

      const latestReview = await ctx.db.review.findFirst({
        where: { pullRequestId: input.pullRequestId },
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          status: true,
          verdict: true,
          summary: true,
          completedAt: true,
          issues: {
            select: issueSelect,
            orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
          },
        },
      });

      return { pullRequest: pr, run, latestReview };
    }),

  /** Whether an auto-review would fire for the current PR head (diagnostic). */
  canAutoReview: orgProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const pr = await ctx.db.pullRequest.findFirst({
        where: { id: input.pullRequestId, organizationId: ctx.organizationId },
        include: { featureRequest: { select: { id: true, status: true } } },
      });
      if (!pr?.featureRequest) {
        return { canReview: false, reason: "unlinked" as const };
      }

      const decision = await shouldAutoReviewAfterSync({
        organizationId: ctx.organizationId,
        pullRequestId: pr.id,
        headSha: pr.headSha,
        featureRequestId: pr.featureRequest.id,
        featureStatus: pr.featureRequest.status,
        reason: "opened",
      });
      return {
        canReview: decision.enqueue,
        reason: decision.skipReason ?? null,
        isReReview: decision.isReReview ?? false,
      };
    }),

  /**
   * Phase-10 fix-needed summary: outstanding issues from the latest review per
   * PR, full iteration history, tasks linked to PRs, and any in-flight re-review.
   */
  fixNeeded: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true, title: true },
      });
      if (!fr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature request not found.",
        });
      }

      const [reviews, pullRequests, activeRun, pipelineStatus, tasks] =
        await Promise.all([
          ctx.db.review.findMany({
            where: {
              organizationId: ctx.organizationId,
              featureRequestId: input.featureRequestId,
              status: "COMPLETED",
            },
            orderBy: [{ pullRequestId: "asc" }, { version: "desc" }],
            select: {
              id: true,
              version: true,
              verdict: true,
              summary: true,
              completedAt: true,
              pullRequestId: true,
              pullRequest: {
                select: {
                  id: true,
                  number: true,
                  url: true,
                  title: true,
                  headRef: true,
                  taskId: true,
                  repository: { select: { fullName: true } },
                },
              },
              issues: { select: issueSelect, orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
            },
          }),
          ctx.db.pullRequest.findMany({
            where: {
              organizationId: ctx.organizationId,
              featureRequestId: input.featureRequestId,
              status: "OPEN",
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              number: true,
              url: true,
              title: true,
              headRef: true,
              headSha: true,
              taskId: true,
              repository: { select: { fullName: true } },
            },
          }),
          ctx.db.workflowRun.findFirst({
            where: {
              organizationId: ctx.organizationId,
              featureRequestId: input.featureRequestId,
              type: "PR_REVIEW",
              status: { in: ["QUEUED", "RUNNING"] },
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              progress: true,
              step: true,
              input: true,
              createdAt: true,
            },
          }),
          computeFeatureReviewStatus(ctx.db, input.featureRequestId),
          ctx.db.task.findMany({
            where: { featureRequestId: input.featureRequestId },
            orderBy: { rank: "asc" },
            select: {
              id: true,
              title: true,
              status: true,
            },
          }),
        ]);

      const latestByPr = new Map<string, (typeof reviews)[number]>();
      const iterationsByPr = new Map<string, (typeof reviews)[number][]>();

      for (const review of reviews) {
        if (!latestByPr.has(review.pullRequestId)) {
          latestByPr.set(review.pullRequestId, review);
        }
        const list = iterationsByPr.get(review.pullRequestId) ?? [];
        list.push(review);
        iterationsByPr.set(review.pullRequestId, list);
      }

      const blockingIssues: (typeof reviews)[number]["issues"] = [];
      const nonBlockingIssues: (typeof reviews)[number]["issues"] = [];

      for (const latest of latestByPr.values()) {
        for (const issue of latest.issues) {
          if (issue.severity === "BLOCKING") blockingIssues.push(issue);
          else nonBlockingIssues.push(issue);
        }
      }

      const prSummaries = pullRequests.map((pr) => {
        const latest = latestByPr.get(pr.id);
        const iterations = (iterationsByPr.get(pr.id) ?? []).map((r) => ({
          id: r.id,
          version: r.version,
          verdict: r.verdict,
          completedAt: r.completedAt,
          blockingCount: r.issues.filter((i) => i.severity === "BLOCKING").length,
          nonBlockingCount: r.issues.filter((i) => i.severity === "NON_BLOCKING")
            .length,
        }));
        const task = pr.taskId ? tasks.find((t) => t.id === pr.taskId) : null;
        return {
          pullRequest: pr,
          task,
          latestReview: latest
            ? {
                id: latest.id,
                version: latest.version,
                verdict: latest.verdict,
                summary: latest.summary,
                completedAt: latest.completedAt,
                issues: latest.issues,
              }
            : null,
          iterations,
        };
      });

      return {
        feature: fr,
        pipelineStatus,
        blockingCount: blockingIssues.length,
        nonBlockingCount: nonBlockingIssues.length,
        blockingIssues,
        nonBlockingIssues,
        pullRequests: prSummaries,
        totalReviewIterations: reviews.length,
        activeRun,
        tasks,
      };
    }),
});
