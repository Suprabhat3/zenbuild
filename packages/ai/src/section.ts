import { generateObject } from "ai";
import { z } from "zod";

import { renderPrdMarkdown } from "./markdown";
import { discoveryModel, MODELS } from "./model";
import {
  buildSectionRegenPrompt,
  PRD_SECTION_LABELS,
  PRD_SECTION_SYSTEM,
  type RequestContext,
} from "./prompts";
import { PrdSchema, type Prd } from "./schemas";

/** The editable/regeneratable PRD section keys. */
export const PRD_SECTION_KEYS = [
  "title",
  "problemStatement",
  "goals",
  "nonGoals",
  "userStories",
  "acceptanceCriteria",
  "edgeCases",
  "successMetrics",
] as const;

export type PrdSectionKey = (typeof PRD_SECTION_KEYS)[number];

export const PrdSectionKeySchema = z.enum(PRD_SECTION_KEYS);

export interface PrdSectionResult<K extends PrdSectionKey = PrdSectionKey> {
  value: Prd[K];
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
}

/**
 * Regenerates a single PRD section with the AI, grounded in the current full PRD
 * and the original request. Returns only the new value for that section (the
 * caller merges it into the PRD and persists). Throws if OPENAI_API_KEY is
 * missing or the model output fails schema validation.
 */
export async function regeneratePrdSection<K extends PrdSectionKey>(
  section: K,
  args: { ctx: RequestContext; current: Prd; instruction?: string },
): Promise<PrdSectionResult<K>> {
  // Reuse the exact field schema from PrdSchema so the regenerated value matches
  // the same constraints the full generator enforces.
  const fieldSchema = PrdSchema.shape[section];
  const wrapped = z.object({ value: fieldSchema });

  const { object, usage } = await generateObject({
    model: discoveryModel(),
    schema: wrapped,
    system: PRD_SECTION_SYSTEM,
    prompt: buildSectionRegenPrompt({
      ctx: args.ctx,
      sectionLabel: PRD_SECTION_LABELS[section],
      currentMarkdown: renderPrdMarkdown(args.current),
      instruction: args.instruction,
    }),
  });

  const value = (object as { value: Prd[K] }).value;

  return {
    value,
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.discovery,
  };
}
