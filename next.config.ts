import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  rewrites: async () => {
    const isDev = process.env.NODE_ENV === "development";
    const rules = [
      {
        source: "/api/py/:path*",
        destination: isDev ? "http://127.0.0.1:8000/api/py/:path*" : "/api/:path*",
      },
    ];

    // Expose interactive API documentation only in local development
    if (isDev) {
      rules.push(
        {
          source: "/docs",
          destination: "http://127.0.0.1:8000/api/py/docs",
        },
        {
          source: "/openapi.json",
          destination: "http://127.0.0.1:8000/api/py/openapi.json",
        }
      );
    }

    return rules;
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "techno-saran-jz",
  project: "arthax",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
});
