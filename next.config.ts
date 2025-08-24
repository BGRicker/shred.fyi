import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle WASM files for potential future use
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
  // Fix for Next.js lockfile warning
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
