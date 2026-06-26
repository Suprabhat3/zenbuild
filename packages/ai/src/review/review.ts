import { generateObject } from "ai";

import { discoveryModel, MODELS } from "../model";
import type { RequestContext } from "../prompts";
import {
  buildReviewPrompt,
  REVIEW_SYSTEM,
  type PriorReviewContext,
  type PullRequestReviewContext,
  type TaskReviewContext,
} from "./prompts";
import { PrReviewOutputSchema, type PrReviewOutput } from "./schemas";

export interface ReviewPullRequestResult {
  review: PrReviewOutput;
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
}

/**
 * Runs the QA review agent against a pull request diff, grounded in the approved
 * PRD and engineering tasks. When `priorReview` is set (re-review after fixes),
 * the model verifies prior issues were addressed. Returns a validated structured
 * review suitable for persistence and GitHub posting.
 */
export async function reviewPullRequest(args: {
  ctx: RequestContext;
  prdMarkdown: string;
  tasks: TaskReviewContext[];
  pullRequest: PullRequestReviewContext;
  priorReview?: PriorReviewContext | null;
}): Promise<ReviewPullRequestResult> {
  const { object, usage } = await generateObject({
    model: discoveryModel(),
    schema: PrReviewOutputSchema,
    system: REVIEW_SYSTEM,
    prompt: buildReviewPrompt(args),
  });

  // Enforce consistency: blocking issues always mean REQUEST_CHANGES.
  const hasBlocking = object.issues.some((i) => i.severity === "BLOCKING");
  const review: PrReviewOutput = hasBlocking
    ? { ...object, verdict: "REQUEST_CHANGES" }
    : object.verdict === "APPROVE"
      ? object
      : { ...object, verdict: object.issues.length > 0 ? "COMMENT" : "APPROVE" };

  return {
    review,
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.discovery,
  };
}
