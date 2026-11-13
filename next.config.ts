import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{source: "/sw.js", headers: [{key: "Cache-Control", value: "no-cache"}]}];
  },
};

export default nextConfig;
