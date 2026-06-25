/**
 * Linking a GitHub PR back to the ZenBuild feature request / task it implements.
 *
 * The coding agent (Phase 8) stamps PRs with a machine-readable marker and a
 * conventional branch name; here we parse either to recover the IDs. External
 * (human-opened) PRs can opt in by adding the same marker to their description.
 *
 * Conventions:
 *  - PR body marker:  `<!-- zenbuild fr=<frId> task=<taskId> -->`  (task optional)
 *  - Branch name:     `zenbuild/<frId>/<taskId>`  or  `zenbuild/<frId>`
 *
 * IDs are cuids (alphanumeric). The caller MUST still verify the parsed IDs
 * belong to the PR's organization before trusting them.
 */

export interface ZenbuildRef {
  featureRequestId: string | null;
  taskId: string | null;
}

const BODY_MARKER = /<!--\s*zenbuild\s+fr=([a-z0-9]+)(?:\s+task=([a-z0-9]+))?\s*-->/i;
const BRANCH_REF = /^zenbuild\/([a-z0-9]+)(?:\/([a-z0-9]+))?$/i;

/** Build the canonical branch name the coding agent uses for a task/feature. */
export function buildZenbuildBranch(
  featureRequestId: string,
  taskId?: string | null,
): string {
  return taskId
    ? `zenbuild/${featureRequestId}/${taskId}`
    : `zenbuild/${featureRequestId}`;
}

/** Build the body marker to embed in agent-authored PR descriptions. */
export function buildZenbuildMarker(
  featureRequestId: string,
  taskId?: string | null,
): string {
  return taskId
    ? `<!-- zenbuild fr=${featureRequestId} task=${taskId} -->`
    : `<!-- zenbuild fr=${featureRequestId} -->`;
}

/** Recover feature-request / task IDs from a PR. Body marker wins over branch. */
export function parseZenbuildRef(
  body: string | null | undefined,
  headRef: string | null | undefined,
): ZenbuildRef {
  if (body) {
    const m = BODY_MARKER.exec(body);
    if (m) return { featureRequestId: m[1] ?? null, taskId: m[2] ?? null };
  }
  if (headRef) {
    const m = BRANCH_REF.exec(headRef);
    if (m) return { featureRequestId: m[1] ?? null, taskId: m[2] ?? null };
  }
  return { featureRequestId: null, taskId: null };
}

/** Whether a PR looks like it was authored by the ZenBuild coding agent. */
export function looksAgentAuthored(
  body: string | null | undefined,
  headRef: string | null | undefined,
): boolean {
  return Boolean(
    (headRef && /^zenbuild\//i.test(headRef)) ||
      (body && BODY_MARKER.test(body)),
  );
}
