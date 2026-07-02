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
  // Legacy URL shapes from the pre-redesign IA (docs/frontend-redesign-plan.md
  // §4.1). Permanent: these paths are gone for good.
  async redirects() {
    return [
      {
        source: "/feature-requests",
        destination: "/requests",
        permanent: true,
      },
      {
        source: "/feature-requests/:path*",
        destination: "/requests/:path*",
        permanent: true,
      },
      // Approvals inbox folded into Home's "Needs your decision" queue.
      {
        source: "/approvals",
        destination: "/dashboard",
        permanent: true,
      },
      // Workspace sub-pages replaced by stage routes.
      {
        source: "/requests/:id/board",
        destination: "/requests/:id/plan",
        permanent: true,
      },
      {
        source: "/requests/:id/release",
        destination: "/requests/:id/ship",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
