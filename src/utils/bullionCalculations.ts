/**
 * Bullion & Precious Metals Valuation Engine for ArthaX
 * Supports physical Gold & Silver tracking with accurate purity math,
 * Indian customary units (Tola, Sovereign/Pavan, Kilogram), real-time
 * valuation, making charge reconciliation, and portfolio analytics.
 */

import { formatINRWhole } from "@/utils/money";

export type MetalType = "GOLD" | "SILVER";

export type GoldPurity = "24K" | "22K" | "18K" | "14K";
export type SilverPurity = "999" | "925" | "9999";

export type BullionItemType =
  | "COIN"
  | "BAR"
  | "JEWELRY"
  | "SOVEREIGN"
  | "BULLION"
  | "UTENSIL"
  | "OTHER";

export type StorageLocation =
  | "Home Safe"
  | "Bank Locker"
  | "Digital Vault"
  | "Custom";

export interface BullionHolding {
  id: string;
  user_id: string;
  metal: MetalType;
  name: string;
  item_type: BullionItemType;
  purity: string;
  purity_percentage: number;
  weight_grams: number;
  quantity: number;
  buy_price_per_gram: number;
  making_charges: number;
  tax_gst: number;
  total_buy_price: number;
  purchase_date: string;
  storage_location: string;
  cert_id?: string | null;
  account_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BullionTransaction {
  id: string;
  user_id: string;
  holding_id: string;
  metal: MetalType;
  type: "BUY" | "SELL";
  weight_grams: number;
  price_per_gram: number;
  making_charges: number;
  tax_gst: number;
  total_amount: number;
  transaction_date: string;
  notes?: string | null;
  created_at: string;
}

export interface BullionRates {
  gold24kPerGram: number;
  gold22kPerGram: number;
  gold18kPerGram: number;
  gold14kPerGram: number;
  silver999PerGram: number;
  silver925PerGram: number;
  goldChange24h: number;
  goldChangePercent24h: number;
  silverChange24h: number;
  silverChangePercent24h: number;
  goldToSilverRatio: number;
  usdinr: number;
  goldUsdPerOz: number;
  silverUsdPerOz: number;
  dayHighGold24k: number;
  dayLowGold24k: number;
  dayHighSilver999: number;
  dayLowSilver999: number;
  lastUpdated: string;
  isStale?: boolean;
  marketStatus: {
    isOpen: boolean;
    phase: "LIVE" | "CLOSED" | "WEEKEND";
    message: string;
  };
}

export interface BullionPortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  totalReturnPercent: number;
  gold: {
    itemCount: number;
    totalWeightGrams: number;
    pureWeightGrams: number;
    investedAmount: number;
    currentValue: number;
    unrealizedPnL: number;
    returnPercent: number;
    weightInTolas: number;
    weightInSovereigns: number;
  };
  silver: {
    itemCount: number;
    totalWeightGrams: number;
    pureWeightGrams: number;
    investedAmount: number;
    currentValue: number;
    unrealizedPnL: number;
    returnPercent: number;
    weightInKg: number;
    weightInTolas: number;
  };
  byStorage: Record<string, { count: number; totalValue: number; percent: number }>;
  byItemType: Record<string, { count: number; totalValue: number; percent: number }>;
}

// Customary unit constants
export const GRAMS_PER_TOLA = 11.6638;
export const GRAMS_PER_SOVEREIGN = 8.0000; // 1 South Indian Pavan / Sovereign
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

/**
 * Returns standard purity percentage for a given metal and purity label
 */
export function getStandardPurityPercentage(metal: MetalType, purity: string): number {
  const clean = purity.trim().toUpperCase();
  if (metal === "GOLD") {
    switch (clean) {
      case "24K":
      case "999":
      case "9999":
        return 99.90;
      case "22K":
      case "916":
        return 91.67;
      case "18K":
      case "750":
        return 75.00;
      case "14K":
      case "585":
        return 58.33;
      case "10K":
      case "417":
        return 41.70;
      default: {
        const num = parseFloat(clean.replace(/[^\d.]/g, ""));
        if (!isNaN(num) && num > 0 && num <= 100) return num;
        return 91.67; // Default hallmark 22K
      }
    }
  } else {
    // Silver
    switch (clean) {
      case "9999":
        return 99.99;
      case "999":
      case "FINE":
        return 99.90;
      case "925":
      case "STERLING":
        return 92.50;
      case "900":
      case "COIN":
        return 90.00;
      case "800":
        return 80.00;
      default: {
        const num = parseFloat(clean.replace(/[^\d.]/g, ""));
        if (!isNaN(num) && num > 0 && num <= 100) return num;
        return 99.90; // Default fine silver
      }
    }
  }
}

/**
 * Converts grams to tolas (rounded to 3 decimal places)
 */
export function gramsToTolas(grams: number): number {
  if (!grams || grams <= 0) return 0;
  return +(grams / GRAMS_PER_TOLA).toFixed(3);
}

/**
 * Converts tolas to grams (rounded to 3 decimal places)
 */
export function tolasToGrams(tolas: number): number {
  if (!tolas || tolas <= 0) return 0;
  return +(tolas * GRAMS_PER_TOLA).toFixed(3);
}

/**
 * Converts grams to South Indian Sovereigns / Pavans (8.0g each)
 */
export function gramsToSovereigns(grams: number): number {
  if (!grams || grams <= 0) return 0;
  return +(grams / GRAMS_PER_SOVEREIGN).toFixed(2);
}

/**
 * Converts sovereigns / pavans to grams
 */
export function sovereignsToGrams(sovereigns: number): number {
  if (!sovereigns || sovereigns <= 0) return 0;
  return +(sovereigns * GRAMS_PER_SOVEREIGN).toFixed(3);
}

/**
 * Get current rate per gram for a specific metal and purity
 */
export function getRateForHolding(
  metal: MetalType,
  purity: string,
  purityPercentage: number,
  rates: BullionRates
): number {
  if (metal === "GOLD") {
    const p = purity.trim().toUpperCase();
    if (p === "24K" || p === "999") return rates.gold24kPerGram;
    if (p === "22K" || p === "916") return rates.gold22kPerGram;
    if (p === "18K" || p === "750") return rates.gold18kPerGram;
    if (p === "14K" || p === "585") return rates.gold14kPerGram;
    // Calculate proportionally from 24K
    return +(rates.gold24kPerGram * (purityPercentage / 99.90)).toFixed(2);
  } else {
    const p = purity.trim().toUpperCase();
    if (p === "999" || p === "9999" || p === "FINE") return rates.silver999PerGram;
    if (p === "925" || p === "STERLING") return rates.silver925PerGram;
    return +(rates.silver999PerGram * (purityPercentage / 99.90)).toFixed(2);
  }
}

/**
 * Calculate detailed metrics for an individual bullion holding
 */
export function calculateHoldingMetrics(
  holding: BullionHolding,
  rates: BullionRates
) {
  const totalWeight = holding.weight_grams * (holding.quantity || 1);
  const pureWeightGrams = +(totalWeight * (holding.purity_percentage / 100)).toFixed(3);
  const currentRatePerGram = getRateForHolding(
    holding.metal,
    holding.purity,
    holding.purity_percentage,
    rates
  );

  const currentValue = Math.round(totalWeight * currentRatePerGram);
  const investedAmount = holding.total_buy_price || 0;
  const unrealizedPnL = currentValue - investedAmount;
  const returnPercent =
    investedAmount > 0
      ? +((unrealizedPnL / investedAmount) * 100).toFixed(2)
      : 0;

  return {
    totalWeight,
    pureWeightGrams,
    currentRatePerGram,
    currentValue,
    investedAmount,
    unrealizedPnL,
    returnPercent,
    isProfit: unrealizedPnL >= 0,
    weightInTolas: gramsToTolas(totalWeight),
    weightInSovereigns: holding.metal === "GOLD" ? gramsToSovereigns(totalWeight) : 0,
    weightInKg: holding.metal === "SILVER" ? +(totalWeight / 1000).toFixed(4) : 0,
  };
}

/**
 * Aggregates portfolio summary across all holdings
 */
export function calculatePortfolioSummary(
  holdings: BullionHolding[],
  rates: BullionRates
): BullionPortfolioSummary {
  let totalInvested = 0;
  let totalCurrentValue = 0;

  const goldSummary = {
    itemCount: 0,
    totalWeightGrams: 0,
    pureWeightGrams: 0,
    investedAmount: 0,
    currentValue: 0,
    unrealizedPnL: 0,
    returnPercent: 0,
    weightInTolas: 0,
    weightInSovereigns: 0,
  };

  const silverSummary = {
    itemCount: 0,
    totalWeightGrams: 0,
    pureWeightGrams: 0,
    investedAmount: 0,
    currentValue: 0,
    unrealizedPnL: 0,
    returnPercent: 0,
    weightInKg: 0,
    weightInTolas: 0,
  };

  const byStorageMap: Record<string, { count: number; totalValue: number }> = {};
  const byItemTypeMap: Record<string, { count: number; totalValue: number }> = {};

  holdings.forEach((h) => {
    const m = calculateHoldingMetrics(h, rates);
    totalInvested += m.investedAmount;
    totalCurrentValue += m.currentValue;

    if (h.metal === "GOLD") {
      goldSummary.itemCount += 1;
      goldSummary.totalWeightGrams += m.totalWeight;
      goldSummary.pureWeightGrams += m.pureWeightGrams;
      goldSummary.investedAmount += m.investedAmount;
      goldSummary.currentValue += m.currentValue;
    } else {
      silverSummary.itemCount += 1;
      silverSummary.totalWeightGrams += m.totalWeight;
      silverSummary.pureWeightGrams += m.pureWeightGrams;
      silverSummary.investedAmount += m.investedAmount;
      silverSummary.currentValue += m.currentValue;
    }

    const loc = h.storage_location || "Home Safe";
    if (!byStorageMap[loc]) byStorageMap[loc] = { count: 0, totalValue: 0 };
    byStorageMap[loc].count += 1;
    byStorageMap[loc].totalValue += m.currentValue;

    const itemType = h.item_type || "COIN";
    if (!byItemTypeMap[itemType]) byItemTypeMap[itemType] = { count: 0, totalValue: 0 };
    byItemTypeMap[itemType].count += 1;
    byItemTypeMap[itemType].totalValue += m.currentValue;
  });

  // Calculate Gold P&L & conversions
  goldSummary.unrealizedPnL = goldSummary.currentValue - goldSummary.investedAmount;
  goldSummary.returnPercent =
    goldSummary.investedAmount > 0
      ? +((goldSummary.unrealizedPnL / goldSummary.investedAmount) * 100).toFixed(2)
      : 0;
  goldSummary.weightInTolas = gramsToTolas(goldSummary.totalWeightGrams);
  goldSummary.weightInSovereigns = gramsToSovereigns(goldSummary.totalWeightGrams);

  // Calculate Silver P&L & conversions
  silverSummary.unrealizedPnL = silverSummary.currentValue - silverSummary.investedAmount;
  silverSummary.returnPercent =
    silverSummary.investedAmount > 0
      ? +((silverSummary.unrealizedPnL / silverSummary.investedAmount) * 100).toFixed(2)
      : 0;
  silverSummary.weightInKg = +(silverSummary.totalWeightGrams / 1000).toFixed(3);
  silverSummary.weightInTolas = gramsToTolas(silverSummary.totalWeightGrams);

  const totalUnrealizedPnL = totalCurrentValue - totalInvested;
  const totalReturnPercent =
    totalInvested > 0
      ? +((totalUnrealizedPnL / totalInvested) * 100).toFixed(2)
      : 0;

  // Convert storage map with percentages
  const byStorage: Record<string, { count: number; totalValue: number; percent: number }> = {};
  for (const [k, v] of Object.entries(byStorageMap)) {
    byStorage[k] = {
      count: v.count,
      totalValue: v.totalValue,
      percent: totalCurrentValue > 0 ? +((v.totalValue / totalCurrentValue) * 100).toFixed(1) : 0,
    };
  }

  // Convert item type map with percentages
  const byItemType: Record<string, { count: number; totalValue: number; percent: number }> = {};
  for (const [k, v] of Object.entries(byItemTypeMap)) {
    byItemType[k] = {
      count: v.count,
      totalValue: v.totalValue,
      percent: totalCurrentValue > 0 ? +((v.totalValue / totalCurrentValue) * 100).toFixed(1) : 0,
    };
  }

  return {
    totalInvested,
    totalCurrentValue,
    totalUnrealizedPnL,
    totalReturnPercent,
    gold: goldSummary,
    silver: silverSummary,
    byStorage,
    byItemType,
  };
}

/**
 * Format currency in Indian Rupees format (e.g. ₹1,25,000)
 */
export const formatCurrencyINR = (amount: number): string => formatINRWhole(amount);
