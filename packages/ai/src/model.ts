import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { serverEnv } from "@zenbuild/env";

/**
 * Central model configuration for every AI operation. The model is chosen here
 * (not via env) so prompts and capabilities stay in lockstep with the code that
 * relies on them. `serverEnv.OPENAI_API_KEY` is asserted at the point of use so
 * earlier phases can boot without it.
 */

const DEFAULT_MODEL = "gpt-5.4";

let provider: ReturnType<typeof createOpenAI> | null = null;

function getProvider() {
  const apiKey = serverEnv.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. AI features require an OpenAI API key.",
    );
  }
  provider ??= createOpenAI({ apiKey });
  return provider;
}

/** The model used for product-discovery operations (clarification, PRD). */
export function discoveryModel(model: string = DEFAULT_MODEL): LanguageModel {
  return getProvider()(model);
}

export const MODELS = {
  discovery: DEFAULT_MODEL,
} as const;
