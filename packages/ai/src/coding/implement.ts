import { generateText, hasToolCall, stepCountIs, tool } from "ai";

import type { RequestContext } from "../prompts";
import { codingModel, MODELS } from "../model";
import { extractSubmission } from "./analyze";
import {
  buildImplementPrompt,
  IMPLEMENT_SYSTEM,
  type RepoMeta,
  type TaskContext,
} from "./prompts";
import { ImplementationSchema, type Implementation } from "./schemas";
import { buildRepoTools, MAX_TOOL_STEPS, type RepoToolkit } from "./toolkit";
import type { RepoContext } from "./schemas";

export interface ImplementResult {
  implementation: Implementation;
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
  /** Files the agent read while implementing (reproducibility record). */
  filesRead: string[];
  /** Ordered list of read/list tool calls (reproducibility record). */
  toolCalls: { tool: string; arg: string }[];
}

const SUBMIT_TOOL = "submit_implementation";

/**
 * Implements a single task against a real repository: the model explores with
 * read-only tools (grounded by the prior `RepoContext`), then submits a complete
 * patch set (whole-file contents) plus a self-assessed confidence/risk and a
 * self-check. The job layer turns the patch set into a branch + commit + PR.
 *
 * Throws if OPENAI_API_KEY is missing or the model never submits a valid
 * implementation within the step budget.
 */
export async function implementTask(args: {
  ctx: RequestContext;
  prdMarkdown: string;
  task: TaskContext;
  repoContext: RepoContext;
  repoMeta: RepoMeta;
  toolkit: RepoToolkit;
}): Promise<ImplementResult> {
  const { tools, recordedReads, toolCalls } = buildRepoTools(args.toolkit);

  let submitted: Implementation | null = null;
  const submit = tool({
    description:
      "Submit the final, complete implementation (whole-file contents) for the task once you have verified it against the repository.",
    inputSchema: ImplementationSchema,
    execute: async (input) => {
      submitted = input;
      return { received: true, files: input.files.length };
    },
  });

  const result = await generateText({
    model: codingModel(),
    system: IMPLEMENT_SYSTEM,
    prompt: buildImplementPrompt({
      ctx: args.ctx,
      prdMarkdown: args.prdMarkdown,
      task: args.task,
      repoContext: args.repoContext,
      repoMeta: args.repoMeta,
    }),
    tools: { ...tools, [SUBMIT_TOOL]: submit },
    stopWhen: [stepCountIs(MAX_TOOL_STEPS), hasToolCall(SUBMIT_TOOL)],
  });

  const raw = submitted ?? extractSubmission(result, SUBMIT_TOOL);
  if (!raw) {
    throw new Error(
      "The coding agent did not produce an implementation within the step budget.",
    );
  }

  const usage = result.totalUsage;
  return {
    implementation: ImplementationSchema.parse(raw),
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.coding,
    filesRead: [...new Set(recordedReads)],
    toolCalls,
  };
}
