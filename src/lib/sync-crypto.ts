/**
 * CoinGecko Crypto Price Sync Service
 * Uses 100% free CoinGecko API (https://api.coingecko.com/api/v3/simple/price)
 * No API key required for standard tier endpoint.
 */

import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const CRYPTO_ID_MAP: Record<string, string> = {
  btc: "bitcoin",
  bitcoin: "bitcoin",
  eth: "ethereum",
  ethereum: "ethereum",
  sol: "solana",
  solana: "solana",
  usdt: "tether",
  tether: "tether",
  usdc: "usd-coin",
  bnb: "binancecoin",
  xrp: "ripple",
  ada: "cardano",
  doge: "dogecoin",
  matic: "matic-network",
  polygon: "matic-network",
  dot: "polkadot",
  link: "chainlink",
  avax: "avalanche-2",
};

/**
 * Fetch live price for a crypto coin symbol from CoinGecko free API
 */
export async function fetchLiveCryptoPrice(symbol: string, vsCurrency = "inr"): Promise<number | null> {
  if (!symbol) return null;
  const cleanSymbol = symbol.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const coinId = CRYPTO_ID_MAP[cleanSymbol] || cleanSymbol;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data[coinId] && data[coinId][vsCurrency]) {
      const price = parseFloat(data[coinId][vsCurrency]);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
    return null;
  } catch (err) {
    logger.error(`[CoinGecko Crypto Sync Error] Failed for ${symbol}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Sync prices for all active crypto holdings in the user's portfolio
 */
export async function syncAllCryptoPrices(): Promise<{ updatedCount: number; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { updatedCount: 0, error: "Supabase credentials missing" };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: cryptoList, error } = await supabase
      .from("investments")
      .select("id, symbol, name, current_price, currency")
      .eq("type", "crypto");

    if (error || !cryptoList || cryptoList.length === 0) {
      return { updatedCount: 0 };
    }

    let updatedCount = 0;

    for (const item of cryptoList) {
      const symbol = item.symbol || item.name;
      if (!symbol) continue;

      const vsCurrency = item.currency?.toLowerCase() === "usd" ? "usd" : "inr";
      const livePrice = await fetchLiveCryptoPrice(symbol, vsCurrency);

      if (livePrice && livePrice > 0 && livePrice !== item.current_price) {
        await supabase
          .from("investments")
          .update({
            current_price: livePrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        updatedCount++;
      }
    }

    return { updatedCount };
  } catch (err: any) {
    logger.error("[Crypto Sync All Error]:", err);
    return { updatedCount: 0, error: err.message };
  }
}
