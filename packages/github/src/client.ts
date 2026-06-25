import { getInstallationOctokit } from "./app";

/** Normalized repository summary returned to the connect UI. */
export interface RepoSummary {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/** A single changed file in a PR. */
export interface ChangedFile {
  path: string;
  status: string; // added | modified | removed | renamed | ...
  additions: number;
  deletions: number;
}

export type IngestedPullStatus = "OPEN" | "CLOSED" | "MERGED" | "DRAFT";

/** Everything ZenBuild persists about a PR, fetched live from GitHub. */
export interface IngestedPull {
  number: number;
  title: string;
  body: string | null;
  status: IngestedPullStatus;
  authorLogin: string | null;
  headRef: string;
  baseRef: string;
  headSha: string | null;
  url: string;
  mergedAt: Date | null;
  changedFiles: ChangedFile[];
  diff: string;
}

/** Diffs above this size are truncated before storage (keeps rows/AI prompts sane). */
const MAX_DIFF_CHARS = 200_000;
const MAX_FILES = 300;

/** All repositories the given installation can access (paginated). */
export async function listInstallationRepositories(
  installationId: number | bigint,
): Promise<RepoSummary[]> {
  const octokit = await getInstallationOctokit(installationId);
  const repos = await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  );
  return repos.map((r) => ({
    githubId: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    private: r.private,
  }));
}

/** Open PR numbers for a repo (used to backfill on connect). */
export async function listOpenPullNumbers(
  installationId: number | bigint,
  owner: string,
  repo: string,
): Promise<number[]> {
  const octokit = await getInstallationOctokit(installationId);
  const pulls = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });
  return pulls.map((p) => p.number);
}

function resolveStatus(pr: {
  state: string;
  draft?: boolean | null;
  merged?: boolean | null;
  merged_at?: string | null;
}): IngestedPullStatus {
  if (pr.merged || pr.merged_at) return "MERGED";
  if (pr.state === "closed") return "CLOSED";
  if (pr.draft) return "DRAFT";
  return "OPEN";
}

/** Fetch a PR plus its changed files and unified diff, normalized for storage. */
export async function fetchPullRequest(
  installationId: number | bigint,
  owner: string,
  repo: string,
  pull_number: number,
): Promise<IngestedPull> {
  const octokit = await getInstallationOctokit(installationId);

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
  });

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number,
    per_page: 100,
  });

  // The diff is requested via media type; GitHub returns raw text, which the
  // typed client still types as the PR object — cast through unknown.
  const diffRes = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: "diff" },
  });
  const rawDiff = diffRes.data as unknown as string;
  const diff =
    rawDiff.length > MAX_DIFF_CHARS
      ? `${rawDiff.slice(0, MAX_DIFF_CHARS)}\n\n…diff truncated (${rawDiff.length} chars total)…`
      : rawDiff;

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? null,
    status: resolveStatus(pr),
    authorLogin: pr.user?.login ?? null,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    headSha: pr.head.sha ?? null,
    url: pr.html_url,
    mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
    changedFiles: files.slice(0, MAX_FILES).map((f) => ({
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
    diff,
  };
}
