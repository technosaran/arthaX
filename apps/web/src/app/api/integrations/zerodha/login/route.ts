import { NextResponse } from "next/server";
import { isZerodhaEnabled, getZerodhaCredentialsForUser } from "@/lib/zerodha/zerodha-config";
import { KiteClient } from "@/lib/zerodha/kite-client";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  if (!isZerodhaEnabled()) {
    return NextResponse.json({ error: "Zerodha integration is currently disabled." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }

  const { apiKey, apiSecret, source } = await getZerodhaCredentialsForUser(supabase, user.id);

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Zerodha API credentials not configured. Please add global keys in Vercel or configure custom keys in Settings.",
        source,
      },
      { status: 400 }
    );
  }

  const client = new KiteClient(apiKey, apiSecret);
  const loginUrl = client.getLoginUrl();

  return NextResponse.redirect(loginUrl);
}
