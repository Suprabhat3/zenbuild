"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

/**
 * Keeps the BetterAuth session's active organization in sync with the workspace
 * the shell actually rendered. This only fires in the rare case the session's
 * `activeOrganizationId` is stale (e.g. the user was removed from the org that
 * was active) — normally `desiredId` already equals `sessionActiveId` and this
 * is a no-op.
 */
export function EnsureActiveOrg({
  desiredId,
  sessionActiveId,
}: {
  desiredId: string;
  sessionActiveId: string | null;
}) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (desiredId === sessionActiveId) return;
    done.current = true;
    authClient.organization
      .setActive({ organizationId: desiredId })
      .then(() => router.refresh());
  }, [desiredId, sessionActiveId, router]);

  return null;
}
