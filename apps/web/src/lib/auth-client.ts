"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side BetterAuth client. Mirrors the server plugin set (organization)
 * so the typed client exposes `authClient.organization.*`. `baseURL` is omitted
 * intentionally — in the browser BetterAuth uses the current origin, where the
 * `/api/auth/*` handler is mounted.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
  useListOrganizations,
  useActiveOrganization,
} = authClient;
