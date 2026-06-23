import { handleIntakeWebhook } from "@zenbuild/api";

/**
 * Inbound feature-request intake. Simulates email/ticket/call → request: an
 * external system POSTs a normalized JSON body signed with the workspace's intake
 * secret. Authentication + signature verification + creation all live in
 * `handleIntakeWebhook`; we read the *raw* body here because the HMAC is computed
 * over the exact bytes the caller signed.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await handleIntakeWebhook(rawBody, req.headers);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(
    { ok: true, featureRequestId: result.featureRequestId },
    { status: 201 },
  );
}
