import { clarifyFeature } from "./functions/clarify";
import { generatePrdFn } from "./functions/prdGenerate";
import { generateTasksFn } from "./functions/tasksGenerate";

export {
  inngest,
  clarifyRequested,
  prdRequested,
  tasksRequested,
  CLARIFY_EVENT,
  PRD_EVENT,
  TASKS_EVENT,
  type DiscoveryEventData,
} from "./client";

/** All Inngest functions, registered by the web app's `/api/inngest` route. */
export const functions = [clarifyFeature, generatePrdFn, generateTasksFn];
