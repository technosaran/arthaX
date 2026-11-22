/**
 * Portfolio Holdings Tool for arthaX MCP Server
 * Exposes multi-asset investment holdings (Stocks, Mutual Funds, Bullion, Bonds, Crypto).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export type AssetClassFilter = "all" | "stocks" | "mutual_funds" | "bullion" | "bonds" | "crypto";

export async function handleGetHoldings(
  db: SupabaseClient<Database>,
  userId: string,
  assetClass: AssetClassFilter = "all"
) {
  const result: Record<string, any> = {};

  if (assetClass === "all" || assetClass === "stocks") {
    const { data: stocks, error } = await db.from("stock_holdings").select("*").eq("user_id", userId);
    if (error) throw new Error(`Failed to fetch stocks: ${error.message}`);
    result.stocks = (stocks || []).map((s: any) => ({
      id: s.id,
      symbol: s.symbol,
      companyName: s.company_name,
      quantity: Number(s.quantity),
      avgBuyPrice: Number(s.avg_buy_price || 0),
      currentPrice: Number(s.current_price || 0),
      investedValue: Number(s.quantity) * Number(s.avg_buy_price || 0),
      currentValue: Number(s.quantity) * Number(s.current_price || s.avg_buy_price || 0),
      pnl: (Number(s.current_price || s.avg_buy_price || 0) - Number(s.avg_buy_price || 0)) * Number(s.quantity),
    }));
  }

  if (assetClass === "all" || assetClass === "mutual_funds") {
    const { data: mfs, error } = await db.from("mutual_fund_holdings").select("*").eq("user_id", userId);
    if (error) throw new Error(`Failed to fetch mutual funds: ${error.message}`);
    result.mutualFunds = (mfs || []).map((m: any) => ({
      id: m.id,
      schemeName: m.scheme_name,
      units: Number(m.units),
      avgNav: Number(m.avg_nav || 0),
      currentNav: Number(m.current_nav || 0),
      investedAmount: Number(m.invested_amount || 0),
      currentValue: Number(m.units) * Number(m.current_nav || m.avg_nav || 0),
    }));
  }

  if (assetClass === "all" || assetClass === "bullion") {
    const { data: bullion, error } = await db.from("bullion_holdings").select("*").eq("user_id", userId);
    if (error) throw new Error(`Failed to fetch bullion: ${error.message}`);
    result.bullion = (bullion || []).map((b: any) => ({
      id: b.id,
      metal: b.metal,
      weightGrams: Number(b.weight_grams),
      purity: b.purity,
      ratePerGram: Number(b.current_rate_per_gram || 0),
      currentValue: Number(b.weight_grams) * Number(b.current_rate_per_gram || 0),
    }));
  }

  if (assetClass === "all" || assetClass === "bonds") {
    const { data: bonds, error } = await db.from("bond_holdings").select("*").eq("user_id", userId);
    if (error) throw new Error(`Failed to fetch bonds: ${error.message}`);
    result.bonds = (bonds || []).map((bo: any) => ({
      id: bo.id,
      name: bo.name,
      isin: bo.isin,
      quantity: Number(bo.quantity),
      couponRate: Number(bo.coupon_rate || 0),
      currentPrice: Number(bo.current_price || bo.avg_buy_price || 0),
      currentValue: Number(bo.quantity) * Number(bo.current_price || bo.avg_buy_price || 0),
    }));
  }

  if (assetClass === "all" || assetClass === "crypto") {
    const { data: crypto, error } = await db.from("crypto_holdings").select("*").eq("user_id", userId);
    if (error) throw new Error(`Failed to fetch crypto: ${error.message}`);
    result.crypto = (crypto || []).map((c: any) => ({
      id: c.id,
      symbol: c.symbol,
      totalQuantity: Number(c.total_quantity || 0),
      currentPriceUsd: Number(c.current_price_usd || 0),
      totalValueUsd: Number(c.total_value_usd || 0),
    }));
  }

  return result;
}
