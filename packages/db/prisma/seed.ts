import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

// Load the monorepo-root .env BEFORE importing the client (which reads
// DATABASE_URL at construction). Static imports are hoisted, so the client is
// imported dynamically inside main() after env is in place.
loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

/**
 * Local dev seed: a demo user, workspace, project, and a Free subscription.
 * Idempotent — safe to run repeatedly.
 */
async function main() {
  const { db } = await import("../src/client");

  const user = await db.user.upsert({
    where: { email: "demo@zenbuild.dev" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@zenbuild.dev",
      emailVerified: true,
    },
  });

  const org = await db.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo",
    },
  });

  await db.member.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { role: "owner" },
    create: { organizationId: org.id, userId: user.id, role: "owner" },
  });

  await db.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      plan: "FREE",
      status: "ACTIVE",
      reviewCreditsTotal: 25,
      reviewCreditsUsed: 0,
    },
  });

  await db.project.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "DEMO" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Demo Project",
      key: "DEMO",
      description: "Sample project for local development.",
    },
  });

  await db.$disconnect();
  console.log(`Seeded demo workspace (org=${org.id}, user=${user.id}).`);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
