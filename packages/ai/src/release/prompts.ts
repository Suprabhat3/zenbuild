import type { RequestContext } from "../prompts";

export interface ReleaseTaskContext {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  status: string;
}

export interface ReleasePullRequestContext {
  number: number;
  title: string;
  status: string;
  headRef: string;
  baseRef: string;
  changedFiles: { path: string; status: string; additions: number; deletions: number }[];
  diff: string;
  latestReview: {
    version: number;
    verdict: string | null;
    summary: string | null;
    issues: {
      severity: string;
      category: string;
      title: string;
      explanation: string;
      status: string;
    }[];
  } | null;
}

function renderRequest(ctx: RequestContext): string {
  const lines = [
    `Title: ${ctx.title}`,
    `Priority: ${ctx.priority}`,
    `Source: ${ctx.source}`,
  ];
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  lines.push("", "Description:", ctx.description);
  return lines.join("\n");
}

function renderTasks(tasks: ReleaseTaskContext[]): string {
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

function renderPullRequest(pr: ReleasePullRequestContext): string {
  const lines = [
    `PR #${pr.number} [${pr.status}]: ${pr.title}`,
    `Branch: ${pr.headRef} → ${pr.baseRef}`,
  ];

  if (pr.latestReview) {
    const r = pr.latestReview;
    const open = r.issues.filter((i) => i.status === "OPEN");
    const blocking = open.filter((i) => i.severity === "BLOCKING");
    lines.push(
      `Latest AI review v${r.version}: ${r.verdict ?? "unknown"} — ${blocking.length} open blocking, ${open.length - blocking.length} open non-blocking.`,
    );
    if (r.summary) lines.push(`Review summary: ${r.summary}`);
    if (open.length > 0) {
      lines.push("Open review issues:");
      for (const i of open.slice(0, 15)) {
        lines.push(`  - [${i.severity}/${i.category}] ${i.title}: ${i.explanation}`);
      }
    }
  } else {
    lines.push("No AI review on record for this PR yet.");
  }

  const files =
    pr.changedFiles.length > 0
      ? pr.changedFiles
          .slice(0, 50)
          .map((f) => `  - ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`)
          .join("\n")
      : "  (No changed files recorded.)";
  lines.push("Changed files:", files);

  if (pr.diff.trim().length > 0) {
    lines.push("Unified diff:", pr.diff);
  }

  return lines.join("\n");
}

export const RELEASE_SYSTEM = `You are a senior engineering manager performing a final release-readiness assessment before a human ships a feature to production.

You are given the approved PRD, the engineering tasks and their acceptance criteria, and every pull request that implements the feature (with diffs and the latest AI code-review per PR).

Your job:
- Judge how completely the delivered code satisfies the PRD goals, scope, and acceptance criteria.
- Assess each material acceptance criterion as MET / PARTIAL / UNMET / UNKNOWN, grounded in the diff and reviews.
- Surface outstanding concerns that bear on shipping — security, missing scope, untested edge cases, follow-ups — distinct from review issues already resolved.
- Give a clear verdict and a direct recommendation to the human approver.

Rules:
- READY only when the feature fully covers the PRD and there are no open blocking gaps.
- READY_WITH_RISKS when it is shippable but the approver should knowingly accept specific caveats.
- NOT_READY when material PRD scope or acceptance criteria are unmet, or open blocking issues remain.
- Be specific and grounded — cite the PRD, a task, a criterion, or the diff. Do not invent requirements beyond the PRD/tasks.
- Your verdict is advisory: the human makes the final call. Be honest about uncertainty (use UNKNOWN when the diff is insufficient).`;

export function buildReleasePrompt(args: {
  ctx: RequestContext;
  prdMarkdown: string;
  tasks: ReleaseTaskContext[];
  pullRequests: ReleasePullRequestContext[];
}): string {
  const { ctx, prdMarkdown, tasks, pullRequests } = args;
  return [
    "Assess whether this feature is ready to ship to production.",
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
    "=== Pull requests ===",
    pullRequests.length > 0
      ? pullRequests.map(renderPullRequest).join("\n\n---\n\n")
      : "(No pull requests are linked to this feature.)",
    "",
    "Return your readiness verdict, PRD-coverage assessment, per-criterion status, outstanding concerns, and a recommendation.",
  ].join("\n");
}

export const RELEASE_VERDICT_LABELS: Record<
  import("./schemas").ReleaseVerdict,
  string
> = {
  READY: "Ready to ship",
  READY_WITH_RISKS: "Ready with risks",
  NOT_READY: "Not ready",
};
