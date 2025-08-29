import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint during production builds for Railway deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds for Railway deployment
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
