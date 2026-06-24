import { z } from "zod";

/**
 * Structured output schemas for the product-discovery agents. These are the
 * contract between the model and the rest of the system: `generateObject` is
 * forced to satisfy them, so downstream code never parses free-form text.
 */

/**
 * The clarification agent's decision after analyzing a request:
 *  - ASK: needs more context; returns follow-up questions for the requester.
 *  - EDUCATE: the capability likely already exists or the ask is a duplicate /
 *    better solved another way; returns an explanation instead of building.
 *  - PROCEED: enough context to draft a PRD.
 */
export const ClarificationDecision = z.enum(["ASK", "EDUCATE", "PROCEED"]);
export type ClarificationDecision = z.infer<typeof ClarificationDecision>;

export const ClarificationSchema = z.object({
  decision: ClarificationDecision,
  /** One or two sentences the user sees explaining the decision. */
  reasoning: z
    .string()
    .min(1)
    .describe("Short, friendly explanation of the decision for the requester."),
  /**
   * Follow-up questions — populated only when decision is ASK. Keep focused:
   * the smallest set that unblocks a high-quality PRD.
   */
  questions: z
    .array(z.string().min(1))
    .max(6)
    .describe(
      "Targeted follow-up questions. Empty unless decision is ASK. Max 6.",
    ),
  /**
   * Guidance shown when decision is EDUCATE (e.g. existing feature, duplicate,
   * recommended alternative). Empty otherwise.
   */
  educationNote: z
    .string()
    .describe("Explanation shown when decision is EDUCATE. Empty otherwise."),
});
export type Clarification = z.infer<typeof ClarificationSchema>;

const UserStory = z.object({
  as: z.string().min(1).describe("The persona: 'As a <role>'"),
  want: z.string().min(1).describe("The capability: 'I want <goal>'"),
  soThat: z.string().min(1).describe("The value: 'so that <benefit>'"),
});

export const TaskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type TaskPriorityEnum = z.infer<typeof TaskPriorityEnum>;

/**
 * A single engineering task derived from an approved PRD. Dependencies are
 * expressed as 1-based indices into the generated `tasks` array (a task may only
 * depend on tasks that appear *before* it, which keeps the plan acyclic). The
 * persistence layer maps these indices to created task IDs.
 */
const GeneratedTask = z.object({
  title: z.string().min(1).describe("Short, imperative task title."),
  description: z
    .string()
    .min(1)
    .describe("What to build and why, grounded in the PRD."),
  acceptanceCriteria: z
    .array(z.string().min(1))
    .describe("Testable criteria for this task being done."),
  priority: TaskPriorityEnum.describe("Relative priority of the task."),
  estimate: z
    .number()
    .int()
    .min(1)
    .max(13)
    .describe("Story-point estimate (Fibonacci-ish: 1,2,3,5,8,13)."),
  suggestedAreas: z
    .array(z.string().min(1))
    .describe("Files, modules, or areas the coding agent should touch."),
  dependsOn: z
    .array(z.number().int().min(1))
    .describe(
      "1-based indices of earlier tasks this one depends on. Empty if none.",
    ),
});
export type GeneratedTask = z.infer<typeof GeneratedTask>;

export const TasksSchema = z.object({
  tasks: z
    .array(GeneratedTask)
    .min(1)
    .max(40)
    .describe("Ordered engineering tasks that fully deliver the PRD."),
});
export type TasksResult = z.infer<typeof TasksSchema>;

export const PrdSchema = z.object({
  title: z.string().min(1).describe("Concise PRD title."),
  problemStatement: z
    .string()
    .min(1)
    .describe("The user/business problem, grounded in the request context."),
  goals: z.array(z.string().min(1)).min(1).describe("What success looks like."),
  nonGoals: z
    .array(z.string().min(1))
    .describe("Explicitly out of scope, to prevent scope creep."),
  userStories: z.array(UserStory).min(1).describe("Concrete user stories."),
  acceptanceCriteria: z
    .array(z.string().min(1))
    .min(1)
    .describe("Testable, unambiguous criteria for done."),
  edgeCases: z
    .array(z.string().min(1))
    .describe("Edge cases and failure modes to handle."),
  successMetrics: z
    .array(z.string().min(1))
    .describe("Measurable signals the feature worked."),
});
export type Prd = z.infer<typeof PrdSchema>;
