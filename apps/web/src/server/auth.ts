import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { AuthSession } from "@zenbuild/api";

import { getAuthSession } from "@/server/session";

/**
 * Server-side session access for RSC / server components / route handlers.
 * Cached per request so multiple calls in one render don't re-hit BetterAuth.
 */
export const getServerSession = cache(async (): Promise<AuthSession | null> => {
  const heads = await headers();
  return getAuthSession(heads);
});

/**
 * Guard for authenticated pages: returns the session or redirects to sign-in,
 * preserving the originally-requested path so we can bounce back after login.
 */
export async function requireSession(returnTo?: string): Promise<AuthSession> {
  const session = await getServerSession();
  if (!session) {
    const target = returnTo
      ? `/sign-in?redirectTo=${encodeURIComponent(returnTo)}`
      : "/sign-in";
    redirect(target);
  }
  return session;
}
