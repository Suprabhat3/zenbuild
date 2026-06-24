import { clarifyFeature } from "./functions/clarify";
import { generatePrdFn } from "./functions/prdGenerate";

export {
  inngest,
  clarifyRequested,
  prdRequested,
  CLARIFY_EVENT,
  PRD_EVENT,
  type DiscoveryEventData,
} from "./client";

/** All Inngest functions, registered by the web app's `/api/inngest` route. */
export const functions = [clarifyFeature, generatePrdFn];
