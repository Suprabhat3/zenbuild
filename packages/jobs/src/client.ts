import { serverEnv } from "@zenbuild/env";
import { eventType, Inngest } from "inngest";
import { z } from "zod";

/**
 * Inngest client for ZenBuild's async workflows. In local dev, leave the keys
 * blank and run the Inngest dev server (`npx inngest-cli@latest dev`); events are
 * sent to it automatically. In production both keys must be set.
 *
 * Events are declared with `eventType` (Inngest v4) so triggers and `send()`
 * payloads share one zod-validated schema.
 */

const discoveryData = z.object({
  featureRequestId: z.string(),
  organizationId: z.string(),
  workflowRunId: z.string(),
  /** userId that initiated the run, for auditing. */
  triggeredBy: z.string().optional(),
});

export const CLARIFY_EVENT = "feature/clarify.requested";
export const PRD_EVENT = "feature/prd.requested";
export const TASKS_EVENT = "feature/tasks.requested";

export const clarifyRequested = eventType(CLARIFY_EVENT, {
  schema: discoveryData,
});
export const prdRequested = eventType(PRD_EVENT, { schema: discoveryData });
export const tasksRequested = eventType(TASKS_EVENT, { schema: discoveryData });

export type DiscoveryEventData = z.infer<typeof discoveryData>;

// --- GitHub integration events (Phase 7) ------------------------------------

/** Sync a single PR from GitHub into ZenBuild (open/synchronize/close/etc). */
const prSyncData = z.object({
  organizationId: z.string(),
  repositoryId: z.string(),
  prNumber: z.number().int(),
  /** GitHub webhook action, for observability ("opened" | "synchronize" | …). */
  reason: z.string().optional(),
});

/** Backfill all currently-open PRs for a freshly connected repository. */
const repoBackfillData = z.object({
  organizationId: z.string(),
  repositoryId: z.string(),
});

/** React to an installation lifecycle change (e.g. the App being uninstalled). */
const installationSyncData = z.object({
  installationId: z.number().int(),
  action: z.string(),
});

export const GITHUB_PR_SYNC_EVENT = "github/pr.sync";
export const GITHUB_REPO_BACKFILL_EVENT = "github/repo.backfill";
export const GITHUB_INSTALLATION_SYNC_EVENT = "github/installation.sync";

export const githubPrSyncRequested = eventType(GITHUB_PR_SYNC_EVENT, {
  schema: prSyncData,
});
export const githubRepoBackfillRequested = eventType(
  GITHUB_REPO_BACKFILL_EVENT,
  { schema: repoBackfillData },
);
export const githubInstallationSyncRequested = eventType(
  GITHUB_INSTALLATION_SYNC_EVENT,
  { schema: installationSyncData },
);

export type GithubPrSyncData = z.infer<typeof prSyncData>;
export type GithubRepoBackfillData = z.infer<typeof repoBackfillData>;
export type GithubInstallationSyncData = z.infer<typeof installationSyncData>;

export const inngest = new Inngest({
  id: "zenbuild",
  eventKey: serverEnv.INNGEST_EVENT_KEY,
});
