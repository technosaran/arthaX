import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseBinanceBalances, calculateCryptoValuations } from "../src/utils/binance";

const ConnectSchema = z.object({
  apiKey: z.string().min(10, "Valid Binance API Key is required").max(128),
  apiSecret: z.string().min(10, "Valid Binance API Secret is required").max(128),
});

describe("Crypto API Schemas & Integration Logic", () => {
  it("validates valid Binance API key and secret", () => {
    const valid = {
      apiKey: "vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwCIPy6utIco14y7Ju91duEh8A",
      apiSecret: "NhqPtMDaIMip註NpY9V1x2a3...thisIsAValidLengthSecretKey12345",
    };
    const parsed = ConnectSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects empty or short API key and secret", () => {
    const invalid = { apiKey: "", apiSecret: "123" };
    const parsed = ConnectSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("processes Binance spot account balances and computes USD portfolio payload", () => {
    const balances = [
      { asset: "BTC", free: "1.25", locked: "0.25" },
      { asset: "USDT", free: "5000.00", locked: "0" },
      { asset: "BNB", free: "10.00", locked: "2.00" },
    ];

    const tickers = {
      BTCUSDT: { symbol: "BTCUSDT", lastPrice: "90000.00", priceChangePercent: "4.5" },
      BNBUSDT: { symbol: "BNBUSDT", lastPrice: "650.00", priceChangePercent: "-1.2" },
    };

    const parsed = parseBinanceBalances(balances);
    expect(parsed).toHaveLength(3);

    const portfolio = calculateCryptoValuations(parsed, tickers);
    // BTC: 1.5 * 90000 = 135,000
    // USDT: 5000 * 1 = 5,000
    // BNB: 12 * 650 = 7,800
    // Total = 147,800
    expect(portfolio.totalPortfolioUsd).toBe(147800);
    expect(portfolio.assetsCount).toBe(3);
    expect(portfolio.assets[0].asset).toBe("BTC");
    expect(portfolio.assets[0].totalValueUsd).toBe(135000);
  });
});
