import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.title,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: siteConfig.themeColor,
    theme_color: siteConfig.themeColor,
    categories: ["finance", "productivity", "business"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
