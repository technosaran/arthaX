import { describe, it, expect } from "vitest";
import {
  parseBinanceRawTrades,
  calculateTradeStats,
  getExitedAssets,
} from "../src/utils/binance";

describe("Binance Trades & Realized Sell Analytics", () => {
  const sampleRawTrades = [
    {
      id: 1001,
      orderId: 5001,
      symbol: "BTCUSDT",
      price: "60000.00",
      qty: "0.1",
      quoteQty: "6000.00",
      commission: "6.00",
      commissionAsset: "USDT",
      time: 1700000000000,
      isBuyer: true,
      isMaker: false,
    },
    {
      id: 1002,
      orderId: 5002,
      symbol: "BTCUSDT",
      price: "90000.00",
      qty: "0.1",
      quoteQty: "9000.00",
      commission: "9.00",
      commissionAsset: "USDT",
      time: 1705000000000,
      isBuyer: false, // SELL
      isMaker: true,
    },
    {
      id: 1003,
      orderId: 5003,
      symbol: "SOLUSDT",
      price: "150.00",
      qty: "10.0",
      quoteQty: "1500.00",
      commission: "1.50",
      commissionAsset: "USDT",
      time: 1706000000000,
      isBuyer: true,
      isMaker: false,
    },
    {
      id: 1004,
      orderId: 5004,
      symbol: "SOLUSDT",
      price: "200.00",
      qty: "10.0",
      quoteQty: "2000.00",
      commission: "2.00",
      commissionAsset: "USDT",
      time: 1707000000000,
      isBuyer: false, // SELL
      isMaker: false,
    },
  ];

  it("parses raw Binance trade responses into structured CalculatedCryptoTrade models", () => {
    const parsed = parseBinanceRawTrades(sampleRawTrades);

    expect(parsed).toHaveLength(4);
    expect(parsed[0].tradeId).toBe(1001);
    expect(parsed[0].symbol).toBe("BTCUSDT");
    expect(parsed[0].side).toBe("BUY");
    expect(parsed[0].price).toBe(60000);
    expect(parsed[0].qty).toBe(0.1);
    expect(parsed[0].quoteQty).toBe(6000);
    expect(parsed[0].isBuyer).toBe(true);

    expect(parsed[1].tradeId).toBe(1002);
    expect(parsed[1].side).toBe("SELL");
    expect(parsed[1].price).toBe(90000);
    expect(parsed[1].quoteQty).toBe(9000);
    expect(parsed[1].isBuyer).toBe(false);
  });

  it("calculates total buy volume, realized sell volume, net flows, and trade metrics", () => {
    const parsed = parseBinanceRawTrades(sampleRawTrades);
    const stats = calculateTradeStats(parsed);

    // Buys: 6000 (BTC) + 1500 (SOL) = 7500
    expect(stats.totalBuysUsd).toBe(7500);
    // Sells: 9000 (BTC) + 2000 (SOL) = 11000
    expect(stats.totalSellsUsd).toBe(11000);
    // Net Invested: 7500 - 11000 = -3500 (net cash profit realized)
    expect(stats.netInvestedUsd).toBe(-3500);
    expect(stats.totalTradesCount).toBe(4);
    expect(stats.buyTradesCount).toBe(2);
    expect(stats.sellTradesCount).toBe(2);
    expect(stats.totalFeesUsd).toBe(18.5);
  });

  it("identifies exited / completely sold assets when current active balance is 0", () => {
    const parsed = parseBinanceRawTrades(sampleRawTrades);
    // Suppose user currently only holds ETH in active wallet (BTC and SOL are 0 / sold)
    const activeAssets = new Set(["ETH"]);
    const exited = getExitedAssets(parsed, activeAssets);

    expect(exited).toHaveLength(2);
    const btcExit = exited.find((e) => e.asset === "BTC");
    expect(btcExit).toBeDefined();
    expect(btcExit?.totalSoldQuantity).toBe(0.1);
    expect(btcExit?.totalRealizedUsd).toBe(9000);
    expect(btcExit?.averageExitPrice).toBe(90000);

    const solExit = exited.find((e) => e.asset === "SOL");
    expect(solExit).toBeDefined();
    expect(solExit?.totalSoldQuantity).toBe(10);
    expect(solExit?.totalRealizedUsd).toBe(2000);
    expect(solExit?.averageExitPrice).toBe(200);
  });

  it("does not classify an asset as exited if it is still in active holdings", () => {
    const parsed = parseBinanceRawTrades(sampleRawTrades);
    // User still holds SOL in spot wallet
    const activeAssets = new Set(["SOL"]);
    const exited = getExitedAssets(parsed, activeAssets);

    expect(exited.some((e) => e.asset === "SOL")).toBe(false);
    expect(exited.some((e) => e.asset === "BTC")).toBe(true);
  });
});
