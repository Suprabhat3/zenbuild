import { serverEnv } from "@zenbuild/env";
import { eventType, Inngest } from "inngest";
import { z } from "zod";

/**
 * Inngest client for ZenBuild's async workflows. In local dev, leave the keys
 * blank and run the Inngest dev server (`npx inngest-cli@latest dev`); events are
 * sent to it automatically. In production both keys must be set.
 *
 * Events are declared with `eventType` (Inngest v4) so triggers and `send()`
 * payloads share one zod-validated schema.
 */

const discoveryData = z.object({
  featureRequestId: z.string(),
  organizationId: z.string(),
  workflowRunId: z.string(),
  /** userId that initiated the run, for auditing. */
  triggeredBy: z.string().optional(),
});

export const CLARIFY_EVENT = "feature/clarify.requested";
export const PRD_EVENT = "feature/prd.requested";
export const TASKS_EVENT = "feature/tasks.requested";

export const clarifyRequested = eventType(CLARIFY_EVENT, {
  schema: discoveryData,
});
export const prdRequested = eventType(PRD_EVENT, { schema: discoveryData });
export const tasksRequested = eventType(TASKS_EVENT, { schema: discoveryData });

export type DiscoveryEventData = z.infer<typeof discoveryData>;

export const inngest = new Inngest({
  id: "zenbuild",
  eventKey: serverEnv.INNGEST_EVENT_KEY,
});
