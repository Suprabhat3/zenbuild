import { z } from "zod";

/**
 * Structured output for the Phase-9 QA review agent. Issues mirror the
 * `ReviewIssue` Prisma model so validated model output maps directly to DB rows.
 */

export const ReviewIssueSeverity = z.enum(["BLOCKING", "NON_BLOCKING"]);
export type ReviewIssueSeverity = z.infer<typeof ReviewIssueSeverity>;

export const ReviewIssueCategory = z.enum([
  "PRD_REQUIREMENT",
  "ACCEPTANCE_CRITERIA",
  "ENGINEERING_TASK",
  "SECURITY",
  "PERFORMANCE",
  "EDGE_CASE",
  "CODE_QUALITY",
]);
export type ReviewIssueCategory = z.infer<typeof ReviewIssueCategory>;

export const ReviewVerdictOutput = z.enum([
  "APPROVE",
  "REQUEST_CHANGES",
  "COMMENT",
]);
export type ReviewVerdictOutput = z.infer<typeof ReviewVerdictOutput>;

export const ReviewIssueOutputSchema = z.object({
  severity: ReviewIssueSeverity,
  category: ReviewIssueCategory,
  title: z
    .string()
    .min(1)
    .describe("Short headline for the issue (one line)."),
  explanation: z
    .string()
    .min(1)
    .describe(
      "Why this is a problem relative to the PRD, tasks, or production readiness — not just that something looks odd.",
    ),
  suggestion: z
    .string()
    .describe(
      "Concrete, actionable fix the author can apply. Empty only when truly N/A.",
    ),
  filePath: z
    .string()
    .describe(
      "Repo-root-relative path when the issue maps to a specific file. Empty if repo-wide.",
    ),
  line: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "1-based line number in the new file when pinpointing a location. Omit if unknown or file-wide.",
    ),
});
export type ReviewIssueOutput = z.infer<typeof ReviewIssueOutputSchema>;

/**
 * Complete QA review of a pull request against product + engineering requirements.
 */
export const PrReviewOutputSchema = z.object({
  verdict: ReviewVerdictOutput.describe(
    "APPROVE only when production-ready with no blocking gaps; REQUEST_CHANGES when blocking issues exist; COMMENT when feedback is advisory only.",
  ),
  summary: z
    .string()
    .min(1)
    .describe(
      "Executive summary for the PR author: what was reviewed, overall quality, and the main gaps (2-6 sentences).",
    ),
  issues: z
    .array(ReviewIssueOutputSchema)
    .max(30)
    .describe(
      "Every material gap found. Prefer fewer, high-signal issues over nitpicks.",
    ),
});
export type PrReviewOutput = z.infer<typeof PrReviewOutputSchema>;
