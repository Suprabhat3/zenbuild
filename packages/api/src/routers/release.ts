import { TRPCError } from "@trpc/server";
import type { ReleaseReadiness } from "@zenbuild/ai";
import {
  buildGithubReviewUrl,
  isGithubConfigured,
  mergePullRequest,
  type MergeMethod,
} from "@zenbuild/github";
import { computeFeatureReviewStatus } from "@zenbuild/jobs";
import { z } from "zod";

import { triggerReleaseReadiness } from "../lib/release";
import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

/** Feature states from which a release-readiness assessment makes sense. */
const ASSESSABLE = ["IN_REVIEW", "FIX_NEEDED", "APPROVED"] as const;
/** States the human-approval gate accepts (APPROVED allows retrying the ship). */
const APPROVABLE = ["IN_REVIEW", "APPROVED"] as const;
/** States from which a reviewer may reject back into the fix loop. */
const REJECTABLE = ["IN_REVIEW", "APPROVED"] as const;

const mergeMethodSchema = z.enum(["merge", "squash", "rebase"]);

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
} as const;

/**
 * Reads the readiness verdict snapshot off the latest completed
 * RELEASE_READINESS workflow run, if any.
 */
function readinessFromOutput(output: unknown): ReleaseReadiness | null {
  if (typeof output !== "object" || output === null) return null;
  const readiness = (output as { readiness?: unknown }).readiness;
  if (typeof readiness !== "object" || readiness === null) return null;
  return readiness as ReleaseReadiness;
}

/**
 * Phase-12 human approval & release. Consolidates everything an approver needs
 * (PRD, tasks, PRs, review history, outstanding issues, AI readiness verdict),
 * enforces the hard gate (IN_REVIEW with no unresolved blocking issues), and
 * ships — optionally merging the linked PR(s) via Octokit — or rejects back into
 * the fix loop. Approve/reject are role-gated (owner/admin) and audit-logged.
 */
export const releaseRouter = createTRPCRouter({
  /** Consolidated approval-screen data for a feature request. */
  summary: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          source: true,
          project: { select: { id: true, name: true, key: true } },
          prd: {
            select: { version: true, approvedAt: true, approvedById: true, markdown: true },
          },
        },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }

      const [tasks, pullRequests, latestRun, decision, pipelineStatus] =
        await Promise.all([
          ctx.db.task.findMany({
            where: { featureRequestId: fr.id },
            orderBy: { rank: "asc" },
            select: {
              id: true,
              title: true,
              status: true,
              acceptanceCriteria: true,
            },
          }),
          ctx.db.pullRequest.findMany({
            where: { featureRequestId: fr.id, organizationId: ctx.organizationId },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              number: true,
              title: true,
              url: true,
              status: true,
              headRef: true,
              mergedAt: true,
              repository: {
                select: {
                  fullName: true,
                  installation: { select: { id: true } },
                },
              },
              reviews: {
                where: { status: "COMPLETED" },
                orderBy: { version: "desc" },
                take: 1,
                select: {
                  id: true,
                  version: true,
                  verdict: true,
                  summary: true,
                  githubReviewId: true,
                  completedAt: true,
                  issues: {
                    select: issueSelect,
                    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
                  },
                },
              },
            },
          }),
          ctx.db.workflowRun.findFirst({
            where: {
              organizationId: ctx.organizationId,
              featureRequestId: fr.id,
              type: "RELEASE_READINESS",
              status: "COMPLETED",
            },
            orderBy: { createdAt: "desc" },
            select: { id: true, output: true, createdAt: true, finishedAt: true },
          }),
          ctx.db.releaseDecision.findUnique({
            where: { featureRequestId: fr.id },
            select: {
              decision: true,
              notes: true,
              createdAt: true,
              decidedById: true,
            },
          }),
          computeFeatureReviewStatus(ctx.db, input.featureRequestId),
        ]);

      const prs = pullRequests.map((pr) => {
        const latest = pr.reviews[0] ?? null;
        const openIssues = latest
          ? latest.issues.filter((i) => i.status === "OPEN")
          : [];
        const blockingCount = openIssues.filter(
          (i) => i.severity === "BLOCKING",
        ).length;
        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          url: pr.url,
          status: pr.status,
          headRef: pr.headRef,
          mergedAt: pr.mergedAt,
          repositoryFullName: pr.repository.fullName,
          hasInstallation: Boolean(pr.repository.installation),
          latestReview: latest
            ? {
                id: latest.id,
                version: latest.version,
                verdict: latest.verdict,
                summary: latest.summary,
                completedAt: latest.completedAt,
                issues: latest.issues,
                openBlockingCount: blockingCount,
                openNonBlockingCount: openIssues.length - blockingCount,
                githubReviewUrl: buildGithubReviewUrl(pr.url, latest.githubReviewId),
              }
            : null,
        };
      });

      const openPrs = prs.filter((p) => p.status === "OPEN");
      const openBlockingCount = openPrs.reduce(
        (sum, p) => sum + (p.latestReview?.openBlockingCount ?? 0),
        0,
      );
      const unreviewedOpenPrs = openPrs.filter((p) => !p.latestReview).length;

      const prdApproved = Boolean(fr.prd?.approvedAt);
      const isInReview = fr.status === "IN_REVIEW";
      // Hard gate: only IN_REVIEW features with an approved PRD and no open
      // blocking issues across linked PRs can be approved.
      const gate = {
        prdApproved,
        isInReview,
        noBlockingIssues: openBlockingCount === 0 && pipelineStatus === "IN_REVIEW",
        canApprove:
          prdApproved &&
          isInReview &&
          openBlockingCount === 0 &&
          pipelineStatus === "IN_REVIEW",
      };

      return {
        feature: {
          id: fr.id,
          title: fr.title,
          description: fr.description,
          status: fr.status,
          priority: fr.priority,
          source: fr.source,
          project: fr.project,
        },
        prd: fr.prd
          ? { version: fr.prd.version, approvedAt: fr.prd.approvedAt }
          : null,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          acceptanceCriteria: Array.isArray(t.acceptanceCriteria)
            ? (t.acceptanceCriteria as unknown[]).filter(
                (c): c is string => typeof c === "string",
              )
            : [],
        })),
        pullRequests: prs,
        pipelineStatus,
        openBlockingCount,
        unreviewedOpenPrs,
        openPrCount: openPrs.length,
        mergeablePrCount: openPrs.filter((p) => p.hasInstallation).length,
        gate,
        readiness: latestRun
          ? {
              workflowRunId: latestRun.id,
              verdict: readinessFromOutput(latestRun.output),
              assessedAt: latestRun.finishedAt ?? latestRun.createdAt,
            }
          : null,
        decision,
        githubConfigured: isGithubConfigured(),
      };
    }),

  /** Triggers an AI release-readiness assessment (advisory). */
  assessReadiness: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true, prd: { select: { approvedAt: true } } },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }
      if (!fr.prd?.approvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The PRD must be approved before a release assessment.",
        });
      }
      if (!ASSESSABLE.includes(fr.status as (typeof ASSESSABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot assess readiness while the feature is in ${fr.status}.`,
        });
      }

      const inflight = await ctx.db.workflowRun.findFirst({
        where: {
          organizationId: ctx.organizationId,
          featureRequestId: fr.id,
          type: "RELEASE_READINESS",
          status: { in: ["QUEUED", "RUNNING"] },
        },
        select: { id: true },
      });
      if (inflight) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A release assessment is already in progress.",
        });
      }

      const run = await triggerReleaseReadiness(ctx.db, {
        organizationId: ctx.organizationId,
        featureRequestId: fr.id,
        actorId: ctx.user.id,
      });
      return { workflowRunId: run.id };
    }),

  /** Latest release-readiness workflow run — polled while the assessment runs. */
  readinessStatus: orgProcedure
    .input(z.object({ featureRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }

      const run = await ctx.db.workflowRun.findFirst({
        where: {
          organizationId: ctx.organizationId,
          featureRequestId: fr.id,
          type: "RELEASE_READINESS",
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
      if (!run) return { run: null, readiness: null };

      return {
        run: {
          id: run.id,
          status: run.status,
          progress: run.progress,
          step: run.step,
          error: run.error,
          createdAt: run.createdAt,
          finishedAt: run.finishedAt,
        },
        readiness:
          run.status === "COMPLETED" ? readinessFromOutput(run.output) : null,
      };
    }),

  /**
   * Human approval gate → ship. Hard-blocks unless the feature is IN_REVIEW (or
   * a previously-APPROVED feature retrying the ship) with an approved PRD and no
   * unresolved blocking review issues. Records an APPROVED ReleaseDecision, then
   * optionally merges the open linked PR(s) via Octokit. Ships (SHIPPED) when no
   * open PRs remain; otherwise rests at APPROVED until the PR(s) are merged.
   */
  approve: requireRole("owner", "admin")
    .input(
      z.object({
        featureRequestId: z.string(),
        notes: z.string().trim().max(2000).optional(),
        mergePullRequests: z.boolean().default(false),
        mergeMethod: mergeMethodSchema.default("squash"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true, prd: { select: { approvedAt: true } } },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }
      if (!APPROVABLE.includes(fr.status as (typeof APPROVABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve a feature in ${fr.status}. It must be in review with no blocking issues.`,
        });
      }
      if (!fr.prd?.approvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The PRD must be approved before shipping.",
        });
      }

      // Hard gate: no unresolved blocking issues on any open linked PR.
      const pipelineStatus = await computeFeatureReviewStatus(
        ctx.db,
        input.featureRequestId,
      );
      if (pipelineStatus !== "IN_REVIEW") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This feature still has unresolved blocking review issues and cannot be approved.",
        });
      }

      // Snapshot the latest AI readiness verdict onto the decision, if any.
      const latestRun = await ctx.db.workflowRun.findFirst({
        where: {
          organizationId: ctx.organizationId,
          featureRequestId: fr.id,
          type: "RELEASE_READINESS",
          status: "COMPLETED",
        },
        orderBy: { createdAt: "desc" },
        select: { output: true },
      });
      const readinessSnapshot = latestRun
        ? readinessFromOutput(latestRun.output)
        : null;

      // Record the approval decision + move to APPROVED.
      await ctx.db.$transaction(async (tx) => {
        await tx.releaseDecision.upsert({
          where: { featureRequestId: fr.id },
          create: {
            featureRequestId: fr.id,
            decision: "APPROVED",
            notes: input.notes ?? null,
            readiness: readinessSnapshot ?? undefined,
            decidedById: ctx.user.id,
          },
          update: {
            decision: "APPROVED",
            notes: input.notes ?? null,
            readiness: readinessSnapshot ?? undefined,
            decidedById: ctx.user.id,
          },
        });
        if (fr.status !== "APPROVED") {
          await tx.featureRequest.update({
            where: { id: fr.id },
            data: { status: "APPROVED" },
          });
        }
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "feature.approve",
            entityType: "feature_request",
            entityId: fr.id,
            metadata: { readinessVerdict: readinessSnapshot?.verdict ?? null },
          },
        });
      });

      // Optionally merge open linked PRs via Octokit (best effort).
      const openPrs = await ctx.db.pullRequest.findMany({
        where: {
          featureRequestId: fr.id,
          organizationId: ctx.organizationId,
          status: "OPEN",
        },
        select: {
          id: true,
          number: true,
          title: true,
          repository: {
            select: {
              owner: true,
              name: true,
              fullName: true,
              installation: { select: { installationId: true } },
            },
          },
        },
      });

      const merges: {
        pullRequestId: string;
        number: number;
        repository: string;
        merged: boolean;
        message?: string;
      }[] = [];

      if (input.mergePullRequests && isGithubConfigured()) {
        for (const pr of openPrs) {
          const installation = pr.repository.installation;
          if (!installation) {
            merges.push({
              pullRequestId: pr.id,
              number: pr.number,
              repository: pr.repository.fullName,
              merged: false,
              message: "Repository has no active GitHub installation.",
            });
            continue;
          }
          const result = await mergePullRequest({
            installationId: installation.installationId,
            owner: pr.repository.owner,
            repo: pr.repository.name,
            pullNumber: pr.number,
            method: input.mergeMethod as MergeMethod,
            commitTitle: `${pr.title} (#${pr.number})`,
          });
          if (result.merged) {
            await ctx.db.pullRequest.update({
              where: { id: pr.id },
              data: { status: "MERGED", mergedAt: result.mergedAt },
            });
            merges.push({
              pullRequestId: pr.id,
              number: pr.number,
              repository: pr.repository.fullName,
              merged: true,
            });
          } else {
            merges.push({
              pullRequestId: pr.id,
              number: pr.number,
              repository: pr.repository.fullName,
              merged: false,
              message: result.message,
            });
          }
        }
      }

      // Ship when no open PRs remain (all merged, or there were none); otherwise
      // rest at APPROVED until the remaining PR(s) are merged.
      const remainingOpen = await ctx.db.pullRequest.count({
        where: {
          featureRequestId: fr.id,
          organizationId: ctx.organizationId,
          status: "OPEN",
        },
      });
      const shipped = remainingOpen === 0;

      if (shipped) {
        await ctx.db.$transaction(async (tx) => {
          await tx.featureRequest.update({
            where: { id: fr.id },
            data: { status: "SHIPPED" },
          });
          await tx.auditLog.create({
            data: {
              organizationId: ctx.organizationId,
              actorId: ctx.user.id,
              action: "feature.ship",
              entityType: "feature_request",
              entityId: fr.id,
              metadata: {
                mergedCount: merges.filter((m) => m.merged).length,
              },
            },
          });
        });
      }

      return {
        approved: true,
        shipped,
        status: shipped ? ("SHIPPED" as const) : ("APPROVED" as const),
        merges,
        remainingOpen,
      };
    }),

  /**
   * Human rejection at the approval gate → back into the fix loop (FIX_NEEDED).
   * Requires a reason, records a REJECTED ReleaseDecision, and is audit-logged.
   */
  reject: requireRole("owner", "admin")
    .input(
      z.object({
        featureRequestId: z.string(),
        reason: z.string().trim().min(1, "A reason is required.").max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fr = await ctx.db.featureRequest.findFirst({
        where: { id: input.featureRequestId, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!fr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found." });
      }
      if (!REJECTABLE.includes(fr.status as (typeof REJECTABLE)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reject a feature in ${fr.status}.`,
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.releaseDecision.upsert({
          where: { featureRequestId: fr.id },
          create: {
            featureRequestId: fr.id,
            decision: "REJECTED",
            notes: input.reason,
            decidedById: ctx.user.id,
          },
          update: {
            decision: "REJECTED",
            notes: input.reason,
            decidedById: ctx.user.id,
            readiness: undefined,
          },
        });
        await tx.featureRequest.update({
          where: { id: fr.id },
          data: { status: "FIX_NEEDED" },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "feature.reject",
            entityType: "feature_request",
            entityId: fr.id,
            metadata: { reason: input.reason },
          },
        });
      });

      return { status: "FIX_NEEDED" as const };
    }),
});
