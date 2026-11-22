import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { exchangeRequestToken } from "@/utils/zerodha";
import { encryptSensitiveData, decryptSensitiveData } from "@/utils/crypto";
import { getTrustedOrigin } from "@/utils/oauthSecurity";
import { logger } from "@/utils/logger";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  const baseUrl = getTrustedOrigin(req);

  if (status !== "success" || !requestToken) {
    const errorMsg = url.searchParams.get("message") || "Authentication was denied or failed";
    logger.warn("[Zerodha Callback] Auth failed:", errorMsg);
    return NextResponse.redirect(
      new URL(`/?tab=settings&section=integrations&zerodha_error=${encodeURIComponent(errorMsg)}`, baseUrl)
    );
  }

  try {
    const { user, userId } = await getAuthenticatedUser(req);

    if (!user || !userId) {
      // Never leak request_token in URL query parameters to avoid server access log & browser history exposure
      return NextResponse.redirect(
        new URL(
          `/?tab=settings&section=integrations&zerodha_error=${encodeURIComponent(
            "Session expired during Kite authentication. Please log in to ArthaX and reconnect."
          )}`,
          baseUrl
        )
      );
    }

    // Lookup user's saved api_key and api_secret
    const { data: record, error: dbErr } = await supabaseAdmin
      .from("zerodha_integrations")
      .select("api_key, api_secret")
      .eq("user_id", userId)
      .maybeSingle();

    if (dbErr || !record || !record.api_key || !record.api_secret) {
      return NextResponse.redirect(
        new URL(
          `/?tab=settings&section=integrations&zerodha_error=${encodeURIComponent(
            "API Key and Secret not found. Please save them first."
          )}`,
          baseUrl
        )
      );
    }

    // Decrypt api_secret if stored encrypted
    const apiSecret = decryptSensitiveData(record.api_secret, "broker-credentials") || record.api_secret;

    // Exchange request_token for access_token
    const exchange = await exchangeRequestToken(record.api_key, apiSecret, requestToken);

    if (!exchange.success || !exchange.accessToken) {
      return NextResponse.redirect(
        new URL(
          `/?tab=settings&section=integrations&zerodha_error=${encodeURIComponent(
            exchange.error || "Failed to exchange token with Zerodha"
          )}`,
          baseUrl
        )
      );
    }

    // Save access_token in database with AES-256-GCM authenticated encryption
    await supabaseAdmin
      .from("zerodha_integrations")
      .update({
        access_token: encryptSensitiveData(exchange.accessToken, "broker-credentials"),
        public_token: encryptSensitiveData(exchange.publicToken || null, "broker-credentials"),
        request_token: encryptSensitiveData(requestToken, "broker-credentials"),
        token_generated_at: new Date().toISOString(),
        user_profile: exchange.profile || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return NextResponse.redirect(
      new URL("/?tab=settings&section=integrations&zerodha_connected=true", baseUrl)
    );
  } catch (err: unknown) {
    logger.error("[Zerodha Callback] Unhandled error:", "ZerodhaCallback", err);
    const msg = err instanceof Error ? err.message : "Unexpected error occurred during Zerodha callback";
    return NextResponse.redirect(
      new URL(
        `/?tab=settings&section=integrations&zerodha_error=${encodeURIComponent(msg)}`,
        baseUrl
      )
    );
  }
}
