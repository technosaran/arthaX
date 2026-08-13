import { NextResponse } from "next/server";
import { isZerodhaEnabled, getZerodhaGlobalCredentials } from "@/lib/zerodha/zerodha-config";
import { createClient } from "@/lib/supabase-server";
import { encryptSecret } from "@/lib/crypto";

export async function GET() {
  if (!isZerodhaEnabled()) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey: globalApiKey } = getZerodhaGlobalCredentials();
  const isGlobalConfigured = Boolean(globalApiKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_accounts")
    .eq("id", user.id)
    .single();

  const defaultAccounts = (profile?.default_accounts as Record<string, any>) || {};
  const userZerodha = defaultAccounts.zerodha || {};

  const hasCustomKeys = Boolean(userZerodha.apiKey && userZerodha.apiSecret);

  return NextResponse.json({
    enabled: true,
    hasCustomKeys,
    userApiKey: userZerodha.apiKey || "",
    isGlobalConfigured,
    activeSource: hasCustomKeys ? "user" : isGlobalConfigured ? "global" : "none",
  });
}

export async function POST(request: Request) {
  if (!isZerodhaEnabled()) {
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
    delete defaultAccounts.zerodha;
  } else {
    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Both API Key and API Secret are required." },
        { status: 400 }
      );
    }
    defaultAccounts.zerodha = {
      apiKey: apiKey.trim(),
      apiSecret: encryptSecret(apiSecret.trim()),
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
    message: action === "clear" ? "Custom Zerodha API keys cleared." : "Custom Zerodha API keys saved successfully!",
  });
}
