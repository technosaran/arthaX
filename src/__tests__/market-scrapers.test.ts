import { describe, it, expect } from "vitest";
import { fetchLiveGoldSilverRates } from "@/lib/market-scrapers/gold-silver-scraper";
import { fetchBatchCryptoPrices } from "@/lib/market-scrapers/crypto-sync";

describe("Market Scrapers", () => {
  it("fetches live gold and silver rates with valid numbers", async () => {
    const rates = await fetchLiveGoldSilverRates();
    expect(rates).toBeDefined();
    expect(rates.currency).toBe("INR");
    expect(rates.gold24kPerGram).toBeGreaterThan(1000);
    expect(rates.gold22kPerGram).toBeGreaterThan(1000);
    expect(rates.silverPerGram).toBeGreaterThan(10);
  });

  it("fetches crypto prices for BTC and ETH in batch", async () => {
    const prices = await fetchBatchCryptoPrices(["BTC", "ETH"]);
    expect(prices).toBeDefined();
    if (prices.BTC) {
      expect(prices.BTC.symbol).toBe("BTC");
      expect(prices.BTC.priceInr).toBeGreaterThan(10000);
    }
  });
});
