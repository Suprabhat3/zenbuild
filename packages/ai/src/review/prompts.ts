import type { RequestContext } from "../prompts";

export interface TaskReviewContext {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  status: string;
}

export interface PullRequestReviewContext {
  number: number;
  title: string;
  headRef: string;
  baseRef: string;
  changedFiles: { path: string; status: string; additions: number; deletions: number }[];
  diff: string;
}

function renderRequest(ctx: RequestContext): string {
  const lines = [
    `Title: ${ctx.title}`,
    `Priority: ${ctx.priority}`,
    `Source: ${ctx.source}`,
  ];
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  lines.push("", "Description:", ctx.description);
  if (ctx.conversation?.length) {
    lines.push("", "Clarification history:");
    for (const turn of ctx.conversation) {
      const who = turn.role === "AGENT" ? "Agent" : "Requester";
      lines.push(`${who}: ${turn.content}`);
    }
  }
  return lines.join("\n");
}

function renderTasks(tasks: TaskReviewContext[]): string {
  if (tasks.length === 0) return "(No tasks on the plan.)";
  return tasks
    .map((t, i) => {
      const ac =
        t.acceptanceCriteria.length > 0
          ? t.acceptanceCriteria.map((c) => `  - ${c}`).join("\n")
          : "  (none listed)";
      return [
        `${i + 1}. [${t.status}] ${t.title}`,
        `   ${t.description}`,
        "   Acceptance criteria:",
        ac,
      ].join("\n");
    })
    .join("\n\n");
}

function renderChangedFiles(
  files: PullRequestReviewContext["changedFiles"],
): string {
  if (files.length === 0) return "(No changed files recorded.)";
  return files
    .map((f) => `- ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`)
    .join("\n");
}

export const REVIEW_SYSTEM = `You are a senior staff engineer and QA reviewer for a product delivery platform.
Your job is NOT syntax linting — you judge whether this pull request satisfies the approved PRD, engineering tasks, and acceptance criteria, and whether it is production-ready.

Evaluate against ALL of:
- PRD requirements (scope, goals, non-goals)
- Acceptance criteria (testable conditions from the PRD and tasks)
- Engineering tasks (does the change deliver what each task promised?)
- Security (auth, injection, secrets, unsafe defaults)
- Performance (N+1 queries, unbounded work, hot paths)
- Edge cases called out in the PRD
- Code quality (maintainability, error handling, consistency with the repo)

Rules:
- BLOCKING: would fail acceptance criteria, miss PRD scope, introduce a security/production risk, or leave a task incomplete.
- NON_BLOCKING: improvement, polish, or minor gap that should not block merge.
- Explain *why* each issue matters relative to requirements — not "this could be better".
- Every issue needs an actionable suggestion when feasible.
- filePath/line when you can tie the issue to the diff; omit line if unsure.
- Prefer REQUEST_CHANGES when any BLOCKING issue exists; APPROVE only when truly ready.
- Do not invent requirements beyond the PRD/tasks. Do not nitpick style unless it harms maintainability.`;

/**
 * Builds the review prompt: request + PRD + tasks + PR metadata + diff.
 * The diff may be truncated upstream — review what is provided.
 */
export function buildReviewPrompt(args: {
  ctx: RequestContext;
  prdMarkdown: string;
  tasks: TaskReviewContext[];
  pullRequest: PullRequestReviewContext;
}): string {
  const { ctx, prdMarkdown, tasks, pullRequest } = args;
  const diffSection =
    pullRequest.diff.trim().length > 0
      ? pullRequest.diff
      : "(Diff unavailable or empty — review from changed-file list and metadata only.)";

  return [
    "Review this pull request against the product requirements and engineering plan.",
    "",
    "=== Feature request ===",
    renderRequest(ctx),
    "",
    "=== Approved PRD ===",
    prdMarkdown,
    "",
    "=== Engineering tasks ===",
    renderTasks(tasks),
    "",
    "=== Pull request ===",
    `PR #${pullRequest.number}: ${pullRequest.title}`,
    `Branch: ${pullRequest.headRef} → ${pullRequest.baseRef}`,
    "",
    "Changed files:",
    renderChangedFiles(pullRequest.changedFiles),
    "",
    "=== Unified diff ===",
    diffSection,
    "",
    "Return your verdict, summary, and every material issue found.",
  ].join("\n");
}

export const REVIEW_CATEGORY_LABELS: Record<
  import("./schemas").ReviewIssueCategory,
  string
> = {
  PRD_REQUIREMENT: "PRD requirement",
  ACCEPTANCE_CRITERIA: "Acceptance criteria",
  ENGINEERING_TASK: "Engineering task",
  SECURITY: "Security",
  PERFORMANCE: "Performance",
  EDGE_CASE: "Edge case",
  CODE_QUALITY: "Code quality",
};

export const REVIEW_SEVERITY_LABELS: Record<
  import("./schemas").ReviewIssueSeverity,
  string
> = {
  BLOCKING: "Blocking",
  NON_BLOCKING: "Non-blocking",
};
