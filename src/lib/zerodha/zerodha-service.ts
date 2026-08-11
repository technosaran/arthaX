import { SupabaseClient } from "@supabase/supabase-js";
import { ZerodhaHolding } from "./kite-client";

export interface SyncResult {
  syncedHoldingsCount: number;
  createdCount: number;
  updatedCount: number;
  mutualFundsSynced: number;
  stocksSynced: number;
  errors: string[];
}

export class ZerodhaSyncService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Syncs Zerodha holdings array into the user's database in Supabase.
   * Intelligently routes Coin Mutual Funds (ISIN starting with INF) to `mutual_funds` table
   * and Equity Stocks/ETFs to `investments` table.
   */
  async syncHoldings(userId: string, holdings: ZerodhaHolding[]): Promise<SyncResult> {
    let createdCount = 0;
    let updatedCount = 0;
    let mutualFundsSynced = 0;
    let stocksSynced = 0;
    const errors: string[] = [];

    if (!holdings || holdings.length === 0) {
      return {
        syncedHoldingsCount: 0,
        createdCount: 0,
        updatedCount: 0,
        mutualFundsSynced: 0,
        stocksSynced: 0,
        errors: [],
      };
    }

    // 1. Fetch existing investments (Stocks)
    const { data: existingInvestments } = await this.supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId);

    const stockMap = new Map<string, any>();
    if (existingInvestments) {
      for (const inv of existingInvestments) {
        if (inv.symbol) {
          stockMap.set(inv.symbol.toUpperCase(), inv);
        }
      }
    }

    // 2. Fetch existing Mutual Funds
    const { data: existingMFs } = await this.supabase
      .from("mutual_funds")
      .select("*")
      .eq("user_id", userId);

    const mfMap = new Map<string, any>();
    if (existingMFs) {
      for (const mf of existingMFs) {
        const key = (mf.scheme_code || mf.fund_symbol || "").toUpperCase();
        if (key) {
          mfMap.set(key, mf);
        }
      }
    }

    const now = new Date().toISOString();

    for (const h of holdings) {
      try {
        const symbol = h.tradingsymbol ? h.tradingsymbol.toUpperCase() : "";
        const isin = h.isin ? h.isin.toUpperCase() : "";
        if (!symbol && !isin) continue;

        const isMutualFund = (isin && isin.startsWith("INF")) || h.exchange === "MF";
        const quantity = h.quantity ?? 0;
        const buyPrice = h.average_price ?? h.price ?? 0;
        const currentPrice = h.last_price ?? h.close_price ?? buyPrice;
        const previousClose = h.close_price ?? currentPrice;
        const dayChange = h.day_change ?? 0;
        const dayChangePercent = h.day_change_percentage ?? 0;
        const name = h.tradingsymbol || symbol;

        if (isMutualFund) {
          // Route to Mutual Funds table
          mutualFundsSynced++;
          const lookupKey = isin || symbol;
          const existingMF = mfMap.get(lookupKey) || mfMap.get(symbol);

          if (existingMF) {
            const { error: updateErr } = await this.supabase
              .from("mutual_funds")
              .update({
                units: quantity.toString(),
                avg_nav: buyPrice.toString(),
                current_nav: currentPrice.toString(),
                previous_nav: previousClose.toString(),
                day_change: dayChange.toString(),
                day_change_percent: dayChangePercent.toString(),
                last_nav_updated_at: now,
                updated_at: now,
              })
              .eq("id", existingMF.id);

            if (updateErr) {
              errors.push(`Failed to update MF ${name}: ${updateErr.message}`);
            } else {
              updatedCount++;
            }
          } else {
            const { error: insertErr } = await this.supabase
              .from("mutual_funds")
              .insert({
                user_id: userId,
                fund_name: name,
                fund_symbol: symbol,
                scheme_code: isin || symbol,
                amc_name: "Zerodha Coin",
                category: "Mutual Fund",
                investment_type: "Demat",
                units: quantity.toString(),
                avg_nav: buyPrice.toString(),
                current_nav: currentPrice.toString(),
                previous_nav: previousClose.toString(),
                day_change: dayChange.toString(),
                day_change_percent: dayChangePercent.toString(),
                last_nav_updated_at: now,
              });

            if (insertErr) {
              errors.push(`Failed to insert MF ${name}: ${insertErr.message}`);
            } else {
              createdCount++;
            }
          }
        } else {
          // Route to Investments (Stocks) table
          stocksSynced++;
          const existingItem = stockMap.get(symbol);

          if (existingItem) {
            const { error: updateErr } = await this.supabase
              .from("investments")
              .update({
                quantity: quantity.toString(),
                buy_price: buyPrice.toString(),
                current_price: currentPrice.toString(),
                previous_close: previousClose.toString(),
                day_change: dayChange.toString(),
                day_change_percent: dayChangePercent.toString(),
                last_fetch_at: now,
                updated_at: now,
              })
              .eq("id", existingItem.id);

            if (updateErr) {
              errors.push(`Failed to update Stock ${symbol}: ${updateErr.message}`);
            } else {
              updatedCount++;
            }
          } else {
            const { error: insertErr } = await this.supabase
              .from("investments")
              .insert({
                user_id: userId,
                name: name,
                type: "stock",
                symbol: symbol,
                quantity: quantity.toString(),
                buy_price: buyPrice.toString(),
                current_price: currentPrice.toString(),
                previous_close: previousClose.toString(),
                day_change: dayChange.toString(),
                day_change_percent: dayChangePercent.toString(),
                currency: "INR",
                notes: "Imported via Zerodha Kite Connect API",
                last_fetch_at: now,
              });

            if (insertErr) {
              errors.push(`Failed to insert Stock ${symbol}: ${insertErr.message}`);
            } else {
              createdCount++;
            }
          }
        }
      } catch (err: any) {
        errors.push(`Error processing ${h.tradingsymbol}: ${err.message || String(err)}`);
      }
    }

    return {
      syncedHoldingsCount: holdings.length,
      createdCount,
      updatedCount,
      mutualFundsSynced,
      stocksSynced,
      errors,
    };
  }
}
