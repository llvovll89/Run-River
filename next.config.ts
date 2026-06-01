import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  customWorkerSrc: "worker-disabled",
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable:
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_DISABLE_PWA === "1",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: false,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
};

export default withPWA(nextConfig);
