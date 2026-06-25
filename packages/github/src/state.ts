import { createHmac, timingSafeEqual } from "node:crypto";

import { assertGithubConfigured } from "./app";

/**
 * GitHub's App install flow redirects back to our callback with the
 * `installation_id` it created plus whatever opaque `state` we sent it. We use
 * `state` to bind the new installation to the org+user that initiated the flow.
 *
 * Because the callback is a public URL, `state` MUST be tamper-proof: we sign a
 * compact `orgId.userId.expiry` payload with HMAC-SHA256 keyed by the App's
 * webhook secret. A forged state fails verification; a stale one expires. (The
 * installation_id itself is independently re-verified against the GitHub API
 * before anything is persisted.)
 */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — the install handshake is brief.

interface StatePayload {
  organizationId: string;
  userId: string;
  /** epoch ms */
  expiresAt: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Build an opaque, signed state token for the install redirect. */
export function signInstallState(
  args: { organizationId: string; userId: string },
  now: number,
): string {
  const { webhookSecret } = assertGithubConfigured();
  const body = JSON.stringify({
    organizationId: args.organizationId,
    userId: args.userId,
    expiresAt: now + STATE_TTL_MS,
  } satisfies StatePayload);
  const data = Buffer.from(body, "utf8").toString("base64url");
  return `${data}.${sign(data, webhookSecret)}`;
}

/** Verify + decode a state token. Returns null if forged, malformed, or expired. */
export function verifyInstallState(
  token: string,
  now: number,
): { organizationId: string; userId: string } | null {
  const { webhookSecret } = assertGithubConfigured();
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const data = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(data, webhookSecret);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as StatePayload;
  } catch {
    return null;
  }

  if (
    typeof payload.organizationId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt < now
  ) {
    return null;
  }

  return { organizationId: payload.organizationId, userId: payload.userId };
}
