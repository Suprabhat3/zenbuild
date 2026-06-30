import type { PlanTier, PrismaClient, SubscriptionStatus } from "@zenbuild/db";

import { grantPlanCredits } from "./credits";
import { PLAN_DEFINITIONS } from "./plans";

/**
 * Subscription state reconciliation. Razorpay is the source of truth for
 * payment state; webhooks drive our `Subscription` row. Every operation here is
 * **idempotent by construction** (it sets values rather than incrementing, and
 * credit grants reset the monthly pool to a fixed allotment), so a webhook
 * delivered more than once — which Razorpay explicitly may do — converges to
 * the same result without double-granting credits.
 */

/** Map a Razorpay subscription status to our internal enum. */
export function mapRazorpayStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "authenticated":
    case "created":
      return "TRIALING";
    case "pending":
    case "halted":
      return "PAST_DUE";
    case "paused":
      return "PAUSED";
    case "cancelled":
    case "completed":
    case "expired":
      return "CANCELLED";
    default:
      return "ACTIVE";
  }
}

/** Resolve our plan tier from a Razorpay plan id (null if it matches none). */
export function planFromRazorpayPlanId(planId: string | undefined): PlanTier | null {
  if (!planId) return null;
  for (const def of Object.values(PLAN_DEFINITIONS)) {
    if (def.razorpayPlanId && def.razorpayPlanId === planId) return def.tier;
  }
  return null;
}

/**
 * Activate (or renew) a paid subscription: set plan + status, persist Razorpay
 * ids and period end, and reset the monthly credit pool to the plan's
 * allotment. Used by both the webhook handler and the optimistic post-checkout
 * verification — calling it twice is safe.
 */
export async function activateSubscription(
  db: PrismaClient,
  args: {
    organizationId: string;
    plan: PlanTier;
    status?: SubscriptionStatus;
    razorpaySubId?: string | null;
    razorpayCustomerId?: string | null;
    currentPeriodEnd?: Date | null;
    source: string;
  },
): Promise<void> {
  await db.subscription.update({
    where: { organizationId: args.organizationId },
    data: {
      plan: args.plan,
      status: args.status ?? "ACTIVE",
      ...(args.razorpaySubId !== undefined
        ? { razorpaySubId: args.razorpaySubId }
        : {}),
      ...(args.razorpayCustomerId !== undefined
        ? { razorpayCustomerId: args.razorpayCustomerId }
        : {}),
      ...(args.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: args.currentPeriodEnd }
        : {}),
    },
  });
  // Reset the monthly pool (idempotent — sets a fixed total, zeroes usage).
  await grantPlanCredits(db, args.organizationId, args.plan, args.source);
}

/** Minimal shape of the Razorpay subscription entity inside a webhook payload. */
export interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  plan_id?: string;
  customer_id?: string;
  current_end?: number | null;
  notes?: Record<string, string> | null;
}

export interface ReconcileResult {
  handled: boolean;
  detail: string;
  organizationId?: string;
}

/**
 * Reconcile our `Subscription` from a Razorpay `subscription.*` webhook event.
 * Resolves the org by the stored Razorpay subscription id, falling back to the
 * `organizationId` note we set at creation time. Returns a description for
 * logging/audit.
 */
export async function reconcileSubscriptionFromWebhook(
  db: PrismaClient,
  args: {
    eventType: string;
    subscription: RazorpaySubscriptionEntity;
  },
): Promise<ReconcileResult> {
  const { eventType, subscription } = args;

  // Resolve the org: prefer the note we stamped at creation, then the stored id.
  const noteOrgId = subscription.notes?.organizationId ?? null;
  const existing = await db.subscription.findFirst({
    where: {
      OR: [
        ...(noteOrgId ? [{ organizationId: noteOrgId }] : []),
        { razorpaySubId: subscription.id },
      ],
    },
    select: { organizationId: true },
  });
  if (!existing) {
    return { handled: false, detail: "no matching subscription" };
  }
  const organizationId = existing.organizationId;

  const tier =
    planFromRazorpayPlanId(subscription.plan_id) ??
    (subscription.notes?.tier as PlanTier | undefined) ??
    null;
  const status = mapRazorpayStatus(subscription.status);
  const periodEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000)
    : null;

  switch (eventType) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed": {
      // Grant/renew the plan's monthly credits and persist live state.
      if (tier) {
        await activateSubscription(db, {
          organizationId,
          plan: tier,
          status: "ACTIVE",
          razorpaySubId: subscription.id,
          razorpayCustomerId: subscription.customer_id ?? null,
          currentPeriodEnd: periodEnd,
          source: `webhook:${eventType}`,
        });
      } else {
        await db.subscription.update({
          where: { organizationId },
          data: {
            status: "ACTIVE",
            razorpaySubId: subscription.id,
            currentPeriodEnd: periodEnd,
          },
        });
      }
      return { handled: true, detail: `${eventType} → ACTIVE`, organizationId };
    }

    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.expired": {
      // Drop back to the Free plan's allotment so the org keeps working.
      await activateSubscription(db, {
        organizationId,
        plan: "FREE",
        status: "CANCELLED",
        currentPeriodEnd: periodEnd,
        source: `webhook:${eventType}`,
      });
      return {
        handled: true,
        detail: `${eventType} → CANCELLED (downgraded to FREE)`,
        organizationId,
      };
    }

    case "subscription.pending":
    case "subscription.halted": {
      await db.subscription.update({
        where: { organizationId },
        data: { status: "PAST_DUE", currentPeriodEnd: periodEnd },
      });
      return { handled: true, detail: `${eventType} → PAST_DUE`, organizationId };
    }

    case "subscription.paused": {
      await db.subscription.update({
        where: { organizationId },
        data: { status: "PAUSED" },
      });
      return { handled: true, detail: `${eventType} → PAUSED`, organizationId };
    }

    default:
      return { handled: false, detail: `ignored event ${eventType}`, organizationId };
  }
}
