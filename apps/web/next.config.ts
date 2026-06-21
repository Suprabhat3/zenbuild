import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@zenbuild/api", "@zenbuild/db", "@zenbuild/env"],
};

export default nextConfig;
