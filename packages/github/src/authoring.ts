import { getInstallationOctokit } from "./app";

/**
 * Write-side GitHub operations for the Phase-8 coding agent: read the file tree
 * + individual files to ground generation, then land changes as a branch +
 * commit + pull request via the Git Data API.
 *
 * We commit *whole file contents* (not diff hunks) through blobs → tree →
 * commit → ref, which applies deterministically regardless of the base state.
 * Everything uses the per-installation token (least privilege) minted by the App.
 */

/** Files larger than this aren't returned inline (keeps prompts/results bounded). */
const MAX_FILE_BYTES = 100_000;
/** Cap the recursive tree we expose to the agent. */
const MAX_TREE_ENTRIES = 4_000;

/** Recursive list of file (blob) paths on a branch. `truncated` if GitHub capped it. */
export async function getRepoTree(
  installationId: number | bigint,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ paths: string[]; truncated: boolean }> {
  const octokit = await getInstallationOctokit(installationId);

  const { data: branchData } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch,
  });
  const treeSha = branchData.commit.commit.tree.sha;

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "true",
  });

  const paths = tree.tree
    .filter((e) => e.type === "blob" && typeof e.path === "string")
    .map((e) => e.path as string)
    .slice(0, MAX_TREE_ENTRIES);

  return { paths, truncated: Boolean(tree.truncated) || paths.length >= MAX_TREE_ENTRIES };
}

/** Read a single file's UTF-8 contents on a branch, or null if absent/binary/too big. */
export async function getFileContent(
  installationId: number | bigint,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ path: string; content: string; truncated: boolean } | null> {
  const octokit = await getInstallationOctokit(installationId);

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    // Directories come back as arrays; we only read files.
    if (Array.isArray(data) || data.type !== "file") return null;
    if (data.size > MAX_FILE_BYTES) {
      return { path, content: "", truncated: true };
    }
    if (typeof data.content !== "string") return null;
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { path, content, truncated: false };
  } catch (err) {
    // A 404 (file doesn't exist) is an expected "not found", not an error.
    if (isStatus(err, 404)) return null;
    throw err;
  }
}

export interface FileWrite {
  path: string;
  contents: string;
}

export interface OpenPullRequestInput {
  installationId: number | bigint;
  owner: string;
  repo: string;
  baseBranch: string;
  headBranch: string;
  /** Files to create/overwrite (whole contents). */
  files: FileWrite[];
  /** Repo-relative paths to delete. */
  deletions?: string[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export interface OpenedPullRequest {
  number: number;
  url: string;
  headRef: string;
  baseRef: string;
  headSha: string;
  commitSha: string;
  /** True if an open PR already existed for this branch and was reused. */
  reused: boolean;
}

/**
 * Lands `files`/`deletions` on `headBranch` (created or fast-forwarded from
 * `baseBranch`) as one commit, then opens a PR into `baseBranch`. Idempotent on
 * re-run: an existing branch is updated and an existing open PR is reused.
 */
export async function openPullRequestWithChanges(
  input: OpenPullRequestInput,
): Promise<OpenedPullRequest> {
  const {
    installationId,
    owner,
    repo,
    baseBranch,
    headBranch,
    files,
    deletions = [],
    commitMessage,
    prTitle,
    prBody,
  } = input;

  const octokit = await getInstallationOctokit(installationId);

  // 1. Resolve the base branch tip + its tree.
  const { data: baseRef } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseCommitSha = baseRef.object.sha;
  const { data: baseCommit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: baseCommitSha,
  });

  // 2. Create blobs for written files.
  const writeEntries = await Promise.all(
    files.map(async (f) => {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: Buffer.from(f.contents, "utf-8").toString("base64"),
        encoding: "base64",
      });
      return {
        path: normalizePath(f.path),
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    }),
  );

  // Deletions: tree entries with a null sha remove the path.
  const deleteEntries = deletions.map((p) => ({
    path: normalizePath(p),
    mode: "100644" as const,
    type: "blob" as const,
    sha: null,
  }));

  // 3. Build the new tree on top of the base tree, 4. commit it.
  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: [...writeEntries, ...deleteEntries],
  });
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: [baseCommitSha],
  });

  // 5. Point the head branch at the new commit (create, or force-update on re-run).
  const fullRef = `refs/heads/${headBranch}`;
  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: fullRef,
      sha: newCommit.sha,
    });
  } catch (err) {
    if (!isStatus(err, 422)) throw err; // 422 = ref already exists
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${headBranch}`,
      sha: newCommit.sha,
      force: true,
    });
  }

  // 6. Open the PR (or reuse an existing open one for this head).
  try {
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      head: headBranch,
      base: baseBranch,
      body: prBody,
    });
    return {
      number: pr.number,
      url: pr.html_url,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: pr.head.sha,
      commitSha: newCommit.sha,
      reused: false,
    };
  } catch (err) {
    if (!isStatus(err, 422)) throw err; // 422 = a PR for this head already exists
    const { data: existing } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      head: `${owner}:${headBranch}`,
    });
    const pr = existing[0];
    if (!pr) throw err;
    return {
      number: pr.number,
      url: pr.html_url,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: newCommit.sha,
      commitSha: newCommit.sha,
      reused: true,
    };
  }
}

/** Normalize a model-supplied path: forward slashes, no leading slash or "./". */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "");
}

/** Narrow an unknown Octokit error to a given HTTP status. */
function isStatus(err: unknown, status: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: unknown }).status === status
  );
}
