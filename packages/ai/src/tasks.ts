import { generateObject } from "ai";

import { discoveryModel, MODELS } from "./model";
import { buildTasksPrompt, TASKS_SYSTEM, type RequestContext } from "./prompts";
import { TasksSchema, type GeneratedTask } from "./schemas";

export interface TasksGenResult {
  tasks: GeneratedTask[];
  usage: { promptTokens?: number; completionTokens?: number };
  model: string;
}

/**
 * Generates an ordered set of engineering tasks from an approved PRD and the
 * original request context. Dependencies come back as 1-based indices into the
 * returned array (see `GeneratedTask.dependsOn`); the caller maps them to task
 * IDs when persisting. Throws if OPENAI_API_KEY is missing or output fails
 * schema validation.
 */
export async function generateTasks(args: {
  ctx: RequestContext;
  prdMarkdown: string;
}): Promise<TasksGenResult> {
  const { object, usage } = await generateObject({
    model: discoveryModel(),
    schema: TasksSchema,
    system: TASKS_SYSTEM,
    prompt: buildTasksPrompt(args),
  });

  return {
    tasks: object.tasks,
    usage: {
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
    },
    model: MODELS.discovery,
  };
}
