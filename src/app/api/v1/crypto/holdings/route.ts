import { supabaseAdmin } from "@/utils/supabase/admin";
import { createApiRoute } from "@/lib/backend/routeHandler";
import {
  fetchBinance24hrTickers,
  calculateCryptoValuations,
  BinanceTicker,
} from "@/utils/binance";

export const GET = createApiRoute({
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ userId }) => {
    // 1. Fetch Integration status & stored holdings concurrently
    const [intRes, holdingsRes] = await Promise.all([
      supabaseAdmin
        .from("binance_integrations")
        .select("is_active, last_synced_at, sync_error")
        .eq("user_id", userId!)
        .maybeSingle(),
      supabaseAdmin
        .from("crypto_holdings")
        .select("asset, name, free_amount, locked_amount, total_quantity, current_price_usd, total_value_usd, change_24h, last_synced_at")
        .eq("user_id", userId!)
        .order("total_value_usd", { ascending: false }),
    ]);

    const isConnected = Boolean(intRes.data?.is_active);
    const lastSyncedAt = intRes.data?.last_synced_at || null;
    const syncError = intRes.data?.sync_error || null;
    const rawHoldings = holdingsRes.data || [];

    // Tickers from live Binance API
    const tickersRes = await fetchBinance24hrTickers();
    const tickers: Record<string, BinanceTicker> =
      tickersRes.success && tickersRes.data && Object.keys(tickersRes.data).length > 0
        ? tickersRes.data
        : {};

    if (rawHoldings.length === 0) {
      return {
        isBinanceConnected: isConnected,
        lastSyncedAt,
        syncError,
        isDemo: false,
        totalPortfolioUsd: 0,
        netChange24hUsd: 0,
        netChange24hPercent: 0,
        assetsCount: 0,
        assets: [],
        accountType: "SPOT",
        permissions: ["SPOT"],
        commissions: { maker: 0.1, taker: 0.1, buyer: 0, seller: 0 },
        canTrade: isConnected,
        canWithdraw: isConnected,
        canDeposit: isConnected,
      };
    }

    const balances = rawHoldings.map((h) => ({
      asset: h.asset,
      free: Number(h.free_amount) || 0,
      locked: Number(h.locked_amount) || 0,
      total: Number(h.total_quantity) || 0,
    }));

    const portfolio = calculateCryptoValuations(balances, tickers);

    return {
      isBinanceConnected: isConnected,
      lastSyncedAt,
      syncError,
      isDemo: false,
      accountType: "SPOT",
      permissions: ["SPOT", "LEVERAGED"],
      commissions: { maker: 0.1, taker: 0.1, buyer: 0, seller: 0 },
      canTrade: isConnected,
      canWithdraw: isConnected,
      canDeposit: isConnected,
      ...portfolio,
    };
  },
});
