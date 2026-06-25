import { clarifyFeature } from "./functions/clarify";
import { githubInstallationSyncFn } from "./functions/githubInstallationSync";
import { githubPrSyncFn } from "./functions/githubPrSync";
import { githubRepoBackfillFn } from "./functions/githubRepoBackfill";
import { generatePrdFn } from "./functions/prdGenerate";
import { generateTasksFn } from "./functions/tasksGenerate";

export {
  inngest,
  clarifyRequested,
  prdRequested,
  tasksRequested,
  githubPrSyncRequested,
  githubRepoBackfillRequested,
  githubInstallationSyncRequested,
  CLARIFY_EVENT,
  PRD_EVENT,
  TASKS_EVENT,
  GITHUB_PR_SYNC_EVENT,
  GITHUB_REPO_BACKFILL_EVENT,
  GITHUB_INSTALLATION_SYNC_EVENT,
  type DiscoveryEventData,
  type GithubPrSyncData,
  type GithubRepoBackfillData,
  type GithubInstallationSyncData,
} from "./client";

/** All Inngest functions, registered by the web app's `/api/inngest` route. */
export const functions = [
  clarifyFeature,
  generatePrdFn,
  generateTasksFn,
  githubPrSyncFn,
  githubRepoBackfillFn,
  githubInstallationSyncFn,
];
