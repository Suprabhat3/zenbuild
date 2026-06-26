import type { RepoToolkit } from "@zenbuild/ai";
import { getFileContent, getRepoTree } from "@zenbuild/github";

/**
 * Builds the read-only `RepoToolkit` the coding agents explore with, backed by
 * live Octokit calls on a given branch. The recursive tree is fetched once up
 * front (so `list_files` is cheap/offline); `read_file` fetches on demand.
 *
 * Must be constructed and used inside a single Inngest `step.run`, since it
 * holds the fetched tree + live closures (not serializable across steps).
 */
export async function buildOctokitToolkit(args: {
  installationId: number | bigint;
  owner: string;
  repo: string;
  ref: string;
}): Promise<{ toolkit: RepoToolkit; tree: { paths: string[]; truncated: boolean } }> {
  const { installationId, owner, repo, ref } = args;
  const tree = await getRepoTree(installationId, owner, repo, ref);

  const toolkit: RepoToolkit = {
    async listFiles(prefix) {
      if (!prefix) return tree.paths;
      const needle = prefix.toLowerCase();
      return tree.paths.filter((p) => p.toLowerCase().includes(needle));
    },
    async readFile(path) {
      return getFileContent(installationId, owner, repo, path, ref);
    },
  };

  return { toolkit, tree };
}
