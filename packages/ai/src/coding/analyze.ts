import { generateText, hasToolCall, stepCountIs, tool } from "ai";

import { codingModel, MODELS } from "../model";
import {
  buildRepoAnalyzePrompt,
  REPO_ANALYZE_SYSTEM,
  type RepoMeta,
} from "./prompts";
import { RepoContextSchema, type RepoContext } from "./schemas";
import { buildRepoTools, MAX_TOOL_STEPS, type RepoToolkit } from "./toolkit";

export interface RepoAnalysisResult {
  context: RepoContext;
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
  /** Files the agent read while analyzing (for the reproducibility record). */
  filesRead: string[];
}

const SUBMIT_TOOL = "submit_repo_context";

/**
 * Analyzes a repository into a durable `RepoContext` by letting the model
 * explore the tree with read-only tools and then submit a structured summary.
 * The structured output is delivered via a final "answer tool" so the same call
 * can both use tools (explore) and return a validated object.
 *
 * Throws if OPENAI_API_KEY is missing or the model never submits a valid
 * context within the step budget.
 */
export async function analyzeRepo(args: {
  toolkit: RepoToolkit;
  repoMeta: RepoMeta;
}): Promise<RepoAnalysisResult> {
  const { tools, recordedReads } = buildRepoTools(args.toolkit);

  let submitted: RepoContext | null = null;
  const submit = tool({
    description:
      "Submit the final structured RepoContext once you have explored enough to fill in every field accurately.",
    inputSchema: RepoContextSchema,
    execute: async (input) => {
      submitted = input;
      return { received: true };
    },
  });

  const result = await generateText({
    model: codingModel(),
    system: REPO_ANALYZE_SYSTEM,
    prompt: buildRepoAnalyzePrompt(args.repoMeta),
    tools: { ...tools, [SUBMIT_TOOL]: submit },
    stopWhen: [stepCountIs(MAX_TOOL_STEPS), hasToolCall(SUBMIT_TOOL)],
  });

  const context = submitted ?? extractSubmission(result, SUBMIT_TOOL);
  if (!context) {
    throw new Error(
      "The analysis agent did not produce a repository context within the step budget.",
    );
  }

  const usage = result.totalUsage;
  return {
    context: RepoContextSchema.parse(context),
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.coding,
    filesRead: [...new Set(recordedReads)],
  };
}

/**
 * Fallback extraction of the answer-tool's input from the step transcript, in
 * case the `execute` side-effect didn't fire (e.g. the call was the final step).
 */
export function extractSubmission(
  result: { steps: { toolCalls: { toolName: string; input: unknown }[] }[] },
  toolName: string,
): unknown {
  for (let i = result.steps.length - 1; i >= 0; i--) {
    const call = result.steps[i]!.toolCalls.find(
      (c) => c.toolName === toolName,
    );
    if (call) return call.input;
  }
  return null;
}
