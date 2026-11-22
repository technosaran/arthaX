import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import {
  fetchBinanceSpotAccount,
  fetchBinance24hrTickers,
  fetchBinanceMyTrades,
  parseBinanceBalances,
  calculateCryptoValuations,
  parseBinanceRawTrades,
} from "@/utils/binance";
import { decryptSensitiveData } from "@/utils/crypto";

export async function POST(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit: 30 syncs per minute
  const rl = await rateLimit(`crypto:binance:sync:${userId}`, 30, 60);
  if (!rl.success) {
    return apiError("Too many sync requests. Please wait a moment.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    // 1. Fetch user's Binance credentials
    const { data: integration, error: intError } = await supabaseAdmin
      .from("binance_integrations")
      .select("api_key, api_secret, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (intError) {
      return apiError(`Database error: ${intError.message}`, "DATABASE_ERROR", 500, undefined, req);
    }

    if (!integration || !integration.is_active) {
      return apiError(
        "Binance integration is not active or credentials not found. Please connect Binance first.",
        "NOT_CONNECTED",
        400,
        undefined,
        req
      );
    }

    const decryptedSecret = decryptSensitiveData(integration.api_secret, "binance-credentials");
    if (!decryptedSecret) {
      return apiError("Failed to decrypt API Secret.", "DECRYPTION_ERROR", 500, undefined, req);
    }

    // 2. Concurrently fetch Binance Spot Balances and 24h Ticker Prices
    const [accountRes, tickersRes] = await Promise.all([
      fetchBinanceSpotAccount(integration.api_key, decryptedSecret),
      fetchBinance24hrTickers(),
    ]);

    if (!accountRes.success || !accountRes.data) {
      // Record error on integration
      await supabaseAdmin
        .from("binance_integrations")
        .update({ sync_error: accountRes.error || "Authentication failure", updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return apiError(
        accountRes.error || "Failed to fetch balances from Binance.",
        "BINANCE_API_ERROR",
        502,
        undefined,
        req
      );
    }

    const tickers = tickersRes.success && tickersRes.data ? tickersRes.data : {};
    const parsedBalances = parseBinanceBalances(accountRes.data.balances);
    const portfolio = calculateCryptoValuations(parsedBalances, tickers);

    // 3. Persist synced holdings to Supabase
    const nowIso = new Date().toISOString();
    const currentAssetsList = portfolio.assets.map((a) => a.asset);

    // Remove zeroed-out holdings that no longer exist in wallet
    if (currentAssetsList.length > 0) {
      await supabaseAdmin
        .from("crypto_holdings")
        .delete()
        .eq("user_id", userId)
        .not("asset", "in", `(${currentAssetsList.map((a) => `"${a}"`).join(",")})`);
    } else {
      await supabaseAdmin.from("crypto_holdings").delete().eq("user_id", userId);
    }

    // Upsert active holdings
    if (portfolio.assets.length > 0) {
      const recordsToUpsert = portfolio.assets.map((item) => ({
        user_id: userId,
        asset: item.asset,
        name: item.name,
        free_amount: item.free,
        locked_amount: item.locked,
        total_quantity: item.totalQuantity,
        current_price_usd: item.currentPriceUsd,
        total_value_usd: item.totalValueUsd,
        change_24h: item.change24h,
        last_synced_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: upsertErr } = await supabaseAdmin
        .from("crypto_holdings")
        .upsert(recordsToUpsert, { onConflict: "user_id,asset" });

      if (upsertErr) {
        console.warn("[Crypto Sync] Upsert holdings error:", upsertErr);
      }
    }

    // 4. Synchronize Executed Trades (Buys, Sells, and Realized Proceeds)
    try {
      const symbolsToSync = new Set<string>();
      const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "DAI", "FDUSD", "TUSD"]);

      for (const a of currentAssetsList) {
        if (!STABLECOINS.has(a.toUpperCase())) {
          symbolsToSync.add(`${a.toUpperCase()}USDT`);
        }
      }

      // Also include previously traded symbols
      const { data: pastTrades } = await supabaseAdmin
        .from("crypto_trades")
        .select("symbol")
        .eq("user_id", userId)
        .limit(20);

      if (pastTrades) {
        for (const pt of pastTrades) {
          if (pt.symbol) symbolsToSync.add(pt.symbol.toUpperCase());
        }
      }

      // Limit concurrent trade fetches to 12 symbols to respect rate limits
      const symbolList = Array.from(symbolsToSync).slice(0, 12);

      const tradeResults = await Promise.allSettled(
        symbolList.map((sym) =>
          fetchBinanceMyTrades(integration.api_key, decryptedSecret, sym, 50)
        )
      );

      const allTradesToUpsert = [];
      for (const res of tradeResults) {
        if (res.status === "fulfilled" && res.value.success && res.value.data) {
          const parsed = parseBinanceRawTrades(res.value.data);
          for (const t of parsed) {
            allTradesToUpsert.push({
              user_id: userId,
              trade_id: t.tradeId,
              order_id: t.orderId,
              symbol: t.symbol,
              side: t.side,
              price: t.price,
              qty: t.qty,
              quote_qty: t.quoteQty,
              commission: t.commission,
              commission_asset: t.commissionAsset,
              is_buyer: t.isBuyer,
              is_maker: t.isMaker,
              executed_at: t.executedAt,
            });
          }
        }
      }

      if (allTradesToUpsert.length > 0) {
        await supabaseAdmin
          .from("crypto_trades")
          .upsert(allTradesToUpsert, { onConflict: "user_id,trade_id" });
      }
    } catch (tradeErr) {
      console.warn("[Crypto Sync] Trade sync non-fatal error:", tradeErr);
    }

    // 5. Update integration metadata
    await supabaseAdmin
      .from("binance_integrations")
      .update({
        last_synced_at: nowIso,
        sync_error: null,
        updated_at: nowIso,
      })
      .eq("user_id", userId);

    return apiSuccess(
      {
        ...portfolio,
        lastSyncedAt: nowIso,
      },
      undefined,
      req
    );
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Internal error syncing Binance portfolio",
      "SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
