import { NextResponse } from "next/server";
import { isZerodhaEnabled, getZerodhaCredentialsForUser } from "@/lib/zerodha/zerodha-config";
import { KiteClient } from "@/lib/zerodha/kite-client";
import { ZerodhaSyncService } from "@/lib/zerodha/zerodha-service";
import { CacheService } from "@/lib/cache-service";
import { createClient } from "@/lib/supabase-server";
import logger from "@/lib/logger";

export async function GET(request: Request) {
  const callbackStart = Date.now();
  const url = new URL(request.url);
  const rawRequestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");

  const baseUrl = url.origin;

  logger.info("Zerodha Callback: Received callback", {
    status,
    has_token: !!rawRequestToken,
    token_length: rawRequestToken?.length ?? 0,
    full_url: `${url.pathname}${url.search}`
  });

  if (!isZerodhaEnabled()) {
    return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=disabled`);
  }

  if (status === "denied" || !rawRequestToken) {
    return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=cancelled`);
  }

  // Trim the request token to remove any whitespace or URL artifacts
  const requestToken = rawRequestToken.trim();

  if (!requestToken) {
    logger.error("Zerodha Callback: Request token is empty after trimming.");
    return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=cancelled`);
  }

  try {
    // Step 1: Get authenticated user
    const authStart = Date.now();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    logger.info("Zerodha Callback: Auth check complete", { duration: Date.now() - authStart });

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?redirectTo=/dashboard/investments`);
    }

    // Step 2: Get credentials
    const credStart = Date.now();
    const { apiKey, apiSecret, source } = await getZerodhaCredentialsForUser(supabase, user.id);
    logger.info("Zerodha Callback: Credential lookup complete", { duration: Date.now() - credStart, source });

    if (!apiKey || !apiSecret) {
      logger.error("Zerodha Callback: No API credentials found", { source, userId: user.id });
      return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=missing_keys`);
    }

    logger.info("Zerodha Callback: Generating session", {
      userId: `${user.id.substring(0, 8)}...`,
      credential_source: source,
      api_key: `${apiKey.substring(0, 4)}****`,
      api_key_len: apiKey.length,
      api_secret_len: apiSecret.length,
      request_token: `${requestToken.substring(0, 8)}****`,
      request_token_len: requestToken.length,
      time_since_callback: Date.now() - callbackStart
    });

    // Step 3: Exchange request token for access token
    const sessionStart = Date.now();
    const client = new KiteClient(apiKey, apiSecret);
    const session = await client.generateSession(requestToken);
    logger.info("Zerodha Callback: Session generated", { duration: Date.now() - sessionStart, zerodhaUserId: session.user_id });

    // Step 4: Fetch holdings
    const holdingsStart = Date.now();
    const holdings = await client.getHoldings(session.access_token);
    logger.info("Zerodha Callback: Fetched holdings", { count: holdings.length, duration: Date.now() - holdingsStart });

    // Step 5: Sync to database
    const syncStart = Date.now();
    const cacheService = new CacheService();
    const syncService = new ZerodhaSyncService(supabase, cacheService);
    const syncResult = await syncService.syncHoldings(user.id, holdings);
    logger.info("Zerodha Callback: Sync complete", {
      duration: Date.now() - syncStart,
      total: syncResult.syncedHoldingsCount,
      stocks: syncResult.stocksSynced,
      mfs: syncResult.mutualFundsSynced,
      created: syncResult.createdCount,
      updated: syncResult.updatedCount,
      errors: syncResult.errors.length > 0 ? syncResult.errors : undefined
    });

    logger.info("Zerodha Callback: Total callback time", { duration: Date.now() - callbackStart });

    return NextResponse.redirect(
      `${baseUrl}/dashboard/investments?zerodha_sync=success&count=${syncResult.syncedHoldingsCount}&stocks=${syncResult.stocksSynced}&mfs=${syncResult.mutualFundsSynced}&created=${syncResult.createdCount}&updated=${syncResult.updatedCount}`
    );
  } catch (err: any) {
    const totalTime = Date.now() - callbackStart;
    logger.error("Zerodha Callback: Error", {
      duration: totalTime,
      message: err?.message,
      error_type: err?.error_type || "N/A",
      stack: err?.stack?.split("\n").slice(0, 3).join("\n  ")
    });

    // Classify the error for a user-friendly redirect message
    const rawMessage = err?.message || "OAuth authentication failed";
    let friendlyMessage: string;

    if (rawMessage.toLowerCase().includes("checksum")) {
      friendlyMessage = "Checksum validation failed. Your API key/secret may be incorrect or the login session expired. Please try again.";
    } else if (rawMessage.toLowerCase().includes("token is invalid or has expired")) {
      // This is the most common error — the request_token expired (they last ~60s)
      friendlyMessage = "Login session expired. Zerodha tokens are valid for only ~60 seconds. Please click Sync again and complete the login quickly.";
    } else if (rawMessage.includes("KITE_TOKEN_EXPIRED")) {
      friendlyMessage = "Access token expired. Please re-authenticate with Zerodha.";
    } else if (rawMessage.toLowerCase().includes("api key") || rawMessage.toLowerCase().includes("api_key")) {
      friendlyMessage = "Invalid API key. Please check your Zerodha credentials in Settings.";
    } else if (rawMessage.toLowerCase().includes("network") || rawMessage.toLowerCase().includes("fetch failed")) {
      friendlyMessage = "Could not reach Zerodha servers. Please check your internet connection.";
    } else {
      friendlyMessage = rawMessage;
    }

    const errorMessage = encodeURIComponent(friendlyMessage);
    return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=${errorMessage}`);
  }
}

