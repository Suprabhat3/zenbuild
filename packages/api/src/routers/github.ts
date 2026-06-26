import { TRPCError } from "@trpc/server";
import {
  buildInstallUrl,
  buildManageInstallationUrl,
  isGithubConfigured,
  listInstallationRepositories,
  type RepoSummary,
} from "@zenbuild/github";
import { githubRepoBackfillRequested, inngest } from "@zenbuild/jobs";
import { z } from "zod";

import { triggerRepoAnalyze } from "../lib/coding";
import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

/**
 * GitHub integration: org-level App installations + per-project repository
 * connections. Installation/connection are sensitive integration actions, so
 * they're gated to owners/admins; reads are open to any member.
 *
 * Everything that talks to GitHub degrades gracefully when the App is
 * unconfigured (`isGithubConfigured()` is false): `status` reports it, and the
 * mutations surface a clear PRECONDITION_FAILED rather than throwing on boot.
 */
export const githubRouter = createTRPCRouter({
  /** Configuration + connected installations for the active org. */
  status: orgProcedure.query(async ({ ctx }) => {
    const installations = await ctx.db.githubInstallation.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { repositories: true } } },
    });

    return {
      configured: isGithubConfigured(),
      installations: installations.map((i) => ({
        id: i.id,
        accountLogin: i.accountLogin,
        accountType: i.accountType,
        repositoryCount: i._count.repositories,
        manageUrl: buildManageInstallationUrl(i.accountLogin),
        createdAt: i.createdAt,
      })),
    };
  }),

  /** Signed URL that starts the install flow (owners/admins only). */
  installUrl: requireRole("owner", "admin").mutation(({ ctx }) => {
    if (!isGithubConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "GitHub App is not configured on this deployment.",
      });
    }
    const url = buildInstallUrl(
      { organizationId: ctx.organizationId, userId: ctx.user.id },
      Date.now(),
    );
    return { url };
  }),

  /**
   * Repositories available to connect: everything the org's installations can
   * access, minus repos already connected. Optionally filtered to one
   * installation.
   */
  listAvailableRepos: orgProcedure
    .input(z.object({ installationId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!isGithubConfigured()) return { configured: false, repos: [] };

      const installations = await ctx.db.githubInstallation.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input?.installationId ? { id: input.installationId } : {}),
        },
      });
      if (installations.length === 0) return { configured: true, repos: [] };

      const connected = await ctx.db.repository.findMany({
        where: { organizationId: ctx.organizationId },
        select: { githubId: true },
      });
      const connectedIds = new Set(connected.map((r) => r.githubId.toString()));

      const seen = new Set<string>();
      const repos: (RepoSummary & { installationDbId: string })[] = [];
      for (const installation of installations) {
        let list: RepoSummary[];
        try {
          list = await listInstallationRepositories(installation.installationId);
        } catch {
          continue; // a revoked/suspended installation shouldn't break the rest
        }
        for (const repo of list) {
          const key = repo.githubId.toString();
          if (connectedIds.has(key) || seen.has(key)) continue;
          seen.add(key);
          repos.push({ ...repo, installationDbId: installation.id });
        }
      }

      repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
      return { configured: true, repos };
    }),

  /** Connected repositories for the org, optionally scoped to a project. */
  repositories: orgProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const repos = await ctx.db.repository.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input?.projectId ? { projectId: input.projectId } : {}),
        },
        orderBy: { fullName: "asc" },
        include: {
          installation: { select: { accountLogin: true } },
          project: { select: { id: true, name: true, key: true } },
          _count: { select: { pullRequests: true } },
        },
      });

      return repos.map((r) => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        fullName: r.fullName,
        defaultBranch: r.defaultBranch,
        private: r.private,
        url: `https://github.com/${r.fullName}`,
        connected: r.installationId !== null,
        analyzedAt: r.analyzedAt,
        project: r.project,
        pullRequestCount: r._count.pullRequests,
        createdAt: r.createdAt,
      }));
    }),

  /** Connect a repo to a project (owners/admins); backfills its open PRs. */
  connect: requireRole("owner", "admin")
    .input(
      z.object({
        installationId: z.string(),
        projectId: z.string(),
        githubId: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isGithubConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub App is not configured on this deployment.",
        });
      }

      const [installation, project] = await Promise.all([
        ctx.db.githubInstallation.findFirst({
          where: { id: input.installationId, organizationId: ctx.organizationId },
        }),
        ctx.db.project.findFirst({
          where: {
            id: input.projectId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        }),
      ]);
      if (!installation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Installation not found." });
      }
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      }

      // Re-verify the repo is actually accessible to this installation rather
      // than trusting a client-supplied id.
      let repos: RepoSummary[];
      try {
        repos = await listInstallationRepositories(installation.installationId);
      } catch {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Could not reach GitHub to verify the repository.",
        });
      }
      const match = repos.find((r) => r.githubId === input.githubId);
      if (!match) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "That repository is not accessible to this installation.",
        });
      }

      const existing = await ctx.db.repository.findUnique({
        where: {
          organizationId_githubId: {
            organizationId: ctx.organizationId,
            githubId: BigInt(match.githubId),
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That repository is already connected.",
        });
      }

      const repository = await ctx.db.$transaction(async (tx) => {
        const created = await tx.repository.create({
          data: {
            organizationId: ctx.organizationId,
            projectId: project.id,
            installationId: installation.id,
            githubId: BigInt(match.githubId),
            owner: match.owner,
            name: match.name,
            fullName: match.fullName,
            defaultBranch: match.defaultBranch,
            private: match.private,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "github.repo.connect",
            entityType: "repository",
            entityId: created.id,
            metadata: { fullName: match.fullName, projectId: project.id },
          },
        });
        return created;
      });

      // Backfill currently-open PRs so the list isn't empty until the next event.
      await inngest.send(
        githubRepoBackfillRequested.create({
          organizationId: ctx.organizationId,
          repositoryId: repository.id,
        }),
      );

      // Analyze the repo up front so the coding agent (Phase 8) has grounding
      // context ready before the first task is implemented.
      await triggerRepoAnalyze(ctx.db, {
        organizationId: ctx.organizationId,
        repositoryId: repository.id,
        actorId: ctx.user.id,
      });

      return { id: repository.id, fullName: match.fullName };
    }),

  /** Disconnect a repository (owners/admins). Tracked PRs cascade away. */
  disconnect: requireRole("owner", "admin")
    .input(z.object({ repositoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.repository.findFirst({
        where: { id: input.repositoryId, organizationId: ctx.organizationId },
        select: { id: true, fullName: true },
      });
      if (!repo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found." });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.repository.delete({ where: { id: repo.id } });
        await tx.auditLog.create({
          data: {
            organizationId: ctx.organizationId,
            actorId: ctx.user.id,
            action: "github.repo.disconnect",
            entityType: "repository",
            entityId: repo.id,
            metadata: { fullName: repo.fullName },
          },
        });
      });

      return { id: repo.id };
    }),
});
