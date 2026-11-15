import { describe, it, expect } from "vitest";
import {
  calculateZerodhaCharges,
  calculatePCR,
  interpretPCR,
} from "@/utils/fnoCalculations";

describe("Zerodha Kite F&O Derivatives & Portfolio Logic", () => {
  it("calculates standard Zerodha brokerage capped at flat ₹20 per order", () => {
    // 1 lot of NIFTY (25 qty) @ ₹150 premium = ₹3,750 turnover
    // 0.03% of 3750 = ₹1.125 (lower than 20)
    const smallOrder = calculateZerodhaCharges("CE", "BUY", 25, 150);
    expect(smallOrder.brokerage).toBeLessThanOrEqual(20);
    expect(smallOrder.brokerage).toBe(1.13);

    // Large order: 10 lots of NIFTY (250 qty) @ ₹400 premium = ₹1,00,000 turnover
    // 0.03% of 100,000 = ₹30 (capped at ₹20)
    const largeOrder = calculateZerodhaCharges("CE", "BUY", 250, 400);
    expect(largeOrder.brokerage).toBe(20);
  });

  it("calculates STT correctly for Options sell side and Futures sell side", () => {
    // Options BUY has 0 STT
    const optionBuy = calculateZerodhaCharges("CE", "BUY", 50, 200);
    expect(optionBuy.stt).toBe(0);

    // Options SELL has 0.125% STT on turnover
    // Turnover = 50 * 200 = 10,000. STT = 10,000 * 0.00125 = 12.50
    const optionSell = calculateZerodhaCharges("CE", "SELL", 50, 200);
    expect(optionSell.stt).toBe(12.5);

    // Futures SELL has 0.02% STT
    // Turnover = 25 * 24000 = 6,00,000. STT = 6,00,000 * 0.0002 = 120
    const futSell = calculateZerodhaCharges("FUT", "SELL", 25, 24000);
    expect(futSell.stt).toBe(120);
  });

  it("calculates Realized P&L for Long (BUY) Call Option square-off", () => {
    const qty = 50; // 2 lots NIFTY
    const entryPrice = 120;
    const exitPrice = 185;

    const rawPnL = (exitPrice - entryPrice) * qty;
    expect(rawPnL).toBe(3250); // (185 - 120) * 50 = 65 * 50 = 3250

    const exitCharges = calculateZerodhaCharges("CE", "SELL", qty, exitPrice);
    const netPnL = +(rawPnL - exitCharges.totalCharges).toFixed(2);

    expect(netPnL).toBeLessThan(rawPnL);
    expect(netPnL).toBeGreaterThan(3200);
  });

  it("calculates Realized P&L for Short (SELL) Option writing square-off", () => {
    const qty = 50;
    const entryPrice = 160; // Sold at 160
    const exitPrice = 40;   // Bought back at 40 (profit of 120 pts)

    const rawPnL = (entryPrice - exitPrice) * qty;
    expect(rawPnL).toBe(6000); // 120 * 50 = 6000

    // Square off exit side is BUY
    const exitCharges = calculateZerodhaCharges("PE", "BUY", qty, exitPrice);
    const netPnL = +(rawPnL - exitCharges.totalCharges).toFixed(2);

    expect(netPnL).toBeLessThan(rawPnL);
    expect(netPnL).toBeGreaterThan(5950);
  });

  it("computes Put-Call Ratio (PCR) and sentiment thresholds", () => {
    const totalCallOi = 1200000;
    const bullishPutOi = 1680000; // PCR = 1.40
    const bearishPutOi = 840000;  // PCR = 0.70

    const bullishPcr = calculatePCR(totalCallOi, bullishPutOi);
    const bearishPcr = calculatePCR(totalCallOi, bearishPutOi);

    expect(bullishPcr).toBe(1.4);
    expect(interpretPCR(bullishPcr)).toBe("Bullish");

    expect(bearishPcr).toBe(0.7);
    expect(interpretPCR(bearishPcr)).toBe("Bearish");
  });

  it("calculates Points to Breakeven based on total statutory charges", () => {
    const qty = 50;
    const totalCharges = 42.5; // Brokerage + STT + GST + Exchange

    const pointsToBreakeven = +(totalCharges / qty).toFixed(2);
    expect(pointsToBreakeven).toBe(0.85); // Trader needs +0.85 pts to clear fees
  });
});
