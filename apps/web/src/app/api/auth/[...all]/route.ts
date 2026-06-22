import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@zenbuild/auth";

/**
 * BetterAuth's catch-all route. Handles sign-in/up, OAuth callbacks, session,
 * and all organization-plugin endpoints under `/api/auth/*`.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
