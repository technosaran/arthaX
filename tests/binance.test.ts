import { describe, it, expect } from "vitest";
import {
  generateBinanceSignature,
  parseBinanceBalances,
  calculateCryptoValuations,
  BinanceBalance,
  BinanceTicker,
} from "../src/utils/binance";

describe("Binance Utilities & Crypto Valuation Engine", () => {
  it("generates correct HMAC-SHA256 signature for Binance API", () => {
    const queryString = "symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559";
    const secret = "NhqPtMDaIMip註NpY9V1x2a3...";
    const signature = generateBinanceSignature(queryString, secret);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBe(64); // SHA-256 hex string length
  });

  it("filters out zero-balance assets and parses valid balances", () => {
    const rawBalances: BinanceBalance[] = [
      { asset: "BTC", free: "0.50000000", locked: "0.10000000" },
      { asset: "ETH", free: "2.00000000", locked: "0.00000000" },
      { asset: "DOGE", free: "0.00000000", locked: "0.00000000" },
      { asset: "SHIB", free: "0.00000000", locked: "0.00000000" },
    ];

    const parsed = parseBinanceBalances(rawBalances);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      asset: "BTC",
      free: 0.5,
      locked: 0.1,
      total: 0.6,
    });
    expect(parsed[1]).toEqual({
      asset: "ETH",
      free: 2.0,
      locked: 0,
      total: 2.0,
    });
  });

  it("calculates crypto portfolio valuations with stablecoins pegged to $1.00", () => {
    const balances = [
      { asset: "USDT", free: 1000, locked: 0, total: 1000 },
      { asset: "BTC", free: 0.5, locked: 0, total: 0.5 },
      { asset: "ETH", free: 2, locked: 0, total: 2 },
    ];

    const tickers: Record<string, BinanceTicker> = {
      BTCUSDT: { symbol: "BTCUSDT", lastPrice: "60000.00", priceChangePercent: "5.00" },
      ETHUSDT: { symbol: "ETHUSDT", lastPrice: "3000.00", priceChangePercent: "-2.00" },
    };

    const result = calculateCryptoValuations(balances, tickers);

    // USDT: 1000 * $1 = $1000
    // BTC: 0.5 * $60,000 = $30,000
    // ETH: 2 * $3,000 = $6,000
    // Total = $37,000
    expect(result.totalPortfolioUsd).toBeCloseTo(37000, 2);

    const btcAsset = result.assets.find((a) => a.asset === "BTC");
    expect(btcAsset).toBeDefined();
    expect(btcAsset?.currentPriceUsd).toBe(60000);
    expect(btcAsset?.totalValueUsd).toBe(30000);
    expect(btcAsset?.change24h).toBe(5);
    expect(btcAsset?.allocationPercent).toBeCloseTo((30000 / 37000) * 100, 1);

    const usdtAsset = result.assets.find((a) => a.asset === "USDT");
    expect(usdtAsset?.currentPriceUsd).toBe(1);
    expect(usdtAsset?.totalValueUsd).toBe(1000);
  });

  it("handles missing ticker gracefully without throwing NaN", () => {
    const balances = [
      { asset: "UNKNOWN_TOKEN", free: 10, locked: 0, total: 10 },
    ];
    const tickers: Record<string, BinanceTicker> = {};

    const result = calculateCryptoValuations(balances, tickers);
    expect(result.totalPortfolioUsd).toBe(0);
    expect(result.assets[0].currentPriceUsd).toBe(0);
    expect(result.assets[0].totalValueUsd).toBe(0);
  });
});
