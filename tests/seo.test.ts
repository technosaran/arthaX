import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBaseUrl, siteConfig, generateStructuredData } from "@/config/seo";

describe("SEO Configuration & Structured Data", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  describe("getBaseUrl", () => {
    it("returns default fallback URL when NEXT_PUBLIC_APP_URL is not configured", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(getBaseUrl()).toBe("https://arthax.vercel.app");
    });

    it("strips trailing slashes from the configured URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://custom-domain.com/";
      expect(getBaseUrl()).toBe("https://custom-domain.com");
    });
  });

  describe("siteConfig", () => {
    it("contains required metadata fields", () => {
      expect(siteConfig.name).toBe("arthaX");
      expect(siteConfig.title).toContain("arthaX");
      expect(siteConfig.titleTemplate).toBe("%s | arthaX");
      expect(siteConfig.description.length).toBeGreaterThan(20);
      expect(Array.isArray(siteConfig.keywords)).toBe(true);
      expect(siteConfig.keywords.length).toBeGreaterThanOrEqual(8);
      expect(siteConfig.keywords).toContain("personal finance");
      expect(siteConfig.keywords).toContain("portfolio tracker");
      expect(siteConfig.keywords).toContain("Zerodha Kite sync");
    });
  });

  describe("generateStructuredData", () => {
    it("generates valid Schema.org JSON-LD for WebApplication", () => {
      const schema = generateStructuredData();

      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("WebApplication");
      expect(schema["name"]).toBe("arthaX");
      expect(schema["applicationCategory"]).toBe("FinanceApplication");
      expect(schema["operatingSystem"]).toBe("All");
      expect(schema["offers"]).toEqual({
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
      });

      const featureList = schema["featureList"] as string[];
      expect(Array.isArray(featureList)).toBe(true);
      expect(featureList.some((f) => f.includes("Equities"))).toBe(true);
      expect(featureList.some((f) => f.includes("Mutual Funds"))).toBe(true);
      expect(featureList.some((f) => f.includes("Bullion"))).toBe(true);
      expect(featureList.some((f) => f.includes("Fixed Income"))).toBe(true);
      expect(featureList.some((f) => f.includes("Ledger"))).toBe(true);
    });
  });
});
