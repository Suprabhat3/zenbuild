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

// --- Coding agent events (Phase 8) ------------------------------------------

/** Analyze a connected repository into a durable RepoContext (repo.analyze). */
const repoAnalyzeData = z.object({
  organizationId: z.string(),
  repositoryId: z.string(),
  workflowRunId: z.string(),
  /** Feature request that prompted the analysis (for run association), if any. */
  featureRequestId: z.string().optional(),
  triggeredBy: z.string().optional(),
});

/** Implement a single task → branch + commit + PR (task.implement). */
const taskImplementData = z.object({
  organizationId: z.string(),
  featureRequestId: z.string(),
  taskId: z.string(),
  repositoryId: z.string(),
  workflowRunId: z.string(),
  triggeredBy: z.string().optional(),
});

export const REPO_ANALYZE_EVENT = "coding/repo.analyze";
export const TASK_IMPLEMENT_EVENT = "coding/task.implement";

export const repoAnalyzeRequested = eventType(REPO_ANALYZE_EVENT, {
  schema: repoAnalyzeData,
});
export const taskImplementRequested = eventType(TASK_IMPLEMENT_EVENT, {
  schema: taskImplementData,
});

export type RepoAnalyzeData = z.infer<typeof repoAnalyzeData>;
export type TaskImplementData = z.infer<typeof taskImplementData>;

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

// --- AI code review events (Phase 9) ----------------------------------------

/** Run the QA agent against a tracked pull request (pr.review). */
const prReviewData = z.object({
  organizationId: z.string(),
  pullRequestId: z.string(),
  featureRequestId: z.string(),
  workflowRunId: z.string(),
  /** "webhook" | userId */
  triggeredBy: z.string().optional(),
});

export const PR_REVIEW_EVENT = "review/pr.requested";

export const prReviewRequested = eventType(PR_REVIEW_EVENT, {
  schema: prReviewData,
});

export type PrReviewData = z.infer<typeof prReviewData>;

// --- Release readiness events (Phase 12) ------------------------------------

/** Assess whether a feature is ready to ship (release.readiness). */
const releaseReadinessData = z.object({
  organizationId: z.string(),
  featureRequestId: z.string(),
  workflowRunId: z.string(),
  /** "manual" | userId */
  triggeredBy: z.string().optional(),
});

export const RELEASE_READINESS_EVENT = "release/readiness.requested";

export const releaseReadinessRequested = eventType(RELEASE_READINESS_EVENT, {
  schema: releaseReadinessData,
});

export type ReleaseReadinessData = z.infer<typeof releaseReadinessData>;

export const inngest = new Inngest({
  id: "zenbuild",
  eventKey: serverEnv.INNGEST_EVENT_KEY,
});
