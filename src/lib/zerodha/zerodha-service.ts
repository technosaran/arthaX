import { SupabaseClient } from "@supabase/supabase-js";
import { ZerodhaHolding, ZerodhaPosition } from "./kite-client";

export interface SyncResult {
  syncedHoldingsCount: number;
  createdCount: number;
  updatedCount: number;
  errors: string[];
}

export class ZerodhaSyncService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Syncs Zerodha holdings array into the user's `investments` table in Supabase.
   */
  async syncHoldings(userId: string, holdings: ZerodhaHolding[]): Promise<SyncResult> {
    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    if (!holdings || holdings.length === 0) {
      return { syncedHoldingsCount: 0, createdCount: 0, updatedCount: 0, errors: [] };
    }

    // Fetch existing user investments to check for matches
    const { data: existingInvestments, error: fetchErr } = await this.supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId);

    if (fetchErr) {
      errors.push(`Failed to fetch existing investments: ${fetchErr.message}`);
    }

    const existingMap = new Map<string, any>();
    if (existingInvestments) {
      for (const inv of existingInvestments) {
        if (inv.symbol) {
          existingMap.set(inv.symbol.toUpperCase(), inv);
        }
      }
    }

    const now = new Date().toISOString();

    for (const h of holdings) {
      try {
        const symbol = h.tradingsymbol ? h.tradingsymbol.toUpperCase() : "";
        if (!symbol) continue;

        const quantity = h.quantity ?? 0;
        const buyPrice = h.average_price ?? h.price ?? 0;
        const currentPrice = h.last_price ?? h.close_price ?? buyPrice;
        const previousClose = h.close_price ?? currentPrice;
        const dayChange = h.day_change ?? 0;
        const dayChangePercent = h.day_change_percentage ?? 0;
        const stockName = h.tradingsymbol || symbol;

        const existingItem = existingMap.get(symbol);

        if (existingItem) {
          // Update existing stock investment
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
            errors.push(`Failed to update ${symbol}: ${updateErr.message}`);
          } else {
            updatedCount++;
          }
        } else {
          // Insert new stock investment
          const { error: insertErr } = await this.supabase
            .from("investments")
            .insert({
              user_id: userId,
              name: stockName,
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
            errors.push(`Failed to insert ${symbol}: ${insertErr.message}`);
          } else {
            createdCount++;
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
      errors,
    };
  }
}
