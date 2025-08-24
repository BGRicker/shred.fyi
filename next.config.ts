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

    return config;
  },
};

export default nextConfig;
