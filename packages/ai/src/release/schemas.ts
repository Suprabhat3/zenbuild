import { z } from "zod";

/**
 * Structured output for the Phase-12 release-readiness agent. The verdict is
 * ADVISORY — it informs the human reviewer but never gates the state machine on
 * its own. The hard gate (no unresolved blocking review issues) is enforced in
 * the API, not here.
 */

export const ReleaseVerdict = z.enum(["READY", "READY_WITH_RISKS", "NOT_READY"]);
export type ReleaseVerdict = z.infer<typeof ReleaseVerdict>;

export const AcceptanceCriterionStatus = z.enum([
  "MET",
  "PARTIAL",
  "UNMET",
  "UNKNOWN",
]);
export type AcceptanceCriterionStatus = z.infer<typeof AcceptanceCriterionStatus>;

export const AcceptanceCriterionAssessmentSchema = z.object({
  criterion: z
    .string()
    .min(1)
    .describe("The acceptance criterion being assessed, paraphrased briefly."),
  status: AcceptanceCriterionStatus.describe(
    "MET when clearly satisfied by the diff; PARTIAL when partially addressed; UNMET when not addressed; UNKNOWN when the diff is insufficient to tell.",
  ),
  evidence: z
    .string()
    .describe(
      "Short justification grounded in the PRD, tasks, or the PR diff. Empty only when truly N/A.",
    ),
});
export type AcceptanceCriterionAssessment = z.infer<
  typeof AcceptanceCriterionAssessmentSchema
>;

export const ReleaseConcernSchema = z.object({
  title: z.string().min(1).describe("Short headline for the concern."),
  severity: z
    .enum(["BLOCKING", "NON_BLOCKING"])
    .describe(
      "BLOCKING if it would make shipping risky/incorrect; NON_BLOCKING for follow-ups that need not block release.",
    ),
  detail: z
    .string()
    .min(1)
    .describe("Why this matters for shipping and what remains to be done."),
});
export type ReleaseConcern = z.infer<typeof ReleaseConcernSchema>;

export const ReleaseReadinessSchema = z.object({
  verdict: ReleaseVerdict.describe(
    "READY when the feature fully satisfies the PRD and is production-ready; READY_WITH_RISKS when shippable but with caveats the reviewer should weigh; NOT_READY when material gaps remain.",
  ),
  summary: z
    .string()
    .min(1)
    .describe(
      "Executive summary for the human approver: what was built, how well it covers the PRD, and the headline risks (3-6 sentences).",
    ),
  prdCoverage: z
    .string()
    .min(1)
    .describe(
      "Assessment of how completely the delivered PR(s) cover the PRD goals and scope, noting any goals left unaddressed.",
    ),
  acceptanceCriteria: z
    .array(AcceptanceCriterionAssessmentSchema)
    .max(40)
    .describe(
      "Status of each material acceptance criterion drawn from the PRD and tasks.",
    ),
  outstandingConcerns: z
    .array(ReleaseConcernSchema)
    .max(30)
    .describe(
      "Open concerns relevant to shipping, distinct from already-resolved review issues. Prefer high-signal items.",
    ),
  recommendation: z
    .string()
    .min(1)
    .describe(
      "Direct recommendation to the approver — e.g. ship, ship with the noted caveats, or send back for fixes — and why.",
    ),
});
export type ReleaseReadiness = z.infer<typeof ReleaseReadinessSchema>;
