import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix lockfile warning by setting output file tracing root
  outputFileTracingRoot: process.cwd(),

  webpack: (config) => {
    // Keep asyncWebAssembly for potential future WASM usage
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Fix for Essentia.js trying to use 'fs' in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
};

export default nextConfig;
