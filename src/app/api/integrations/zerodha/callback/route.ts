import { NextResponse } from "next/server";
import { isZerodhaEnabled, getZerodhaCredentialsForUser } from "@/lib/zerodha/zerodha-config";
import { KiteClient } from "@/lib/zerodha/kite-client";
import { ZerodhaSyncService } from "@/lib/zerodha/zerodha-service";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");

  const baseUrl = url.origin;

  if (!isZerodhaEnabled()) {
    return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=disabled`);
  }

  if (status === "denied" || !requestToken) {
    return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=cancelled`);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?redirectTo=/dashboard/investments`);
    }

    const { apiKey, apiSecret } = await getZerodhaCredentialsForUser(supabase, user.id);
    if (!apiKey || !apiSecret) {
      return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=missing_keys`);
    }

    const client = new KiteClient(apiKey, apiSecret);
    const session = await client.generateSession(requestToken);

    // Fetch holdings using user's access token
    const holdings = await client.getHoldings(session.access_token);

    // Sync holdings into Supabase database
    const syncService = new ZerodhaSyncService(supabase);
    const syncResult = await syncService.syncHoldings(user.id, holdings);

    return NextResponse.redirect(
      `${baseUrl}/dashboard/investments?zerodha_sync=success&count=${syncResult.syncedHoldingsCount}&stocks=${syncResult.stocksSynced}&mfs=${syncResult.mutualFundsSynced}&created=${syncResult.createdCount}&updated=${syncResult.updatedCount}`
    );
  } catch (err: any) {
    console.error("Zerodha OAuth Callback Error:", err);
    const errorMessage = encodeURIComponent(err.message || "OAuth authentication failed");
    return NextResponse.redirect(`${baseUrl}/dashboard/investments?zerodha_error=${errorMessage}`);
  }
}
