import { describe, it, expect } from "vitest";
import {
  getStandardPurityPercentage,
  gramsToTolas,
  tolasToGrams,
  gramsToSovereigns,
  sovereignsToGrams,
  calculateHoldingMetrics,
  calculatePortfolioSummary,
  BullionHolding,
  BullionRates,
} from "@/utils/bullionCalculations";

const mockRates: BullionRates = {
  gold24kPerGram: 11000,
  gold22kPerGram: 10083,
  gold18kPerGram: 8250,
  gold14kPerGram: 6417,
  silver999PerGram: 160,
  silver925PerGram: 148,
  goldChange24h: 35,
  goldChangePercent24h: 0.32,
  silverChange24h: 1.2,
  silverChangePercent24h: 0.75,
  goldToSilverRatio: 68.75,
  usdinr: 93.46,
  goldUsdPerOz: 3865,
  silverUsdPerOz: 47.5,
  dayHighGold24k: 11100,
  dayLowGold24k: 10920,
  dayHighSilver999: 162.5,
  dayLowSilver999: 158.0,
  lastUpdated: new Date().toISOString(),
  marketStatus: {
    isOpen: true,
    phase: "LIVE",
    message: "Market Active",
  },
};

describe("Physical Gold & Silver Bullion Engine", () => {
  describe("Purity Standards & Hallmark Math", () => {
    it("resolves official Gold purity percentages accurately", () => {
      expect(getStandardPurityPercentage("GOLD", "24K")).toBe(99.90);
      expect(getStandardPurityPercentage("GOLD", "22K")).toBe(91.67);
      expect(getStandardPurityPercentage("GOLD", "18K")).toBe(75.00);
      expect(getStandardPurityPercentage("GOLD", "14K")).toBe(58.33);
      expect(getStandardPurityPercentage("GOLD", "916")).toBe(91.67);
      expect(getStandardPurityPercentage("GOLD", "750")).toBe(75.00);
    });

    it("resolves official Silver purity percentages accurately", () => {
      expect(getStandardPurityPercentage("SILVER", "999")).toBe(99.90);
      expect(getStandardPurityPercentage("SILVER", "925")).toBe(92.50);
      expect(getStandardPurityPercentage("SILVER", "STERLING")).toBe(92.50);
      expect(getStandardPurityPercentage("SILVER", "FINE")).toBe(99.90);
    });
  });

  describe("Indian Customary Weight Conversions", () => {
    it("converts grams to tolas and vice versa accurately", () => {
      // 11.6638 grams = 1 Tola
      expect(gramsToTolas(11.6638)).toBe(1);
      expect(gramsToTolas(116.638)).toBe(10);
      expect(tolasToGrams(1)).toBe(11.664);
      expect(tolasToGrams(5)).toBe(58.319);
    });

    it("converts grams to South Indian Sovereigns (Pavans) and vice versa", () => {
      // 8 grams = 1 Sovereign (Pavan)
      expect(gramsToSovereigns(8)).toBe(1);
      expect(gramsToSovereigns(16)).toBe(2);
      expect(gramsToSovereigns(20)).toBe(2.5);
      expect(sovereignsToGrams(1)).toBe(8);
      expect(sovereignsToGrams(4)).toBe(32);
    });
  });

  describe("Holding Valuation & P&L Calculation", () => {
    it("calculates live holding value and profit correctly for 24K Gold Coin", () => {
      const holding: BullionHolding = {
        id: "holding-1",
        user_id: "user-1",
        metal: "GOLD",
        name: "MMTC-PAMP 24K Gold Coin 10g",
        item_type: "COIN",
        purity: "24K",
        purity_percentage: 99.90,
        weight_grams: 10,
        quantity: 1,
        buy_price_per_gram: 9000,
        making_charges: 500,
        tax_gst: 285,
        total_buy_price: 90785, // 90000 + 500 + 285
        purchase_date: "2025-01-15",
        storage_location: "Bank Locker",
        cert_id: "HUID-998877",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const metrics = calculateHoldingMetrics(holding, mockRates);

      // Current 24K rate = 11,000 / g. Total weight = 10g -> Current Value = 1,10,000
      expect(metrics.totalWeight).toBe(10);
      expect(metrics.currentValue).toBe(110000);
      expect(metrics.investedAmount).toBe(90785);
      expect(metrics.unrealizedPnL).toBe(110000 - 90785);
      expect(metrics.isProfit).toBe(true);
      expect(metrics.returnPercent).toBeGreaterThan(20);
      expect(metrics.weightInSovereigns).toBe(1.25);
    });

    it("calculates holding value and loss correctly when market falls below cost", () => {
      const holding: BullionHolding = {
        id: "holding-2",
        user_id: "user-1",
        metal: "SILVER",
        name: "Silver Bullion Bar 500g",
        item_type: "BAR",
        purity: "999",
        purity_percentage: 99.90,
        weight_grams: 500,
        quantity: 1,
        buy_price_per_gram: 170, // bought at 170
        making_charges: 0,
        tax_gst: 0,
        total_buy_price: 85000,
        purchase_date: "2026-05-10",
        storage_location: "Home Safe",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const metrics = calculateHoldingMetrics(holding, mockRates);
      // Current rate = 160 / g -> Current Value = 80,000
      expect(metrics.currentValue).toBe(80000);
      expect(metrics.unrealizedPnL).toBe(-5000);
      expect(metrics.isProfit).toBe(false);
      expect(metrics.returnPercent).toBe(-5.88);
      expect(metrics.weightInKg).toBe(0.5);
    });
  });

  describe("Portfolio Aggregation Suite", () => {
    it("aggregates mixed gold and silver holdings with multi-storage breakdown", () => {
      const holdings: BullionHolding[] = [
        {
          id: "h1",
          user_id: "user-1",
          metal: "GOLD",
          name: "Gold Ring 22K",
          item_type: "JEWELRY",
          purity: "22K",
          purity_percentage: 91.67,
          weight_grams: 8, // 1 Sovereign
          quantity: 1,
          buy_price_per_gram: 8000,
          making_charges: 2000,
          tax_gst: 1980,
          total_buy_price: 67980,
          purchase_date: "2025-06-01",
          storage_location: "Home Safe",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "h2",
          user_id: "user-1",
          metal: "SILVER",
          name: "1kg Silver Bar",
          item_type: "BAR",
          purity: "999",
          purity_percentage: 99.90,
          weight_grams: 1000,
          quantity: 1,
          buy_price_per_gram: 140,
          making_charges: 500,
          tax_gst: 4200,
          total_buy_price: 144700,
          purchase_date: "2025-08-10",
          storage_location: "Bank Locker",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const summary = calculatePortfolioSummary(holdings, mockRates);

      expect(summary.gold.itemCount).toBe(1);
      expect(summary.gold.totalWeightGrams).toBe(8);
      expect(summary.gold.weightInSovereigns).toBe(1);
      expect(summary.silver.itemCount).toBe(1);
      expect(summary.silver.totalWeightGrams).toBe(1000);
      expect(summary.silver.weightInKg).toBe(1);

      expect(summary.totalInvested).toBe(67980 + 144700);
      expect(summary.totalCurrentValue).toBeGreaterThan(summary.totalInvested);
      expect(summary.totalUnrealizedPnL).toBeGreaterThan(0);

      expect(summary.byStorage["Home Safe"]).toBeDefined();
      expect(summary.byStorage["Bank Locker"]).toBeDefined();
      expect(summary.byItemType["JEWELRY"]).toBeDefined();
      expect(summary.byItemType["BAR"]).toBeDefined();
    });
  });
});
