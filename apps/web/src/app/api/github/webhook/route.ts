import { handleGithubWebhook } from "@zenbuild/api";

/**
 * Inbound GitHub App webhooks. Signature verification + dispatch live in
 * `handleGithubWebhook`; we read the *raw* body here because the HMAC is computed
 * over the exact bytes GitHub signed. Heavy work is deferred to Inngest so we
 * acknowledge quickly.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await handleGithubWebhook(rawBody, req.headers);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true, handled: result.handled, detail: result.detail });
}
