import type { RequestContext } from "../prompts";
import type { RepoContext } from "./schemas";

/**
 * Prompt builders for the coding agents. As elsewhere, every repo-/task-derived
 * value is clearly delimited so the model treats it as data, not instructions —
 * this matters more here because repository file contents are untrusted input.
 */

export interface RepoMeta {
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/** A task as handed to the implementation agent. */
export interface TaskContext {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  suggestedAreas: string[];
}

export const REPO_ANALYZE_SYSTEM = `You are a senior staff engineer onboarding onto an unfamiliar codebase.
Your job is to produce a concise, accurate map of the repository that another engineer (an AI coding agent) will rely on to make changes that fit the project.
Use the provided tools to list files and read the most informative ones (manifests, configs, READMEs, a few representative source files). Do not read everything — be efficient.
Ground every field strictly in what you actually observe. If something is unknown, leave it empty rather than guessing. Conventions must be concrete and actionable (e.g. "co-locate tests as *.test.ts next to source", not "write clean code").`;

export function buildRepoAnalyzePrompt(meta: RepoMeta): string {
  return [
    "Analyze this repository and produce a structured RepoContext.",
    "",
    "Repository",
    "---",
    `Full name: ${meta.fullName}`,
    `Default branch: ${meta.defaultBranch}`,
    `Visibility: ${meta.private ? "private" : "public"}`,
    "---",
    "",
    "Start by listing files to understand the layout, then read the package/dependency manifests, config, README, and a handful of representative source files. When you have enough to fill in every field accurately, call submit_repo_context.",
  ].join("\n");
}

function renderRequest(ctx: RequestContext): string {
  const lines = [`Title: ${ctx.title}`, `Priority: ${ctx.priority}`];
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  lines.push("", "Description:", ctx.description);
  return lines.join("\n");
}

function renderRepoContext(rc: RepoContext): string {
  const lines = [
    rc.summary,
    "",
    rc.primaryLanguage ? `Primary language: ${rc.primaryLanguage}` : "",
    rc.languages.length ? `Languages: ${rc.languages.join(", ")}` : "",
    rc.frameworks.length ? `Frameworks: ${rc.frameworks.join(", ")}` : "",
    rc.packageManager ? `Package manager: ${rc.packageManager}` : "",
    rc.testCommand ? `Test command: ${rc.testCommand}` : "",
    rc.lintCommand ? `Lint command: ${rc.lintCommand}` : "",
  ].filter(Boolean);
  if (rc.keyDirectories.length) {
    lines.push("", "Key directories:");
    for (const d of rc.keyDirectories) lines.push(`- ${d.path}: ${d.purpose}`);
  }
  if (rc.entryPoints.length) {
    lines.push("", `Entry points: ${rc.entryPoints.join(", ")}`);
  }
  if (rc.conventions.length) {
    lines.push("", "Conventions to follow:");
    for (const c of rc.conventions) lines.push(`- ${c}`);
  }
  return lines.join("\n");
}

export const IMPLEMENT_SYSTEM = `You are an expert software engineer implementing a single, well-scoped engineering task by editing a real repository.
You can explore the repo with the read-only tools (list_files, read_file). You MUST read any file before you modify it, and you should read enough surrounding code to match existing patterns, imports, and conventions.

Hard rules:
- Implement ONLY the given task — do not expand scope or refactor unrelated code.
- Match the repository's existing language, style, conventions, and structure exactly. New files must look like they were written by the team.
- Provide WHOLE file contents for every file you add or modify (never a diff or a fragment). Modified files must include the entire updated file.
- Prefer the smallest change that fully and correctly satisfies the task's acceptance criteria.
- Where the project has a test setup and it's feasible, include or update tests.
- Be honest in your self-assessment: set a realistic confidence, flag real risks, and list genuine follow-ups. Low-confidence or high-risk work is expected to be reviewed/edited by a human — do not inflate confidence.

When (and only when) your change is complete and you have verified it against the repo, call submit_implementation with the full patch set.`;

export function buildImplementPrompt(args: {
  ctx: RequestContext;
  prdMarkdown: string;
  task: TaskContext;
  repoContext: RepoContext;
  repoMeta: RepoMeta;
}): string {
  const { ctx, prdMarkdown, task, repoContext, repoMeta } = args;
  return [
    "Implement the following task in the repository. Explore as needed, then submit a complete patch set.",
    "",
    "Repository",
    "---",
    `Full name: ${repoMeta.fullName}`,
    `Default branch: ${repoMeta.defaultBranch}`,
    "---",
    "",
    "Repository context (from prior analysis)",
    "---",
    renderRepoContext(repoContext),
    "---",
    "",
    "Task to implement",
    "---",
    `Title: ${task.title}`,
    "",
    "Description:",
    task.description,
    "",
    task.acceptanceCriteria.length
      ? `Acceptance criteria:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`
      : "Acceptance criteria: (none specified)",
    task.suggestedAreas.length
      ? `\nSuggested areas to touch (hints, verify against the real tree):\n${task.suggestedAreas.map((a) => `- ${a}`).join("\n")}`
      : "",
    "---",
    "",
    "Originating feature request (for context)",
    "---",
    renderRequest(ctx),
    "---",
    "",
    "Product requirements (the agreed PRD this task is part of)",
    "---",
    prdMarkdown,
    "---",
  ].join("\n");
}
