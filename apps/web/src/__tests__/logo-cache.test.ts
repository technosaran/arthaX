import { describe, it, expect, beforeEach } from "@jest/globals";
import { getCachedLogo, setCachedLogo, setCachedLogoNotFound, isLogoNotFound, NOT_FOUND } from "@/lib/logo-cache";

describe("Logo Cache & Negative Lookup Caching", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  it("stores and retrieves successful logo URLs from cache", () => {
    setCachedLogo("amazon", "https://api.iconhorse.com/v1/amazon.com");
    expect(getCachedLogo("amazon")).toBe("https://api.iconhorse.com/v1/amazon.com");
  });

  it("caches negative lookups (NOT_FOUND) correctly", () => {
    setCachedLogoNotFound("unknown_merchant_xyz");
    expect(getCachedLogo("unknown_merchant_xyz")).toBe(NOT_FOUND);
    expect(isLogoNotFound("unknown_merchant_xyz")).toBe(true);
  });
});
