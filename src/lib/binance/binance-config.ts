import { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";

export function isBinanceEnabled(): boolean {
  const envFlag = process.env.NEXT_PUBLIC_ENABLE_BINANCE;
  if (envFlag !== undefined) {
    return envFlag === "true" || envFlag === "1";
  }
  return true;
}

export interface BinanceCredentialsResult {
  apiKey: string;
  apiSecret: string;
  source: "user" | "global" | "none";
}

function cleanKey(val?: string): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

/**
 * Retrieves Binance credentials using a hybrid approach:
 * 1. Check user custom saved keys in profiles default_accounts.binance.
 * 2. Fallback to global Vercel/System environment variables.
 */
export async function getBinanceCredentialsForUser(
  supabase?: SupabaseClient | null,
  userId?: string | null
): Promise<BinanceCredentialsResult> {
  let userApiKey = "";
  let userApiSecret = "";

  if (supabase && userId) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_accounts")
        .eq("id", userId)
        .single();

      const defaultAccounts = profile?.default_accounts as Record<string, any> | null;
      if (defaultAccounts && defaultAccounts.binance) {
        userApiKey = cleanKey(defaultAccounts.binance.apiKey);
        userApiSecret = cleanKey(decryptSecret(defaultAccounts.binance.apiSecret));
      }
    } catch {
      // Fallback to global if error occurs
    }
  }

  if (userApiKey && userApiSecret) {
    return {
      apiKey: userApiKey,
      apiSecret: userApiSecret,
      source: "user",
    };
  }

  const globalApiKey = cleanKey(process.env.BINANCE_API_KEY);
  const globalApiSecret = cleanKey(process.env.BINANCE_API_SECRET);

  if (globalApiKey && globalApiSecret) {
    return {
      apiKey: globalApiKey,
      apiSecret: globalApiSecret,
      source: "global",
    };
  }

  return {
    apiKey: "",
    apiSecret: "",
    source: "none",
  };
}

export function getBinanceGlobalCredentials() {
  const apiKey = cleanKey(process.env.BINANCE_API_KEY);
  const apiSecret = cleanKey(process.env.BINANCE_API_SECRET);
  return { apiKey, apiSecret };
}
