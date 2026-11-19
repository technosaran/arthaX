import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import {
  CalculatedCryptoTrade,
  calculateTradeStats,
  getExitedAssets,
  extractBaseAndQuote,
} from "@/utils/binance";

export async function GET(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const { searchParams } = new URL(req.url);
    const sideFilter = searchParams.get("side")?.toUpperCase(); // "BUY" or "SELL"
    const symbolFilter = searchParams.get("symbol")?.toUpperCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

    // Fetch all user trades for stats and exited assets calculation
    const { data: rawTrades, error: tradesErr } = await supabaseAdmin
      .from("crypto_trades")
      .select("*")
      .eq("user_id", userId)
      .order("executed_at", { ascending: false })
      .limit(limit);

    if (tradesErr) {
      return apiError(`Failed to fetch crypto trades: ${tradesErr.message}`, "DATABASE_ERROR", 500, undefined, req);
    }

    // Fetch user's current active crypto holdings
    const { data: holdingsData } = await supabaseAdmin
      .from("crypto_holdings")
      .select("asset")
      .eq("user_id", userId);

    const activeAssetsSet = new Set<string>((holdingsData || []).map((h) => h.asset.toUpperCase()));

    // Map DB records into CalculatedCryptoTrade models
    const allTrades: CalculatedCryptoTrade[] = (rawTrades || []).map((r) => {
      const { baseAsset, quoteAsset } = extractBaseAndQuote(r.symbol);
      return {
        tradeId: Number(r.trade_id),
        orderId: Number(r.order_id),
        symbol: r.symbol,
        baseAsset,
        quoteAsset,
        side: r.side as "BUY" | "SELL",
        price: Number(r.price),
        qty: Number(r.qty),
        quoteQty: Number(r.quote_qty),
        commission: Number(r.commission),
        commissionAsset: r.commission_asset,
        isBuyer: Boolean(r.is_buyer),
        isMaker: Boolean(r.is_maker),
        executedAt: r.executed_at,
      };
    });

    // Compute portfolio trade stats & completely exited assets
    const stats = calculateTradeStats(allTrades);
    const exitedAssets = getExitedAssets(allTrades, activeAssetsSet);

    // Filter trades if requested
    let filteredTrades = allTrades;
    if (sideFilter === "BUY" || sideFilter === "SELL") {
      filteredTrades = filteredTrades.filter((t) => t.side === sideFilter);
    }
    if (symbolFilter) {
      filteredTrades = filteredTrades.filter(
        (t) =>
          t.symbol.toUpperCase().includes(symbolFilter) ||
          t.baseAsset.toUpperCase().includes(symbolFilter)
      );
    }

    return apiSuccess(
      {
        trades: filteredTrades,
        totalCount: allTrades.length,
        stats,
        exitedAssets,
      },
      undefined,
      req
    );
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Error fetching crypto trades",
      "SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
