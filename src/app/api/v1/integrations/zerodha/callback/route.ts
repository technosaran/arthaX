import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { exchangeRequestToken } from "@/utils/zerodha";
import { logger } from "@/utils/logger";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");
  const baseUrl = url.origin;

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
      // If auth cookie was lost during external redirect, redirect back with token in URL param
      // so the client-side settings page can complete the exchange with its existing auth session
      return NextResponse.redirect(
        new URL(
          `/?tab=settings&section=integrations&request_token=${encodeURIComponent(requestToken)}`,
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

    // Exchange request_token for access_token
    const exchange = await exchangeRequestToken(record.api_key, record.api_secret, requestToken);

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

    // Save access_token in database
    await supabaseAdmin
      .from("zerodha_integrations")
      .update({
        access_token: exchange.accessToken,
        public_token: exchange.publicToken || null,
        request_token: requestToken,
        token_generated_at: new Date().toISOString(),
        user_profile: exchange.profile || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return NextResponse.redirect(
      new URL("/?tab=settings&section=integrations&zerodha_connected=true", baseUrl)
    );
  } catch (err: any) {
    logger.error("[Zerodha Callback] Unhandled error:", err);
    return NextResponse.redirect(
      new URL(
        `/?tab=settings&section=integrations&zerodha_error=${encodeURIComponent(
          err.message || "Unexpected error occurred during Zerodha callback"
        )}`,
        baseUrl
      )
    );
  }
}
