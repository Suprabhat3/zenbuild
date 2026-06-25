import { NextResponse } from "next/server";

import { completeGithubInstallation } from "@zenbuild/api";

/**
 * GitHub App "Setup URL" callback. After a user installs (or updates) the App,
 * GitHub redirects here with `installation_id` and the signed `state` we issued.
 * We finalize the installation and bounce back to the Integrations page with a
 * status flag the UI turns into a toast.
 */
function redirectTo(req: Request, params: Record<string, string>) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const url = new URL("/settings/integrations", base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const installationIdRaw = searchParams.get("installation_id");
  const state = searchParams.get("state");
  const setupAction = searchParams.get("setup_action");

  // "request" => the user asked an org owner to approve; nothing to finalize yet.
  if (setupAction === "request") {
    return redirectTo(req, { github: "requested" });
  }

  const installationId = installationIdRaw ? Number(installationIdRaw) : NaN;
  if (!Number.isFinite(installationId) || !state) {
    return redirectTo(req, { github: "error", reason: "missing_params" });
  }

  const result = await completeGithubInstallation({
    installationId,
    state,
    now: Date.now(),
  });

  if (!result.ok) {
    return redirectTo(req, { github: "error", reason: result.error });
  }
  return redirectTo(req, { github: "connected" });
}
