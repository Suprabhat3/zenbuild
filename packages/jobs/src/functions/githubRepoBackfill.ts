import { db } from "@zenbuild/db";
import { listOpenPullNumbers } from "@zenbuild/github";
import type { InngestFunction } from "inngest";

import { githubPrSyncRequested, githubRepoBackfillRequested, inngest } from "../client";

/**
 * `github/repo.backfill` → on connecting a repository, fan out a `github/pr.sync`
 * for every currently-open PR so the PR list reflects reality immediately rather
 * than only catching PRs opened after connection.
 */
export const githubRepoBackfillFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "github-repo-backfill",
    name: "Backfill repository PRs",
    retries: 2,
    triggers: [githubRepoBackfillRequested],
  },
  async ({ event, step }) => {
    const { organizationId, repositoryId } = event.data;

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

    const numbers = await step.run("list-open-prs", () =>
      listOpenPullNumbers(BigInt(repo.installationId), repo.owner, repo.name),
    );

    if (numbers.length > 0) {
      await step.sendEvent(
        "fan-out-pr-sync",
        numbers.map((prNumber: number) =>
          githubPrSyncRequested.create({
            organizationId,
            repositoryId,
            prNumber,
            reason: "backfill",
          }),
        ),
      );
    }

    return { ok: true, queued: numbers.length };
  },
);
