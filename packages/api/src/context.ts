import { db } from "@zenbuild/db";

/**
 * The authenticated principal for a request. Resolved by the web app (which owns
 * the BetterAuth integration, wired in Phase 2) and injected here so the API
 * package stays auth-implementation agnostic.
 */
export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
  /** Currently-active workspace for this session (BetterAuth org plugin). */
  activeOrganizationId: string | null;
}

export interface CreateContextOptions {
  headers: Headers;
  session: AuthSession | null;
}

/**
 * Builds the per-request tRPC context. Pure and synchronous so it can be reused
 * in tests by passing a fabricated session.
 */
export function createTRPCContext(opts: CreateContextOptions) {
  return {
    db,
    session: opts.session,
    headers: opts.headers,
  };
}

export type Context = ReturnType<typeof createTRPCContext>;
