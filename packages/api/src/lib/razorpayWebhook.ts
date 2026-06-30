import {
  reconcileSubscriptionFromWebhook,
  verifyRazorpaySignature,
  type RazorpaySubscriptionEntity,
} from "@zenbuild/billing";
import { db } from "@zenbuild/db";
import { serverEnv } from "@zenbuild/env";

/** Header Razorpay sends with the HMAC-SHA256 of the raw body. */
export const RAZORPAY_SIGNATURE_HEADER = "x-razorpay-signature";

export type RazorpayWebhookResult =
  | { ok: true; handled: boolean; detail?: string }
  | { ok: false; status: number; error: string };

interface RazorpayWebhookEnvelope {
  event?: string;
  payload?: {
    subscription?: { entity?: RazorpaySubscriptionEntity };
  };
}

/**
 * Verify + dispatch an inbound Razorpay webhook. We verify the HMAC over the
 * *raw* body, then reconcile our `Subscription` from `subscription.*` events.
 *
 * Idempotency: Razorpay may deliver an event more than once. Reconciliation is
 * idempotent *by construction* (it sets plan/status/credits rather than
 * incrementing), so a duplicate delivery converges to the same state. We also
 * record an `AuditLog` row per processed event for observability and to short-
 * circuit obvious replays.
 */
export async function handleRazorpayWebhook(
  rawBody: string,
  headers: Headers,
): Promise<RazorpayWebhookResult> {
  const secret = serverEnv.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: "Razorpay webhooks are not configured." };
  }

  const signature = headers.get(RAZORPAY_SIGNATURE_HEADER);
  if (!verifyRazorpaySignature(rawBody, signature, secret)) {
    return { ok: false, status: 401, error: "Invalid or missing signature." };
  }

  let envelope: RazorpayWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as RazorpayWebhookEnvelope;
  } catch {
    return { ok: false, status: 400, error: "Body is not valid JSON." };
  }

  const eventType = envelope.event;
  if (!eventType) {
    return { ok: false, status: 400, error: "Missing event type." };
  }

  // Only subscription lifecycle events drive plan state today.
  if (!eventType.startsWith("subscription.")) {
    return { ok: true, handled: false, detail: `Ignored event: ${eventType}` };
  }

  const subscription = envelope.payload?.subscription?.entity;
  if (!subscription?.id) {
    return { ok: true, handled: false, detail: "No subscription entity in payload." };
  }

  const result = await reconcileSubscriptionFromWebhook(db, {
    eventType,
    subscription,
  });

  if (result.handled && result.organizationId) {
    await db.auditLog.create({
      data: {
        organizationId: result.organizationId,
        action: "razorpay.webhook",
        entityType: "subscription",
        entityId: subscription.id,
        metadata: { event: eventType, detail: result.detail },
      },
    });
  }

  return { ok: true, handled: result.handled, detail: result.detail };
}
