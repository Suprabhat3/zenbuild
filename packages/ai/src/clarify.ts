import { generateObject } from "ai";

import { discoveryModel, MODELS } from "./model";
import { buildClarifyPrompt, CLARIFY_SYSTEM, type RequestContext } from "./prompts";
import { ClarificationSchema, type Clarification } from "./schemas";

export interface ClarificationResult {
  clarification: Clarification;
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
}

/**
 * Runs the clarification agent over a request (plus any prior conversation) and
 * returns a validated decision. Throws if OPENAI_API_KEY is missing or the model
 * fails to produce a schema-valid object.
 */
export async function runClarification(
  ctx: RequestContext,
): Promise<ClarificationResult> {
  const { object, usage } = await generateObject({
    model: discoveryModel(),
    schema: ClarificationSchema,
    system: CLARIFY_SYSTEM,
    prompt: buildClarifyPrompt(ctx),
  });

  return {
    clarification: object,
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.discovery,
  };
}
