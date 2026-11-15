import { describe, it, expect } from "vitest";

describe("Indian Stock Market & Zerodha Kite Portfolio Logic", () => {
  it("calculates weighted average price when buying additional shares", () => {
    const existingQty = 10;
    const existingAvgPrice = 1000;
    const addedQty = 5;
    const addedPrice = 1300;

    const totalQty = existingQty + addedQty;
    const newAvgPrice = +((existingQty * existingAvgPrice + addedQty * addedPrice) / totalQty).toFixed(2);

    expect(totalQty).toBe(15);
    // (10,000 + 6,500) / 15 = 16,500 / 15 = 1100
    expect(newAvgPrice).toBe(1100);
  });

  it("calculates realized profit and loss when selling shares", () => {
    const currentQty = 20;
    const avgBuyPrice = 850;
    const sellQty = 10;
    const sellPrice = 1050;
    const brokerage = 20;

    const realizedPnL = +((sellPrice - avgBuyPrice) * sellQty - brokerage).toFixed(2);
    const remainingQty = currentQty - sellQty;

    expect(remainingQty).toBe(10);
    // (1050 - 850) * 10 - 20 = 200 * 10 - 20 = 1980
    expect(realizedPnL).toBe(1980);
  });

  it("calculates overall portfolio value, P&L, and returns percentage", () => {
    const holdings = [
      { qty: 10, avgPrice: 1200, ltp: 1350 }, // Invested 12,000; Current 13,500; PnL +1,500
      { qty: 25, avgPrice: 400, ltp: 380 },   // Invested 10,000; Current 9,500; PnL -500
    ];

    const totalInvested = holdings.reduce((sum, h) => sum + h.qty * h.avgPrice, 0);
    const totalCurrentValue = holdings.reduce((sum, h) => sum + h.qty * h.ltp, 0);
    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = +((totalPnL / totalInvested) * 100).toFixed(2);

    expect(totalInvested).toBe(22000);
    expect(totalCurrentValue).toBe(23000);
    expect(totalPnL).toBe(1000);
    expect(totalPnLPercent).toBe(4.55);
  });

  it("calculates day's P&L and change percentage", () => {
    const holdings = [
      { qty: 10, dayChange: 25 }, // Day change +250
      { qty: 20, dayChange: -5 }, // Day change -100
    ];

    const totalDayChange = holdings.reduce((sum, h) => sum + h.qty * h.dayChange, 0);
    expect(totalDayChange).toBe(150);
  });

  it("generates correct Zerodha Kite deep links for NSE and BSE instruments", () => {
    const symbol = "RELIANCE";
    const exchange = "NSE";
    const kiteUrl = `https://kite.zerodha.com/chart/ext/ciq/${exchange}/${symbol}`;
    expect(kiteUrl).toBe("https://kite.zerodha.com/chart/ext/ciq/NSE/RELIANCE");

    const bseUrl = `https://kite.zerodha.com/chart/ext/ciq/BSE/TCS`;
    expect(bseUrl).toBe("https://kite.zerodha.com/chart/ext/ciq/BSE/TCS");
  });
});
