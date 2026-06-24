import { generateObject } from "ai";

import { renderPrdMarkdown } from "./markdown";
import { discoveryModel, MODELS } from "./model";
import { buildPrdPrompt, PRD_SYSTEM, type RequestContext } from "./prompts";
import { PrdSchema, type Prd } from "./schemas";

export interface PrdResult {
  prd: Prd;
  markdown: string;
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
}

/**
 * Generates a complete, structured PRD from a request and its clarification
 * answers, returning both the structured object and rendered markdown. Throws if
 * OPENAI_API_KEY is missing or the model output fails schema validation.
 */
export async function generatePrd(ctx: RequestContext): Promise<PrdResult> {
  const { object, usage } = await generateObject({
    model: discoveryModel(),
    schema: PrdSchema,
    system: PRD_SYSTEM,
    prompt: buildPrdPrompt(ctx),
  });

  return {
    prd: object,
    markdown: renderPrdMarkdown(object),
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.discovery,
  };
}
