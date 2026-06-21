import type { AuthSession } from "@zenbuild/api";

/**
 * Resolves the current request's auth session.
 *
 * Phase 1 placeholder: always returns null (unauthenticated). Phase 2 replaces
 * this body with a BetterAuth lookup (read the session cookie, load the user and
 * their active organization) — the rest of the app already consumes the typed
 * `AuthSession`, so nothing downstream changes when this is filled in.
 */
export async function getAuthSession(_headers: Headers): Promise<AuthSession | null> {
  return null;
}
