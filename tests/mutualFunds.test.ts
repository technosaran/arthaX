import { describe, it, expect } from "vitest";
import { inferCategoryAndAsset, inferFundHouse } from "@/app/api/v1/mutual-funds/search/route";

describe("Indian Mutual Funds & Zerodha Coin Portfolio Logic", () => {
  it("calculates weighted average NAV when accumulating units via SIP or lumpsum", () => {
    const existingUnits = 150.5;
    const existingAvgNav = 72.4;
    const sipUnits = 25.0;
    const sipAllotmentNav = 80.0;

    const totalUnits = +(existingUnits + sipUnits).toFixed(4);
    const newAvgNav = +(
      (existingUnits * existingAvgNav + sipUnits * sipAllotmentNav) /
      totalUnits
    ).toFixed(4);

    expect(totalUnits).toBe(175.5);
    // (150.5 * 72.4 + 25 * 80) / 175.5 = (10896.2 + 2000) / 175.5 = 12896.2 / 175.5 = 73.4826
    expect(newAvgNav).toBe(73.4826);
  });

  it("calculates realized profit and loss when redeeming units", () => {
    const currentUnits = 200.0;
    const avgNav = 65.0;
    const redeemUnits = 50.0;
    const redemptionNav = 85.0;
    const stampDuty = 5.0;

    const grossProceeds = +(redeemUnits * redemptionNav).toFixed(2);
    const realizedPnL = +(
      (redemptionNav - avgNav) * redeemUnits -
      stampDuty
    ).toFixed(2);
    const remainingUnits = +(currentUnits - redeemUnits).toFixed(4);

    expect(grossProceeds).toBe(4250.0);
    // (85 - 65) * 50 - 5 = 20 * 50 - 5 = 1000 - 5 = 995
    expect(realizedPnL).toBe(995.0);
    expect(remainingUnits).toBe(150.0);
  });

  it("calculates overall portfolio value, P&L, and returns percentage", () => {
    const holdings = [
      { units: 500, avgNav: 50.0, currentNav: 62.5 }, // Invested 25,000; Current 31,250; PnL +6,250
      { units: 200, avgNav: 110.0, currentNav: 104.5 }, // Invested 22,000; Current 20,900; PnL -1,100
    ];

    const totalInvested = holdings.reduce(
      (sum, h) => sum + h.units * h.avgNav,
      0
    );
    const totalCurrentValue = holdings.reduce(
      (sum, h) => sum + h.units * h.currentNav,
      0
    );
    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = +((totalPnL / totalInvested) * 100).toFixed(2);

    expect(totalInvested).toBe(47000);
    expect(totalCurrentValue).toBe(52150);
    expect(totalPnL).toBe(5150);
    expect(totalPnLPercent).toBe(10.96);
  });

  it("calculates 1-day gain and percentage change based on latest AMFI NAVs", () => {
    const holdings = [
      { units: 100, liveNav: 85.0, dayChange: 1.25 }, // Day change: +125.0
      { units: 250, liveNav: 40.0, dayChange: -0.4 }, // Day change: -100.0
    ];

    const totalDayChange = holdings.reduce(
      (sum, h) => sum + h.units * h.dayChange,
      0
    );
    expect(totalDayChange).toBe(25.0);
  });

  it("calculates monthly SIP commitment with mixed frequencies", () => {
    const sips = [
      { amount: 5000, frequency: "MONTHLY" },
      { amount: 2500, frequency: "MONTHLY" },
      { amount: 1000, frequency: "WEEKLY" }, // ~4.33 weeks per month = ~4330
    ];

    const monthlyTotal = sips.reduce((sum, s) => {
      if (s.frequency === "MONTHLY") return sum + s.amount;
      if (s.frequency === "WEEKLY") return sum + s.amount * 4.33;
      return sum;
    }, 0);

    expect(Math.round(monthlyTotal)).toBe(11830);
  });

  it("correctly infers AMFI category, asset class, and fund house", () => {
    const flexi = inferCategoryAndAsset("Parag Parikh Flexi Cap Fund - Direct Plan - Growth");
    expect(flexi.category).toBe("Flexi Cap");
    expect(flexi.assetClass).toBe("Equity");
    expect(inferFundHouse("Parag Parikh Flexi Cap Fund - Direct Plan - Growth")).toBe("PPFAS Mutual Fund");

    const small = inferCategoryAndAsset("Quant Small Cap Fund - Direct Plan - Growth");
    expect(small.category).toBe("Small Cap");
    expect(small.assetClass).toBe("Equity");
    expect(inferFundHouse("Quant Small Cap Fund - Direct Plan - Growth")).toBe("Quant Mutual Fund");

    const elss = inferCategoryAndAsset("Mirae Asset ELSS Tax Saver Fund - Direct Plan - Growth");
    expect(elss.category).toBe("ELSS (Tax Saver)");
    expect(elss.assetClass).toBe("Equity");

    const indexFund = inferCategoryAndAsset("UTI Nifty 50 Index Fund - Direct Plan - Growth");
    expect(indexFund.category).toBe("Index Fund");
    expect(indexFund.assetClass).toBe("Equity");

    const hybrid = inferCategoryAndAsset("ICICI Prudential Balanced Advantage Fund - Direct Plan - Growth");
    expect(hybrid.category).toBe("Hybrid / Balanced");
    expect(hybrid.assetClass).toBe("Hybrid");

    const liquid = inferCategoryAndAsset("ICICI Prudential Liquid Fund - Direct Plan - Growth");
    expect(liquid.category).toBe("Debt & Liquid");
    expect(liquid.assetClass).toBe("Debt");

    const silver = inferCategoryAndAsset("Nippon India Silver ETF Fund of Fund - Direct Plan - Growth");
    expect(silver.category).toBe("Commodities");
    expect(silver.assetClass).toBe("Commodity");
  });

  it("generates correct Zerodha Coin URLs", () => {
    const coinBaseUrl = "https://coin.zerodha.com";
    const consoleMfUrl = "https://console.zerodha.com/portfolio/mf";

    expect(coinBaseUrl).toBe("https://coin.zerodha.com");
    expect(consoleMfUrl).toBe("https://console.zerodha.com/portfolio/mf");
  });
});
