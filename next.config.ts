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
        destination: isDev ? "http://127.0.0.1:8000/api/py/:path*" : "/api/",
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
  redirects: async () => {
    return [
      {
        source: "/settings",
        destination: "/?tab=settings",
        permanent: false,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "unavatar.io" },
      { protocol: "https", hostname: "img.logo.dev" },
      { protocol: "https", hostname: "*.gravatar.com" },
    ],
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
  org: process.env.SENTRY_ORG || "arthax",
  project: process.env.SENTRY_PROJECT || "arthax",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
});
