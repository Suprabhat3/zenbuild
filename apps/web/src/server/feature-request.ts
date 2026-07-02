import { cache } from "react";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "@/trpc/server";

/**
 * Per-render-deduped feature-request fetch. The workspace layout and every
 * stage page under /requests/[id] need the same record; `React.cache` makes
 * them share a single query instead of re-fetching per segment.
 */
export const getFeatureRequest = cache((id: string) =>
  api.featureRequest.byId({ id }),
);

/** Like {@link getFeatureRequest}, but resolves NOT_FOUND to the 404 page. */
export async function requireFeatureRequest(id: string) {
  try {
    return await getFeatureRequest(id);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
