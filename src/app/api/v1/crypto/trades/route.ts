import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import {
  CalculatedCryptoTrade,
  calculateTradeStats,
  getExitedAssets,
  getDemoTradeHistory,
} from "@/utils/binance";

export async function GET(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`crypto:trades:${userId}`, 120, 60);
  if (!rl.success) {
    return apiError("Too many requests. Please slow down.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const { searchParams } = new URL(req.url);
    const useDemo = searchParams.get("demo") === "true";

    // 1. Fetch trades from public.crypto_trades
    const { data: rawTrades, error: dbErr } = await supabaseAdmin
      .from("crypto_trades")
      .select("*")
      .eq("user_id", userId)
      .order("executed_at", { ascending: false });

    if (dbErr) {
      console.warn("[Crypto Trades] DB fetch error:", dbErr.message);
    }

    // 2. Fetch current holdings to determine active vs exited positions
    const { data: holdings } = await supabaseAdmin
      .from("crypto_holdings")
      .select("asset")
      .eq("user_id", userId);

    const activeSet = new Set((holdings || []).map((h) => h.asset));

    let trades: CalculatedCryptoTrade[] = [];

    if (!useDemo && rawTrades && rawTrades.length > 0) {
      trades = rawTrades.map((t) => {
        const symbol = t.symbol || "";
        const baseAsset = symbol.replace(/(USDT|USDC|FDUSD|BUSD|BTC|ETH|BNB)$/, "") || symbol;
        const quoteAsset = symbol.slice(baseAsset.length) || "USDT";

        return {
          tradeId: Number(t.trade_id),
          orderId: Number(t.order_id),
          symbol: t.symbol,
          baseAsset,
          quoteAsset,
          side: t.side as "BUY" | "SELL",
          price: Number(t.price) || 0,
          qty: Number(t.qty) || 0,
          quoteQty: Number(t.quote_qty) || 0,
          commission: Number(t.commission) || 0,
          commissionAsset: t.commission_asset || "USDT",
          isBuyer: Boolean(t.is_buyer),
          isMaker: Boolean(t.is_maker),
          executedAt: t.executed_at,
        };
      });
    } else {
      // Demo showcase trades for instant preview
      trades = getDemoTradeHistory();
      if (activeSet.size === 0) {
        activeSet.add("BTC");
        activeSet.add("ETH");
        activeSet.add("SOL");
      }
    }

    const stats = calculateTradeStats(trades);
    const exitedAssets = getExitedAssets(trades, activeSet);

    return apiSuccess(
      {
        trades,
        stats,
        exitedAssets,
        isDemo: !rawTrades || rawTrades.length === 0 || useDemo,
      },
      undefined,
      req
    );
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Internal error fetching crypto trade history",
      "SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
