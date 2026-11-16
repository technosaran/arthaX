import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
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

export default nextConfig;
