import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix lockfile warning by setting output file tracing root
  outputFileTracingRoot: process.cwd(),

  webpack: (config) => {
    // Add externals for optional dependencies
    if (!config.externals) {
      config.externals = [];
    }

    if (!Array.isArray(config.externals)) {
      config.externals = [];
    }
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });

    // Exclude Shred.fyi directory from compilation
    if (!config.module) {
      config.module = { rules: [] };
    }
    if (!config.module.rules) {
      config.module.rules = [];
    }
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /Shred\.fyi/,
    });

    // Keep asyncWebAssembly for potential future WASM usage
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

export default nextConfig;
