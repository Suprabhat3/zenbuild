import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import {
  appRouter,
  createCallerFactory,
  createTRPCContext,
} from "@zenbuild/api";

import { getAuthSession } from "@/server/session";

/**
 * Server-side tRPC caller for use in React Server Components — calls procedures
 * directly (no HTTP round-trip). Cached per request via React `cache`.
 */
const createContext = cache(async () => {
  const heads = await headers();
  const session = await getAuthSession(heads);
  return createTRPCContext({ headers: heads, session });
});

export const api = createCallerFactory(appRouter)(createContext);
