import { randomBytes } from "node:crypto";

import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

/** Public token: short, URL-safe, prefixed so it's recognizable in logs/configs. */
function generateToken(): string {
  return `zbk_${randomBytes(18).toString("base64url")}`;
}

/** Signing secret: 32 random bytes, hex-encoded. Surfaced only on rotate. */
function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Per-org credentials for the inbound intake webhook (`POST /api/intake`). The
 * `token` is the public identifier; the `secret` signs request bodies. Reads
 * expose only the token + metadata (never the secret); rotation (owners/admins)
 * returns the new secret exactly once.
 */
export const intakeKeyRouter = createTRPCRouter({
  /** The active key's public metadata, or null if none has been created yet. */
  get: orgProcedure.query(async ({ ctx }) => {
    const key = await ctx.db.intakeKey.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { token: true, createdAt: true, rotatedAt: true },
    });
    return key;
  }),

  /**
   * Create or rotate the workspace's intake key. Returns the new token AND secret
   * — the only time the secret is ever returned in full. Idempotent shape: always
   * upserts the single per-org row.
   */
  rotate: requireRole("owner", "admin").mutation(async ({ ctx }) => {
    const token = generateToken();
    const secret = generateSecret();

    const key = await ctx.db.$transaction(async (tx) => {
      const upserted = await tx.intakeKey.upsert({
        where: { organizationId: ctx.organizationId },
        update: { token, secret, rotatedAt: new Date() },
        create: { organizationId: ctx.organizationId, token, secret },
      });
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorId: ctx.user.id,
          action: "intake_key.rotate",
          entityType: "intake_key",
          entityId: upserted.id,
        },
      });
      return upserted;
    });

    return { token: key.token, secret };
  }),
});
