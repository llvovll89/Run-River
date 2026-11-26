import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// 사용자가 업데이트 여부를 확인할 수 있도록 빌드 날짜(KST)와 커밋을 화면에 노출한다.
function appVersion(): string {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!sha) {
    try { sha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { sha = "local"; }
  }
  const date = new Date(Date.now() + 9 * 3600_000).toISOString().slice(2, 16).replace(/-/g, ".").replace("T", " ");
  return `${date} · ${sha.slice(0, 7)}`;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
  async headers() {
    return [{source: "/sw.js", headers: [{key: "Cache-Control", value: "no-cache"}]}];
  },
};

export default nextConfig;
