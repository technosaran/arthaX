import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/config/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/privacy", "/terms"],
        disallow: ["/api/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
