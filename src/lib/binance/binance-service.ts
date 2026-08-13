import { SupabaseClient } from "@supabase/supabase-js";
import { BinanceBalance, BinanceTicker24h } from "./binance-client";
import { CacheService } from "@/lib/cache-service";

export interface BinanceSyncResult {
  syncedHoldingsCount: number;
  createdCount: number;
  updatedCount: number;
  errors: string[];
}

const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI"]);

const ASSET_NAME_MAP: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "Ripple",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  SUI: "Sui",
  PEPE: "Pepe",
  DOT: "Polkadot",
  MATIC: "Polygon",
  POL: "Polygon",
  LINK: "Chainlink",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  SHIB: "Shiba Inu",
  LTC: "Litecoin",
  NEAR: "NEAR Protocol",
  APT: "Aptos",
  INJ: "Injective",
  RENDER: "Render",
  FET: "Artificial Superintelligence Alliance",
};

export class BinanceSyncService {
  constructor(
    private supabase: SupabaseClient,
    private cacheService?: CacheService
  ) {}

  /**
   * Syncs non-zero Binance spot balances into the user's investments table (type = "crypto").
   */
  async syncHoldings(
    userId: string,
    balances: BinanceBalance[],
    tickers: BinanceTicker24h[]
  ): Promise<BinanceSyncResult> {
    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    if (!balances || balances.length === 0) {
      return {
        syncedHoldingsCount: 0,
        createdCount: 0,
        updatedCount: 0,
        errors: [],
      };
    }

    // Build ticker lookup map for USDT pairs
    const tickerMap = new Map<string, BinanceTicker24h>();
    for (const t of tickers) {
      tickerMap.set(t.symbol, t);
    }

    // Filter out tiny / zero balances
    const activeBalances = balances.filter((b) => {
      const free = parseFloat(b.free || "0");
      const locked = parseFloat(b.locked || "0");
      return free + locked > 0.0000001;
    });

    if (activeBalances.length === 0) {
      return {
        syncedHoldingsCount: 0,
        createdCount: 0,
        updatedCount: 0,
        errors: [],
      };
    }

    // Fetch existing crypto investments for the user
    const { data: existingInvestments } = await this.supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "crypto");

    const existingMap = new Map<string, any>();
    if (existingInvestments) {
      for (const inv of existingInvestments) {
        if (inv.symbol) {
          existingMap.set(inv.symbol.toUpperCase(), inv);
        }
      }
    }

    const now = new Date().toISOString();

    for (const b of activeBalances) {
      try {
        const asset = b.asset ? b.asset.toUpperCase() : "";
        if (!asset) continue;

        const totalQuantity = parseFloat(b.free || "0") + parseFloat(b.locked || "0");
        if (totalQuantity <= 0) continue;

        let currentPrice = 0;
        let dayChange = 0;
        let dayChangePercent = 0;
        let previousClose = 0;

        if (STABLECOINS.has(asset)) {
          currentPrice = 1.0;
          previousClose = 1.0;
          dayChange = 0;
          dayChangePercent = 0;
        } else {
          // Look up asset USDT pair e.g. BTCUSDT
          const usdtPair = `${asset}USDT`;
          const ticker = tickerMap.get(usdtPair);

          if (ticker) {
            currentPrice = parseFloat(ticker.lastPrice || "0");
            dayChange = parseFloat(ticker.priceChange || "0");
            dayChangePercent = parseFloat(ticker.priceChangePercent || "0");
            previousClose = parseFloat(ticker.prevClosePrice || "0") || (currentPrice - dayChange);
          } else {
            // Try BTC pair e.g. ETHBTC * BTCUSDT as fallback
            const btcPair = `${asset}BTC`;
            const btcTicker = tickerMap.get(btcPair);
            const btcusdt = tickerMap.get("BTCUSDT");

            if (btcTicker && btcusdt) {
              const btcPrice = parseFloat(btcusdt.lastPrice || "0");
              currentPrice = parseFloat(btcTicker.lastPrice || "0") * btcPrice;
              dayChange = parseFloat(btcTicker.priceChange || "0") * btcPrice;
              dayChangePercent = parseFloat(btcTicker.priceChangePercent || "0");
              previousClose = currentPrice - dayChange;
            }
          }
        }

        const name = ASSET_NAME_MAP[asset] || asset;
        const existingItem = existingMap.get(asset);

        if (existingItem) {
          // Update existing asset
          const buyPrice = parseFloat(existingItem.buy_price || "0") || currentPrice;

          const { error: updateErr } = await this.supabase
            .from("investments")
            .update({
              quantity: totalQuantity.toString(),
              current_price: currentPrice.toString(),
              buy_price: buyPrice.toString(),
              previous_close: previousClose.toString(),
              day_change: dayChange.toString(),
              day_change_percent: dayChangePercent.toString(),
              last_fetch_at: now,
              updated_at: now,
            })
            .eq("id", existingItem.id);

          if (updateErr) {
            errors.push(`Failed to update ${asset}: ${updateErr.message}`);
          } else {
            updatedCount++;
          }
        } else {
          // Insert new asset
          const { error: insertErr } = await this.supabase
            .from("investments")
            .insert({
              user_id: userId,
              name: name,
              type: "crypto",
              symbol: asset,
              quantity: totalQuantity.toString(),
              buy_price: currentPrice.toString(), // Default buy price to current market price if imported first time
              current_price: currentPrice.toString(),
              previous_close: previousClose.toString(),
              day_change: dayChange.toString(),
              day_change_percent: dayChangePercent.toString(),
              currency: "USD",
              notes: "Imported via Binance REST API",
              last_fetch_at: now,
            });

          if (insertErr) {
            errors.push(`Failed to insert ${asset}: ${insertErr.message}`);
          } else {
            createdCount++;
          }
        }
      } catch (err: any) {
        errors.push(`Error processing ${b.asset}: ${err.message || String(err)}`);
      }
    }

    if (this.cacheService) {
      await this.cacheService.clearUserCache(userId);
    }

    return {
      syncedHoldingsCount: activeBalances.length,
      createdCount,
      updatedCount,
      errors,
    };
  }
}
