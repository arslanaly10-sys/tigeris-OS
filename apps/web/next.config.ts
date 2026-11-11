import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@tigeris/shared"],
  poweredByHeader: false,
  // Browser calls go through /api on the same origin (app/api/[...path]/route.ts), so the session cookie never crosses origins.
};

export default nextConfig;
