import { z } from "zod";

/**
 * Structured output schemas for the Phase-8 coding agent. As with the discovery
 * agents these are the hard contract between the model and the rest of the
 * system — the model is *forced* to satisfy them, so downstream code (branch
 * creation, commit, PR body) never parses free-form text.
 */

// ---------------------------------------------------------------------------
// Repository analysis (repo.analyze) → grounding context for generation
// ---------------------------------------------------------------------------

const KeyDirectory = z.object({
  path: z.string().min(1).describe("Directory path relative to the repo root."),
  purpose: z
    .string()
    .min(1)
    .describe("What lives here / what it's responsible for."),
});

/**
 * A durable summary of a connected repository's stack and conventions, produced
 * once by the analysis agent and cached on `Repository.analysis`. It grounds the
 * code-generation agent so it writes code that fits the existing project.
 */
export const RepoContextSchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe("2-4 sentence overview of what this repository is and does."),
  primaryLanguage: z
    .string()
    .describe("The dominant programming language (empty if unclear)."),
  languages: z
    .array(z.string().min(1))
    .describe("Notable languages used in the repo."),
  frameworks: z
    .array(z.string().min(1))
    .describe("Frameworks / major libraries (e.g. Next.js, Django, Spring)."),
  packageManager: z
    .string()
    .describe("Detected package/dependency manager (e.g. pnpm, npm, pip)."),
  testCommand: z
    .string()
    .describe("Command to run the test suite, if discoverable. Empty if none."),
  lintCommand: z
    .string()
    .describe("Command to run lint/format checks, if discoverable. Empty if none."),
  conventions: z
    .array(z.string().min(1))
    .describe(
      "Concrete coding conventions to follow (style, structure, naming, testing).",
    ),
  keyDirectories: z
    .array(KeyDirectory)
    .describe("The most important directories and what they hold."),
  entryPoints: z
    .array(z.string().min(1))
    .describe("Key entry-point files (e.g. src/index.ts, app/main.py)."),
});
export type RepoContext = z.infer<typeof RepoContextSchema>;

// ---------------------------------------------------------------------------
// Code generation (task.implement) → a structured patch set
// ---------------------------------------------------------------------------

export const FileChangeKind = z.enum(["ADD", "MODIFY"]);
export type FileChangeKind = z.infer<typeof FileChangeKind>;

/**
 * One file the agent wants to create or overwrite. We deliberately use *whole
 * file contents* (not unified-diff hunks) — LLM-generated diffs frequently fail
 * to apply, whereas full contents commit deterministically via the Git Data API.
 */
const FileChange = z.object({
  path: z
    .string()
    .min(1)
    .describe("Repo-root-relative path. Forward slashes, no leading slash."),
  kind: FileChangeKind.describe(
    "ADD for a new file, MODIFY to overwrite an existing one.",
  ),
  contents: z
    .string()
    .describe("The complete new contents of the file (entire file, not a diff)."),
});
export type FileChange = z.infer<typeof FileChange>;

export const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

const SelfCheck = z.object({
  check: z.string().min(1).describe("What was verified (e.g. 'imports resolve')."),
  passed: z.boolean().describe("Whether the agent believes this check passes."),
  note: z.string().describe("Short detail; empty if nothing notable."),
});
export type SelfCheck = z.infer<typeof SelfCheck>;

/**
 * The complete implementation the agent submits for one task: the files to
 * write/delete, a PR title/body, a self-assessed confidence + risk, and a
 * self-check pass. The job layer turns this into a branch + commit + PR.
 */
export const ImplementationSchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe("Plain-language summary of what was implemented and how."),
  files: z
    .array(FileChange)
    .min(1)
    .max(60)
    .describe("Files to create or overwrite to implement the task."),
  deletions: z
    .array(z.string().min(1))
    .describe("Repo-relative paths to delete. Empty if none."),
  commitMessage: z
    .string()
    .min(1)
    .describe("A conventional-commit message for this change."),
  prTitle: z.string().min(1).describe("Concise pull-request title."),
  prBody: z
    .string()
    .min(1)
    .describe(
      "Markdown PR description: what changed, why, and how it satisfies the task.",
    ),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0-100 self-assessed confidence the change is correct & complete."),
  risk: RiskLevel.describe("Overall risk level of merging this change."),
  riskReasons: z
    .array(z.string().min(1))
    .describe("Concrete reasons behind the risk level. Empty if low/none."),
  selfChecks: z
    .array(SelfCheck)
    .describe("Self-verification the agent performed before submitting."),
  testsAdded: z
    .boolean()
    .describe("Whether this change includes or updates automated tests."),
  followUps: z
    .array(z.string().min(1))
    .describe("Known gaps / suggested follow-up work. Empty if none."),
});
export type Implementation = z.infer<typeof ImplementationSchema>;
