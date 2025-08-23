import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude Essentia.js from server-side rendering
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('essentia.js');
    }

    // Handle WASM files for Essentia.js
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Handle WASM file loading
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Fix for Essentia.js browser compatibility
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  // Turbopack configuration
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
};

export default nextConfig;
