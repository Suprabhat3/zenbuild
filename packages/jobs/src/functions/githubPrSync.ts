import { db } from "@zenbuild/db";
import {
  fetchPullRequest,
  looksAgentAuthored,
  parseZenbuildRef,
} from "@zenbuild/github";
import type { InngestFunction } from "inngest";

import { githubPrSyncRequested, inngest } from "../client";
import { enqueuePrReview, shouldAutoReviewAfterSync } from "../triggerReview";

/**
 * `github/pr.sync` → fetch a PR (with changed files + unified diff) live from
 * GitHub and upsert it as a tracked `PullRequest`. Triggered on PR
 * open/synchronize/reopen/close and on pushes to a tracked PR's branch.
 *
 * Linking: we recover the originating feature request / task from the PR body
 * marker or branch name, but only trust IDs that actually belong to this repo's
 * organization (a PR body is attacker-controlled). Unlinkable PRs are still
 * tracked — just without a feature-request association.
 */
export const githubPrSyncFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "github-pr-sync",
    name: "Sync GitHub PR",
    retries: 2,
    triggers: [githubPrSyncRequested],
  },
  async ({ event, step }) => {
    const { organizationId, repositoryId, prNumber } = event.data;

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
        installationId: r.installation.installationId.toString(),
      };
    });

    const pull = await step.run("fetch-pull-request", () =>
      fetchPullRequest(
        BigInt(repo.installationId),
        repo.owner,
        repo.name,
        prNumber,
      ),
    );

    const upserted = await step.run("upsert-pull-request", async () => {
      // Resolve + validate the originating feature request / task.
      const ref = parseZenbuildRef(pull.body, pull.headRef);
      let featureRequestId: string | null = null;
      let taskId: string | null = null;

      if (ref.featureRequestId) {
        const fr = await db.featureRequest.findFirst({
          where: { id: ref.featureRequestId, organizationId },
          select: { id: true },
        });
        if (fr) {
          featureRequestId = fr.id;
          if (ref.taskId) {
            const task = await db.task.findFirst({
              where: { id: ref.taskId, featureRequestId: fr.id },
              select: { id: true },
            });
            taskId = task?.id ?? null;
          }
        }
      }

      const origin = looksAgentAuthored(pull.body, pull.headRef)
        ? "AGENT"
        : "EXTERNAL";

      const data = {
        title: pull.title,
        body: pull.body,
        status: pull.status,
        authorLogin: pull.authorLogin,
        headRef: pull.headRef,
        baseRef: pull.baseRef,
        headSha: pull.headSha,
        url: pull.url,
        changedFiles: pull.changedFiles,
        diff: pull.diff,
        mergedAt: pull.mergedAt,
        featureRequestId,
        taskId,
      };

      await db.pullRequest.upsert({
        where: {
          repositoryId_number: { repositoryId, number: pull.number },
        },
        create: {
          organizationId,
          repositoryId,
          number: pull.number,
          origin,
          ...data,
        },
        // `origin` is set on first ingest and not flipped on later syncs.
        update: data,
      });

      return {
        featureRequestId,
        headSha: pull.headSha,
        status: pull.status,
      };
    });

    await step.run("maybe-trigger-review", async () => {
      if (upserted.status !== "OPEN" || !upserted.featureRequestId) {
        return { skipped: true, reason: "not-open-or-unlinked" };
      }

      const fr = await db.featureRequest.findFirst({
        where: { id: upserted.featureRequestId, organizationId },
        select: { id: true, status: true },
      });
      if (!fr) return { skipped: true, reason: "feature-not-found" };

      const tracked = await db.pullRequest.findFirst({
        where: { repositoryId, number: pull.number },
        select: { id: true },
      });
      if (!tracked) return { skipped: true, reason: "pr-not-tracked" };

      const decision = await shouldAutoReviewAfterSync({
        organizationId,
        pullRequestId: tracked.id,
        headSha: upserted.headSha,
        featureRequestId: fr.id,
        featureStatus: fr.status,
        reason: event.data.reason,
      });
      if (!decision.enqueue) {
        return { skipped: true, reason: decision.skipReason };
      }

      const run = await enqueuePrReview({
        organizationId,
        pullRequestId: tracked.id,
        featureRequestId: fr.id,
        headSha: upserted.headSha,
        triggeredBy: "webhook",
        isReReview: decision.isReReview,
      });
      return { skipped: false, workflowRunId: run.id };
    });

    return { ok: true, number: pull.number, status: pull.status };
  },
);
