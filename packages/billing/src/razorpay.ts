import Razorpay from "razorpay";

import { serverEnv } from "@zenbuild/env";

/**
 * Razorpay client wrapper. Like the GitHub App integration, everything degrades
 * gracefully when Razorpay isn't configured: `isRazorpayConfigured()` is false,
 * the billing UI shows an "unconfigured" state, and the mutations surface a
 * clear precondition error instead of throwing on boot.
 */

export function isRazorpayConfigured(): boolean {
  return Boolean(serverEnv.RAZORPAY_KEY_ID && serverEnv.RAZORPAY_KEY_SECRET);
}

export function assertRazorpayConfigured(): void {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured on this deployment.");
  }
}

let client: Razorpay | null = null;

/** Lazily-constructed singleton Razorpay client (test or live per env keys). */
export function getRazorpay(): Razorpay {
  assertRazorpayConfigured();
  client ??= new Razorpay({
    key_id: serverEnv.RAZORPAY_KEY_ID!,
    key_secret: serverEnv.RAZORPAY_KEY_SECRET!,
  });
  return client;
}

/** The publishable key id, safe to hand to the browser Checkout. */
export function razorpayKeyId(): string | null {
  return serverEnv.RAZORPAY_KEY_ID ?? null;
}

/** Number of monthly billing cycles to authorize per subscription. */
const SUBSCRIPTION_TOTAL_COUNT = 12;

/**
 * Create a Razorpay subscription against a plan id. The returned `id` is handed
 * to Checkout (`subscription_id`); authoritative state arrives via webhooks.
 */
export async function createRazorpaySubscription(args: {
  planId: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string; shortUrl: string | null }> {
  const sub = await getRazorpay().subscriptions.create({
    plan_id: args.planId,
    total_count: SUBSCRIPTION_TOTAL_COUNT,
    customer_notify: 1,
    ...(args.notes ? { notes: args.notes } : {}),
  });
  return {
    id: sub.id,
    status: sub.status,
    shortUrl: (sub as { short_url?: string }).short_url ?? null,
  };
}

/** Cancel a subscription, by default at the end of the current billing cycle. */
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true,
): Promise<{ id: string; status: string }> {
  const sub = await getRazorpay().subscriptions.cancel(
    subscriptionId,
    cancelAtCycleEnd,
  );
  return { id: sub.id, status: sub.status };
}

export async function fetchRazorpaySubscription(subscriptionId: string) {
  return getRazorpay().subscriptions.fetch(subscriptionId);
}
