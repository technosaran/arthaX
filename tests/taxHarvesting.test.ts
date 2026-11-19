import { describe, it, expect } from "vitest";

describe("Union Budget 2024 Indian Capital Gains & Tax-Loss Harvesting Engine", () => {
  const LTCG_EXEMPTION_LIMIT = 125000; // ₹1.25 Lakh under revised Section 112A
  const EQUITY_LTCG_RATE = 0.125; // 12.5%
  const EQUITY_STCG_RATE = 0.20; // 20% flat under Section 111A

  it("applies the revised ₹1.25 Lakh exemption limit for Equity LTCG", () => {
    const ltcgGain1 = 100000;
    const taxable1 = Math.max(0, ltcgGain1 - LTCG_EXEMPTION_LIMIT);
    const tax1 = taxable1 * EQUITY_LTCG_RATE;
    expect(taxable1).toBe(0);
    expect(tax1).toBe(0);

    const ltcgGain2 = 225000;
    const taxable2 = Math.max(0, ltcgGain2 - LTCG_EXEMPTION_LIMIT);
    const tax2 = taxable2 * EQUITY_LTCG_RATE;
    expect(taxable2).toBe(100000);
    expect(tax2).toBe(12500); // 12.5% of ₹1,00,000 = ₹12,500
  });

  it("applies the flat 20% tax rate on Equity STCG", () => {
    const stcgGain = 50000;
    const tax = stcgGain * EQUITY_STCG_RATE;
    expect(tax).toBe(10000); // 20% of ₹50,000 = ₹10,000
  });

  it("identifies tax-loss harvesting opportunities on unrealized losses", () => {
    const holdings = [
      {
        symbol: "TATAMOTORS",
        invested: 100000,
        current: 75000,
        holdingPeriodDays: 120, // Short-term
      },
      {
        symbol: "HDFCBANK",
        invested: 200000,
        current: 240000,
        holdingPeriodDays: 450, // In profit, not harvestable
      },
      {
        symbol: "INFY",
        invested: 150000,
        current: 120000,
        holdingPeriodDays: 400, // Long-term loss
      },
    ];

    const harvestable = holdings
      .filter((h) => h.current < h.invested)
      .map((h) => {
        const loss = h.invested - h.current;
        const isLtcg = h.holdingPeriodDays >= 365;
        const taxRate = isLtcg ? EQUITY_LTCG_RATE : EQUITY_STCG_RATE;
        const potentialSavings = loss * taxRate;
        return {
          symbol: h.symbol,
          loss,
          type: isLtcg ? "LTCG" : "STCG",
          potentialSavings,
        };
      });

    expect(harvestable).toHaveLength(2);
    // TATAMOTORS STCG loss ₹25,000 @ 20% = ₹5,000 tax savings
    expect(harvestable[0].symbol).toBe("TATAMOTORS");
    expect(harvestable[0].loss).toBe(25000);
    expect(harvestable[0].type).toBe("STCG");
    expect(harvestable[0].potentialSavings).toBe(5000);

    // INFY LTCG loss ₹30,000 @ 12.5% = ₹3,750 tax savings
    expect(harvestable[1].symbol).toBe("INFY");
    expect(harvestable[1].loss).toBe(30000);
    expect(harvestable[1].type).toBe("LTCG");
    expect(harvestable[1].potentialSavings).toBe(3750);

    const totalSavings = harvestable.reduce((acc, curr) => acc + curr.potentialSavings, 0);
    expect(totalSavings).toBe(8750);
  });
});
