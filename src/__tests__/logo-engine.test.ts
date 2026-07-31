import { describe, it, expect } from "@jest/globals";
import { normalizeMerchant } from "@/lib/logo-engine/normalization";
import { ProviderPipeline } from "@/lib/logo-engine/providers/pipeline";

describe("arthaX Logo Management System - Normalization Engine", () => {
  it("normalizes SBI UPI to onlinesbi.sbi", () => {
    const res = normalizeMerchant("SBI UPI");
    expect(res.domain).toBe("onlinesbi.sbi");
    expect(res.category).toBe("upi");
  });

  it("normalizes ICICI BANK LTD to icicibank.com", () => {
    const res = normalizeMerchant("ICICI BANK LTD");
    expect(res.domain).toBe("icicibank.com");
    expect(res.category).toBe("bank");
  });

  it("normalizes AMAZON PAY INDIA to amazon.in", () => {
    const res = normalizeMerchant("AMAZON PAY INDIA");
    expect(res.domain).toBe("amazon.in");
    expect(res.category).toBe("payment_app");
  });

  it("normalizes GOOGLE *YOUTUBE to youtube.com", () => {
    const res = normalizeMerchant("GOOGLE *YOUTUBE");
    expect(res.domain).toBe("youtube.com");
    expect(res.category).toBe("company");
  });

  it("normalizes KFC INDIA to online.kfc.co.in", () => {
    const res = normalizeMerchant("KFC INDIA");
    expect(res.domain).toBe("online.kfc.co.in");
    expect(res.category).toBe("merchant");
  });
});

describe("arthaX Logo Management System - Provider Pipeline", () => {
  it("resolves multi-provider logo assets correctly for amazon.in", async () => {
    const pipeline = new ProviderPipeline();
    const result = await pipeline.resolveLogoFromProviders("amazon.in");
    expect(result).not.toBeNull();
    expect(result?.bestAsset).toBeDefined();
    expect(result?.bestAsset.url).toContain("amazon.in");
  });
});
