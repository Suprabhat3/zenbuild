import { functions, inngest } from "@zenbuild/jobs";
import { serve } from "inngest/next";

/**
 * Inngest endpoint. The Inngest dev server (local) or Inngest Cloud (prod)
 * discovers and invokes ZenBuild's async functions through this route. Functions
 * are defined in `@zenbuild/jobs`; this only mounts the HTTP handler.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
