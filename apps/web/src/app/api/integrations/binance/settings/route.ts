import { NextResponse } from "next/server";
import { isBinanceEnabled, getBinanceGlobalCredentials } from "@/lib/binance/binance-config";
import { createClient } from "@/lib/supabase-server";
import { encryptSecret } from "@/lib/crypto";

export async function GET() {
  if (!isBinanceEnabled()) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey: globalApiKey } = getBinanceGlobalCredentials();
  const isGlobalConfigured = Boolean(globalApiKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_accounts")
    .eq("id", user.id)
    .single();

  const defaultAccounts = (profile?.default_accounts as Record<string, any>) || {};
  const userBinance = defaultAccounts.binance || {};

  const hasCustomKeys = Boolean(userBinance.apiKey && userBinance.apiSecret);

  return NextResponse.json({
    enabled: true,
    hasCustomKeys,
    userApiKey: userBinance.apiKey || "",
    isGlobalConfigured,
    activeSource: hasCustomKeys ? "user" : isGlobalConfigured ? "global" : "none",
  });
}

export async function POST(request: Request) {
  if (!isBinanceEnabled()) {
    return NextResponse.json({ error: "Integration disabled" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { apiKey, apiSecret, action } = body;

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_accounts")
    .eq("id", user.id)
    .single();

  const defaultAccounts = (profile?.default_accounts as Record<string, any>) || {};

  if (action === "clear") {
    delete defaultAccounts.binance;
  } else {
    const cleanApiKey = (apiKey || "").toString().trim().replace(/^["']|["']$/g, "");
    const cleanApiSecret = (apiSecret || "").toString().trim().replace(/^["']|["']$/g, "");

    if (!cleanApiKey || !cleanApiSecret) {
      return NextResponse.json(
        { error: "Both Binance API Key and API Secret are required." },
        { status: 400 }
      );
    }

    if (cleanApiKey.length < 16 || cleanApiSecret.length < 16) {
      return NextResponse.json(
        { error: "Invalid Binance API Key or Secret format. Please double check your credentials." },
        { status: 400 }
      );
    }

    defaultAccounts.binance = {
      apiKey: cleanApiKey,
      apiSecret: encryptSecret(cleanApiSecret),
      updatedAt: new Date().toISOString(),
    };
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      default_accounts: defaultAccounts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: action === "clear" ? "Custom Binance API keys cleared." : "Custom Binance API keys saved successfully!",
  });
}
