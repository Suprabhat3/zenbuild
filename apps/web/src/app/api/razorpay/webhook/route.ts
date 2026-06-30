import { handleRazorpayWebhook } from "@zenbuild/api";

/**
 * Inbound Razorpay webhooks (subscription lifecycle). Signature verification +
 * reconciliation live in `handleRazorpayWebhook`; we read the *raw* body here
 * because the HMAC is computed over the exact bytes Razorpay signed.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await handleRazorpayWebhook(rawBody, req.headers);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true, handled: result.handled, detail: result.detail });
}
