import { NextResponse } from "next/server";
import { isBinanceEnabled, getBinanceCredentialsForUser } from "@/lib/binance/binance-config";
import { BinanceClient } from "@/lib/binance/binance-client";
import { BinanceSyncService } from "@/lib/binance/binance-service";
import { CacheService } from "@/lib/cache-service";
import { createClient } from "@/lib/supabase-server";
import logger from "@/lib/logger";

export async function POST() {
  const syncStart = Date.now();

  if (!isBinanceEnabled()) {
    return NextResponse.json({ error: "Binance integration is currently disabled." }, { status: 404 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const { apiKey, apiSecret, source } = await getBinanceCredentialsForUser(supabase, user.id);

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error:
            "Binance API credentials not configured. Please add custom keys in Settings → Integrations.",
          source,
        },
        { status: 400 }
      );
    }

    logger.info("Binance Sync: Initiating sync", {
      userId: `${user.id.substring(0, 8)}...`,
      credential_source: source,
    });

    const client = new BinanceClient(apiKey, apiSecret);

    // Fetch account info and 24hr tickers concurrently
    const [accountInfo, tickers] = await Promise.all([
      client.getAccountInfo(),
      client.get24hrTickers(),
    ]);

    const cacheService = new CacheService();
    const syncService = new BinanceSyncService(supabase, cacheService);
    const result = await syncService.syncHoldings(user.id, accountInfo.balances, tickers);

    logger.info("Binance Sync: Sync complete", {
      duration: Date.now() - syncStart,
      synced: result.syncedHoldingsCount,
      created: result.createdCount,
      updated: result.updatedCount,
      errors: result.errors,
    });

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: Date.now() - syncStart,
    });
  } catch (err: any) {
    logger.error("Binance Sync Error", {
      duration: Date.now() - syncStart,
      message: err?.message || String(err),
    });

    return NextResponse.json(
      { error: err?.message || "Failed to sync Binance holdings." },
      { status: 500 }
    );
  }
}
