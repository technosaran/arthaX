import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ArthaX Sovereign Financial Suite",
    short_name: "ArthaX",
    description: "Institutional financial intelligence, net worth telemetry, and real-time cash flow engine.",
    start_url: "/",
    display: "standalone",
    display_override: ["standalone", "window-controls-overlay", "minimal-ui"],
    background_color: "#07080c",
    theme_color: "#07080c",
    orientation: "portrait-primary",
    scope: "/",
    lang: "en-IN",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open real-time net worth and overview",
        url: "/?tab=dashboard",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Accounts Vault",
        short_name: "Accounts",
        description: "View connected bank and credit card accounts",
        url: "/?tab=accounts",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Expenses",
        short_name: "Expenses",
        description: "Track monthly spends and burns",
        url: "/?tab=expenses",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Stock Portfolio",
        short_name: "Stocks",
        description: "View live equity demat holdings",
        url: "/?tab=stocks",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
