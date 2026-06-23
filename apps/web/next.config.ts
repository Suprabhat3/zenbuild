import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Env lives at the monorepo root (single source of truth). Next only auto-loads
// .env from the app directory, so load the root file here — next.config is
// evaluated before any server module, so process.env is populated in time for
// @zenbuild/env validation.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@zenbuild/api",
    "@zenbuild/auth",
    "@zenbuild/db",
    "@zenbuild/email",
    "@zenbuild/env",
  ],
};

export default nextConfig;
