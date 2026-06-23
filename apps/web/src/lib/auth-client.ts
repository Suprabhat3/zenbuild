"use client";

import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side BetterAuth client. Mirrors the server plugin set (emailOTP +
 * organization) so the typed client exposes `authClient.emailOTP.*` and
 * `authClient.organization.*`. `baseURL` is omitted intentionally — in the
 * browser BetterAuth uses the current origin, where the `/api/auth/*` handler is
 * mounted.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), organizationClient()],
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
