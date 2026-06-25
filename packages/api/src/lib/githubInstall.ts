import { db } from "@zenbuild/db";
import { getAppOctokit, verifyInstallState } from "@zenbuild/github";

export type InstallResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

/**
 * Finalize a GitHub App installation after GitHub redirects back to our setup
 * URL with `installation_id` + the signed `state` we issued.
 *
 * Trust chain:
 *  1. `state` is HMAC-verified → recovers the org+user that started the flow
 *     (a forged/expired state is rejected).
 *  2. The user is re-checked as an owner/admin of that org.
 *  3. The `installation_id` is independently verified against the GitHub API
 *     (using the App JWT) before anything is persisted — so a guessed id fails.
 */
export async function completeGithubInstallation(args: {
  installationId: number;
  state: string;
  now: number;
}): Promise<InstallResult> {
  const decoded = verifyInstallState(args.state, args.now);
  if (!decoded) {
    return { ok: false, error: "Invalid or expired install state." };
  }

  const membership = await db.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: decoded.organizationId,
        userId: decoded.userId,
      },
    },
    select: { role: true },
  });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { ok: false, error: "Not authorized to install for this workspace." };
  }

  // Verify the installation actually exists and read its account metadata.
  let accountLogin = "unknown";
  let accountType = "Organization";
  try {
    const { data } = await getAppOctokit().rest.apps.getInstallation({
      installation_id: args.installationId,
    });
    const account = data.account as
      | { login?: string; slug?: string; type?: string }
      | null;
    accountLogin = account?.login ?? account?.slug ?? accountLogin;
    accountType = account?.type ?? accountType;
  } catch {
    return { ok: false, error: "Could not verify the GitHub installation." };
  }

  await db.$transaction(async (tx) => {
    await tx.githubInstallation.upsert({
      where: { installationId: BigInt(args.installationId) },
      create: {
        installationId: BigInt(args.installationId),
        accountLogin,
        accountType,
        organizationId: decoded.organizationId,
      },
      update: { accountLogin, accountType, organizationId: decoded.organizationId },
    });
    await tx.auditLog.create({
      data: {
        organizationId: decoded.organizationId,
        actorId: decoded.userId,
        action: "github.install",
        entityType: "github_installation",
        entityId: String(args.installationId),
        metadata: { accountLogin, accountType },
      },
    });
  });

  return { ok: true, organizationId: decoded.organizationId };
}
