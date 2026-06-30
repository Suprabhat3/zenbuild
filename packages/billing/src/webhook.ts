import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Razorpay webhook signature. Razorpay signs the raw request body with
 * HMAC-SHA256 keyed by the webhook secret and sends the hex digest in the
 * `X-Razorpay-Signature` header. We compare in constant time over the exact
 * bytes received (the caller must pass the *raw* body, never a re-serialized
 * object).
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify the signature returned to the browser by Razorpay Checkout after a
 * subscription payment. The signature is HMAC-SHA256 of
 * `${razorpay_payment_id}|${subscription_id}` keyed by the key secret.
 * (Note the ordering differs from the one-time-order flow.)
 */
export function verifySubscriptionPaymentSignature(args: {
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const payload = `${args.razorpayPaymentId}|${args.razorpaySubscriptionId}`;
  const expected = createHmac("sha256", args.keySecret)
    .update(payload)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(args.signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
