import type { AuthSession } from "@zenbuild/api";
import { auth } from "@zenbuild/auth";

/**
 * Resolves the current request's auth session from BetterAuth and maps it to the
 * transport-agnostic `AuthSession` the API package consumes. Returns `null` when
 * there is no valid session.
 */
export async function getAuthSession(headers: Headers): Promise<AuthSession | null> {
  const result = await auth.api.getSession({ headers });
  if (!result?.user) return null;

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      image: result.user.image ?? null,
    },
    activeOrganizationId: result.session.activeOrganizationId ?? null,
  };
}
