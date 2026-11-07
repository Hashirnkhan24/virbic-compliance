import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  transpilePackages: [
    "@vibe/contracts",
    "@vibe/capture",
    "@vibe/detectors",
    "@vibe/rules",
    "@vibe/exposure",
    "@vibe/fixes",
    "@vibe/reports",
  ],
};

export default nextConfig;
