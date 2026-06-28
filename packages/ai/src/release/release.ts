import { generateObject } from "ai";

import { discoveryModel, MODELS } from "../model";
import type { RequestContext } from "../prompts";
import {
  buildReleasePrompt,
  RELEASE_SYSTEM,
  type ReleasePullRequestContext,
  type ReleaseTaskContext,
} from "./prompts";
import { ReleaseReadinessSchema, type ReleaseReadiness } from "./schemas";

export interface ReleaseReadinessResult {
  readiness: ReleaseReadiness;
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
}

/**
 * Runs the Phase-12 release-readiness agent: judges PRD coverage, acceptance-
 * criteria status, and outstanding concerns across every linked PR, returning an
 * advisory verdict for the human approver. Grounded strictly in the approved
 * PRD, tasks, and the PR diffs + their latest reviews.
 */
export async function assessReleaseReadiness(args: {
  ctx: RequestContext;
  prdMarkdown: string;
  tasks: ReleaseTaskContext[];
  pullRequests: ReleasePullRequestContext[];
}): Promise<ReleaseReadinessResult> {
  const { object, usage } = await generateObject({
    model: discoveryModel(),
    schema: ReleaseReadinessSchema,
    system: RELEASE_SYSTEM,
    prompt: buildReleasePrompt(args),
  });

  return {
    readiness: object,
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.discovery,
  };
}
