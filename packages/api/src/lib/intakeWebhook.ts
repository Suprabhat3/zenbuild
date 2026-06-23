import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@zenbuild/db";

import { createFeatureRequest, type IntakePayload } from "./intake";

/** Header names the inbound caller must set. */
export const INTAKE_TOKEN_HEADER = "x-intake-key";
export const INTAKE_SIGNATURE_HEADER = "x-intake-signature";

/** The normalized JSON body accepted at `POST /api/intake`. */
export interface IntakeWebhookBody {
  title?: unknown;
  subject?: unknown; // alias for title (email-style payloads)
  description?: unknown;
  body?: unknown; // alias for description
  source?: unknown;
  priority?: unknown;
  requesterName?: unknown;
  contactName?: unknown;
  requesterEmail?: unknown;
  contactEmail?: unknown;
}

export type IntakeResult =
  | { ok: true; featureRequestId: string }
  | { ok: false; status: number; error: string };

const VALID_SOURCES = new Set(["FORM", "EMAIL", "TICKET", "CALL", "API"]);
const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** Constant-time compare of two hex signatures of equal expected length. */
function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify an inbound intake request and create a `FeatureRequest` from its body.
 *
 * Security model: the caller sends the org's public `token` (X-Intake-Key) and an
 * HMAC-SHA256 of the *raw* request body keyed by that org's secret
 * (X-Intake-Signature, hex). We look the key up by token, recompute the HMAC, and
 * timing-safe compare. No valid signature → no write. The raw body string MUST be
 * the exact bytes that were signed, so the route handler reads `await req.text()`
 * and passes it here (not a re-serialized object).
 */
export async function handleIntakeWebhook(
  rawBody: string,
  headers: Headers,
): Promise<IntakeResult> {
  const token = headers.get(INTAKE_TOKEN_HEADER);
  const signature = headers.get(INTAKE_SIGNATURE_HEADER);

  if (!token || !signature) {
    return { ok: false, status: 401, error: "Missing intake credentials." };
  }

  const key = await db.intakeKey.findUnique({
    where: { token },
    select: { secret: true, organizationId: true },
  });
  if (!key) {
    return { ok: false, status: 401, error: "Unknown intake key." };
  }

  const expected = createHmac("sha256", key.secret).update(rawBody).digest("hex");
  if (!signaturesMatch(expected, signature.trim())) {
    return { ok: false, status: 401, error: "Invalid signature." };
  }

  let parsed: IntakeWebhookBody;
  try {
    parsed = JSON.parse(rawBody) as IntakeWebhookBody;
  } catch {
    return { ok: false, status: 400, error: "Body is not valid JSON." };
  }

  const title = str(parsed.title) ?? str(parsed.subject);
  const description = str(parsed.description) ?? str(parsed.body);
  if (!title || !description) {
    return {
      ok: false,
      status: 422,
      error: "Both a title/subject and a description/body are required.",
    };
  }

  const rawSource = str(parsed.source)?.toUpperCase();
  const source = (rawSource && VALID_SOURCES.has(rawSource)
    ? rawSource
    : "API") as NonNullable<IntakePayload["source"]>;

  const rawPriority = str(parsed.priority)?.toUpperCase();
  const priority = (rawPriority && VALID_PRIORITIES.has(rawPriority)
    ? rawPriority
    : "MEDIUM") as NonNullable<IntakePayload["priority"]>;

  const featureRequest = await createFeatureRequest(db, {
    organizationId: key.organizationId,
    actorId: null,
    payload: {
      title,
      description,
      source,
      priority,
      requesterName: str(parsed.requesterName) ?? str(parsed.contactName) ?? null,
      requesterEmail:
        str(parsed.requesterEmail) ?? str(parsed.contactEmail) ?? null,
      rawPayload: parsed,
    },
  });

  return { ok: true, featureRequestId: featureRequest.id };
}
