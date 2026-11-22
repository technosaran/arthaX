/**
 * Net Worth Tool for arthaX MCP Server
 * Uses arthaX's precision calculation engine to aggregate net worth across all asset classes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";
import { executeNetWorthTS } from "../../lib/engine/embeddedEngine";

export async function handleGetNetWorth(
  db: SupabaseClient<Database>,
  userId: string,
  currency: string = "INR"
) {
  const [
    accountsRes,
    stocksRes,
    mfRes,
    bondsRes,
    bullionRes,
    cryptoRes,
  ] = await Promise.all([
    db.from("accounts").select("*").eq("user_id", userId),
    db.from("stock_holdings").select("*").eq("user_id", userId),
    db.from("mutual_fund_holdings").select("*").eq("user_id", userId),
    db.from("bond_holdings").select("*").eq("user_id", userId),
    db.from("bullion_holdings").select("*").eq("user_id", userId),
    db.from("crypto_holdings").select("*").eq("user_id", userId),
  ]);

  if (accountsRes.error) throw new Error(`Failed to fetch accounts: ${accountsRes.error.message}`);

  const calc = executeNetWorthTS({
    accounts: (accountsRes.data || []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      classification: acc.classification,
      balance: acc.balance,
    })),
    stocks: (stocksRes.data || []).map((s: any) => ({
      quantity: Number(s.quantity),
      current_price: Number(s.current_price || s.avg_buy_price || 0),
      avg_buy_price: Number(s.avg_buy_price || 0),
    })),
    mutual_funds: (mfRes.data || []).map((mf: any) => ({
      units: Number(mf.units),
      current_nav: Number(mf.current_nav || mf.avg_nav || 0),
      avg_nav: Number(mf.avg_nav || 0),
      invested_amount: Number(mf.invested_amount || 0),
    })),
    bonds: (bondsRes.data || []).map((b: any) => ({
      quantity: Number(b.quantity),
      current_price: Number(b.current_price || b.avg_buy_price || 0),
      avg_buy_price: Number(b.avg_buy_price || 0),
      face_value: Number(b.face_value || 1000),
    })),
    bullion: (bullionRes.data || []).map((bu: any) => ({
      metal: bu.metal,
      weight_grams: Number(bu.weight_grams),
      current_rate_per_gram: Number(bu.current_rate_per_gram || 0),
      total_buy_price: Number(bu.total_buy_price || 0),
    })),
    crypto: (cryptoRes.data || []).map((c: any) => ({
      total_value_usd: Number(c.total_value_usd || 0),
      total_quantity: Number(c.total_quantity || 0),
      current_price_usd: Number(c.current_price_usd || 0),
    })),
    currency,
  });

  return {
    totalNetWorth: Number(calc.net_worth),
    liquidCash: Number(calc.total_liquid_accounts),
    totalLiabilities: Number(calc.total_liabilities),
    totalInvestments: Number(calc.total_investments),
    stocksValuation: Number(calc.assets_breakdown.stocks),
    mutualFundsValuation: Number(calc.assets_breakdown.mutual_funds),
    bondsValuation: Number(calc.assets_breakdown.bonds),
    bullionValuation: Number(calc.assets_breakdown.bullion),
    cryptoValuation: Number(calc.assets_breakdown.crypto_inr),
    allocationPercentages: calc.allocation_percentages,
    currency: calc.currency,
  };
}
