import { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";

/**
 * Zerodha Integration Configuration
 * Completely isolated hybrid config helper.
 */

export function isZerodhaEnabled(): boolean {
  const envFlag = process.env.NEXT_PUBLIC_ENABLE_ZERODHA;
  if (envFlag !== undefined) {
    return envFlag === "true" || envFlag === "1";
  }
  return true;
}

export interface ZerodhaCredentialsResult {
  apiKey: string;
  apiSecret: string;
  source: "user" | "global" | "none";
}

function cleanKey(val?: string): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

/**
 * Retrieves Zerodha credentials using the Hybrid Approach:
 * 1. Check if user saved custom API keys in their profile settings.
 * 2. If not, fallback to global Vercel environment variables.
 */
export async function getZerodhaCredentialsForUser(
  supabase?: SupabaseClient | null,
  userId?: string | null
): Promise<ZerodhaCredentialsResult> {
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
      if (defaultAccounts && defaultAccounts.zerodha) {
        userApiKey = cleanKey(defaultAccounts.zerodha.apiKey);
        userApiSecret = cleanKey(decryptSecret(defaultAccounts.zerodha.apiSecret));
      }
    } catch {
      // Ignore lookup errors and fallback to global keys
    }
  }

  if (userApiKey && userApiSecret) {
    return {
      apiKey: userApiKey,
      apiSecret: userApiSecret,
      source: "user",
    };
  }

  const globalApiKey = cleanKey(process.env.ZERODHA_API_KEY || process.env.KITE_API_KEY);
  const globalApiSecret = cleanKey(process.env.ZERODHA_API_SECRET || process.env.KITE_API_SECRET);

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

export function getZerodhaGlobalCredentials() {
  const apiKey = cleanKey(process.env.ZERODHA_API_KEY || process.env.KITE_API_KEY);
  const apiSecret = cleanKey(process.env.ZERODHA_API_SECRET || process.env.KITE_API_SECRET);
  return { apiKey, apiSecret };
}

