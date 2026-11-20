import { describe, it, expect } from "vitest";
import {
  parseMarketDepth,
  calculateCryptoSwap,
  getDemoMarketTickers,
  getDemoDepth,
  getDemoKlines,
  getDemoRecentTrades,
  getDemoSpotAccount,
} from "../src/utils/binance";

describe("Binance Market Intelligence & Showcase Engine", () => {
  it("parses raw Binance Depth L2 into calculated depth levels, spread, and liquidity ratio", () => {
    const raw = {
      lastUpdateId: 12345678,
      bids: [
        ["96400.00", "0.50000000"],
        ["96395.00", "1.20000000"],
      ] as [string, string][],
      asks: [
        ["96410.00", "0.80000000"],
        ["96415.00", "1.50000000"],
      ] as [string, string][],
    };

    const depth = parseMarketDepth("BTCUSDT", raw);

    expect(depth.symbol).toBe("BTCUSDT");
    expect(depth.highestBid).toBe(96400);
    expect(depth.lowestAsk).toBe(96410);
    expect(depth.spread).toBe(10);
    expect(depth.spreadPercent).toBeCloseTo((10 / 96410) * 100, 3);
    expect(depth.totalBidVolume).toBe(1.7);
    expect(depth.totalAskVolume).toBe(2.3);
    expect(depth.bidAskRatio).toBeCloseTo((1.7 / 4.0) * 100, 1);
    expect(depth.bids[0].total).toBe(0.5);
    expect(depth.bids[1].total).toBe(1.7);
  });

  it("calculates instant crypto swap conversion rates and Binance 0.1% spot fee", () => {
    const tickers = {
      BTCUSDT: {
        symbol: "BTCUSDT",
        lastPrice: "100000.00",
        priceChangePercent: "2.5",
      },
      ETHUSDT: {
        symbol: "ETHUSDT",
        lastPrice: "4000.00",
        priceChangePercent: "-1.0",
      },
    };

    // Swap 1 BTC to ETH
    // 1 BTC = $100,000 USD
    // 1 ETH = $4,000 USD
    // Ratio = 25 ETH
    // 0.1% spot fee = $100 USD fee -> 0.025 ETH fee
    // Received = 24.975 ETH
    const quote = calculateCryptoSwap("BTC", "ETH", 1, tickers);

    expect(quote.fromAsset).toBe("BTC");
    expect(quote.toAsset).toBe("ETH");
    expect(quote.fromAmount).toBe(1);
    expect(quote.executionPrice).toBe(25);
    expect(quote.invertedPrice).toBe(0.04);
    expect(quote.estimatedFeeUsd).toBe(100);
    expect(quote.toAmount).toBeCloseTo(24.975, 3);
  });

  it("handles identical from and to swap assets gracefully", () => {
    const quote = calculateCryptoSwap("USDT", "USDT", 500, {});
    expect(quote.toAmount).toBe(500);
    expect(quote.executionPrice).toBe(1);
    expect(quote.estimatedFeeUsd).toBe(0);
  });

  it("returns clean zero-state fallbacks without fake/mock data", () => {
    const tickers = getDemoMarketTickers();
    expect(tickers).toEqual({});

    const depth = getDemoDepth("BTCUSDT", 96000);
    expect(depth.bids).toHaveLength(0);
    expect(depth.asks).toHaveLength(0);
    expect(depth.spread).toBe(0);

    const klines = getDemoKlines("BTCUSDT", "1h", 20);
    expect(klines).toHaveLength(0);

    const trades = getDemoRecentTrades("BTCUSDT", 96000);
    expect(trades).toHaveLength(0);

    const account = getDemoSpotAccount();
    expect(account.balances).toHaveLength(0);
  });
});
