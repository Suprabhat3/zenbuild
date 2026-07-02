import { clarifyFeature } from "./functions/clarify";
import { githubInstallationSyncFn } from "./functions/githubInstallationSync";
import { githubPrSyncFn } from "./functions/githubPrSync";
import { githubRepoBackfillFn } from "./functions/githubRepoBackfill";
import { generatePrdFn } from "./functions/prdGenerate";
import { prReviewFn } from "./functions/prReview";
import { releaseReadinessFn } from "./functions/releaseReadiness";
import { repoAnalyzeFn } from "./functions/repoAnalyze";
import { taskImplementFn } from "./functions/taskImplement";
import { generateTasksFn } from "./functions/tasksGenerate";
import { workflowReconcileFn } from "./functions/workflowReconcile";

export {
  inngest,
  clarifyRequested,
  prdRequested,
  tasksRequested,
  githubPrSyncRequested,
  githubRepoBackfillRequested,
  githubInstallationSyncRequested,
  repoAnalyzeRequested,
  taskImplementRequested,
  prReviewRequested,
  releaseReadinessRequested,
  CLARIFY_EVENT,
  PRD_EVENT,
  TASKS_EVENT,
  GITHUB_PR_SYNC_EVENT,
  GITHUB_REPO_BACKFILL_EVENT,
  GITHUB_INSTALLATION_SYNC_EVENT,
  REPO_ANALYZE_EVENT,
  TASK_IMPLEMENT_EVENT,
  PR_REVIEW_EVENT,
  RELEASE_READINESS_EVENT,
  type DiscoveryEventData,
  type GithubPrSyncData,
  type GithubRepoBackfillData,
  type GithubInstallationSyncData,
  type RepoAnalyzeData,
  type TaskImplementData,
  type PrReviewData,
  type ReleaseReadinessData,
} from "./client";

export { enqueuePrReview, shouldAutoReviewAfterSync } from "./triggerReview";
export { sendWorkflowEvent } from "./sendRunEvent";
export { computeFeatureReviewStatus } from "./reviewStatus";
export type { FeatureReviewPipelineStatus } from "./reviewStatus";

/** All Inngest functions, registered by the web app's `/api/inngest` route. */
export const functions = [
  clarifyFeature,
  generatePrdFn,
  generateTasksFn,
  githubPrSyncFn,
  githubRepoBackfillFn,
  githubInstallationSyncFn,
  repoAnalyzeFn,
  taskImplementFn,
  prReviewFn,
  releaseReadinessFn,
  workflowReconcileFn,
];
