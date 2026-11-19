import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import {
  fetchBinance24hrTickers,
  calculateCryptoValuations,
  getDemoMarketTickers,
  getDemoSpotAccount,
  parseBinanceBalances,
} from "@/utils/binance";

export async function GET(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`crypto:holdings:${userId}`, 120, 60);
  if (!rl.success) {
    return apiError("Too many requests. Please slow down.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const { searchParams } = new URL(req.url);
    const useDemo = searchParams.get("demo") === "true";

    // 1. Fetch Integration status & stored holdings concurrently
    const [intRes, holdingsRes] = await Promise.all([
      supabaseAdmin
        .from("binance_integrations")
        .select("is_active, last_synced_at, sync_error")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("crypto_holdings")
        .select("asset, name, free_amount, locked_amount, total_quantity, current_price_usd, total_value_usd, change_24h, last_synced_at")
        .eq("user_id", userId)
        .order("total_value_usd", { ascending: false }),
    ]);

    const isConnected = Boolean(intRes.data?.is_active);
    const lastSyncedAt = intRes.data?.last_synced_at || null;
    const syncError = intRes.data?.sync_error || null;
    const rawHoldings = holdingsRes.data || [];

    // Tickers with fallback
    const tickersRes = await fetchBinance24hrTickers();
    const tickers =
      tickersRes.success && tickersRes.data && Object.keys(tickersRes.data).length > 0
        ? tickersRes.data
        : getDemoMarketTickers();

    if (useDemo || (rawHoldings.length === 0 && searchParams.get("showcase") === "true")) {
      const demoAccount = getDemoSpotAccount();
      const demoBalances = parseBinanceBalances(demoAccount.balances);
      const demoPortfolio = calculateCryptoValuations(demoBalances, tickers);

      return apiSuccess(
        {
          isBinanceConnected: isConnected,
          lastSyncedAt: lastSyncedAt || new Date().toISOString(),
          syncError,
          isDemo: true,
          accountType: demoAccount.accountType,
          permissions: demoAccount.permissions,
          commissions: {
            maker: demoAccount.makerCommission / 100, // 0.10%
            taker: demoAccount.takerCommission / 100,
            buyer: demoAccount.buyerCommission,
            seller: demoAccount.sellerCommission,
          },
          canTrade: demoAccount.canTrade,
          canWithdraw: demoAccount.canWithdraw,
          canDeposit: demoAccount.canDeposit,
          ...demoPortfolio,
        },
        undefined,
        req
      );
    }

    if (rawHoldings.length === 0) {
      return apiSuccess(
        {
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
        },
        undefined,
        req
      );
    }

    const balances = rawHoldings.map((h) => ({
      asset: h.asset,
      free: Number(h.free_amount) || 0,
      locked: Number(h.locked_amount) || 0,
      total: Number(h.total_quantity) || 0,
    }));

    const portfolio = calculateCryptoValuations(balances, tickers);

    return apiSuccess(
      {
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
      },
      undefined,
      req
    );
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Internal error fetching crypto holdings",
      "SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
