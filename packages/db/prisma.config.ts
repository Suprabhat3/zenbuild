import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env. Load the monorepo-root .env (two levels up
// from packages/db) so DATABASE_URL resolves for migration/introspection.
loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

/**
 * Prisma 7 configuration. The datasource URL lives here (no longer in
 * schema.prisma) and is used by migration/introspection commands. The runtime
 * client connects via the pg driver adapter in src/client.ts using the same
 * single DATABASE_URL.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
