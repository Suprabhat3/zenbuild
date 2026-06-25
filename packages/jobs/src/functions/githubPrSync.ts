import { db } from "@zenbuild/db";
import {
  fetchPullRequest,
  looksAgentAuthored,
  parseZenbuildRef,
} from "@zenbuild/github";
import type { InngestFunction } from "inngest";

import { githubPrSyncRequested, inngest } from "../client";

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

    await step.run("upsert-pull-request", async () => {
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
    });

    return { ok: true, number: pull.number, status: pull.status };
  },
);
