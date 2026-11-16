import crypto from "crypto";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { getAutoLoginCredentials, performZerodhaAutoLogin } from "@/utils/zerodhaAutoLogin";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { encryptSensitiveData, decryptSensitiveData } from "@/utils/crypto";

export interface ZerodhaProfile {
  client_id: string;
  user_name: string;
  user_type?: string;
  email?: string;
  broker?: string;
  exchanges?: string[];
  products?: string[];
  order_types?: string[];
}

export interface ZerodhaIntegrationRecord {
  id: string;
  user_id: string;
  api_key: string;
  api_secret: string;
  access_token: string | null;
  public_token: string | null;
  request_token: string | null;
  token_generated_at: string | null;
  user_profile: ZerodhaProfile | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_summary: {
    stocks_synced: number;
    fno_synced: number;
    mf_synced: number;
    wallet_balance?: number;
  } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Checks if a token was generated today after 6:00 AM IST (when Zerodha daily sessions reset).
 */
export function isTokenValidToday(tokenGeneratedAt: string | null): boolean {
  if (!tokenGeneratedAt) return false;

  const tokenDate = new Date(tokenGeneratedAt);
  const now = new Date();

  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const tokenIst = new Date(tokenDate.getTime() + istOffset);
  const nowIst = new Date(now.getTime() + istOffset);

  // Check if same day
  const isSameDay =
    tokenIst.getUTCFullYear() === nowIst.getUTCFullYear() &&
    tokenIst.getUTCMonth() === nowIst.getUTCMonth() &&
    tokenIst.getUTCDate() === nowIst.getUTCDate();

  // Zerodha session reset time is 6:00 AM IST
  if (isSameDay) {
    // If token generated today, check if now passed 6 AM but token was before 6 AM
    if (nowIst.getUTCHours() >= 6 && tokenIst.getUTCHours() < 6) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Fetch integration status for a given user.
 */
export async function getZerodhaIntegration(userId: string): Promise<{
  configured: boolean;
  connected: boolean;
  integration: ZerodhaIntegrationRecord | null;
  isTokenExpired: boolean;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("zerodha_integrations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let record = data;
    const envApiKey = process.env.ZERODHA_API_KEY;
    const envApiSecret = process.env.ZERODHA_API_SECRET;
    const authorizedUserId = (process.env.ZERODHA_AUTHORIZED_USER_ID || "").trim();
    const isAuthorizedOwner = !authorizedUserId || userId === "default_user" || userId === authorizedUserId;

    if (!record && envApiKey && envApiSecret && isAuthorizedOwner) {
      const encryptedSecret = encryptSensitiveData(envApiSecret, "broker-credentials");
      const { data: upserted } = await supabaseAdmin
        .from("zerodha_integrations")
        .upsert(
          {
            user_id: userId,
            api_key: envApiKey,
            api_secret: encryptedSecret,
          },
          { onConflict: "user_id" }
        )
        .select("*")
        .maybeSingle();
      if (upserted) {
        record = upserted;
      }
    }

    if (!record) {
      return {
        configured: Boolean(isAuthorizedOwner && envApiKey && envApiSecret),
        connected: false,
        integration: null,
        isTokenExpired: true,
      };
    }

    // Decrypt credentials transparently with fallback support
    const decryptedRecord: ZerodhaIntegrationRecord = {
      ...record,
      api_secret: decryptSensitiveData(record.api_secret, "broker-credentials") || "",
      access_token: decryptSensitiveData(record.access_token, "broker-credentials"),
      public_token: decryptSensitiveData(record.public_token, "broker-credentials"),
      request_token: decryptSensitiveData(record.request_token, "broker-credentials"),
    };

    const tokenValid = isTokenValidToday(decryptedRecord.token_generated_at);
    const hasAccessToken = Boolean(decryptedRecord.access_token);

    return {
      configured: Boolean(decryptedRecord.api_key && decryptedRecord.api_secret),
      connected: hasAccessToken && tokenValid,
      integration: decryptedRecord,
      isTokenExpired: !tokenValid,
    };
  } catch (err) {
    logger.error("[Zerodha] Failed to get integration:", String(err));
    return {
      configured: false,
      connected: false,
      integration: null,
      isTokenExpired: true,
    };
  }
}

/**
 * Exchange request_token for an access_token with Kite Connect API.
 */
export async function exchangeRequestToken(
  apiKey: string,
  apiSecret: string,
  requestToken: string
): Promise<{
  success: boolean;
  accessToken?: string;
  publicToken?: string;
  profile?: ZerodhaProfile;
  error?: string;
}> {
  try {
    // Checksum formula: SHA-256(api_key + request_token + api_secret)
    const rawString = `${apiKey}${requestToken}${apiSecret}`;
    const checksum = crypto.createHash("sha256").update(rawString).digest("hex");

    const params = new URLSearchParams();
    params.append("api_key", apiKey);
    params.append("request_token", requestToken);
    params.append("checksum", checksum);

    const response = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: {
        "X-Kite-Version": "3",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const json = await response.json();

    if (!response.ok || json.status === "error") {
      return {
        success: false,
        error: json.message || "Failed to exchange request token with Zerodha",
      };
    }

    const data = json.data;
    return {
      success: true,
      accessToken: data.access_token,
      publicToken: data.public_token,
      profile: {
        client_id: data.user_id,
        user_name: data.user_name,
        user_type: data.user_type,
        email: data.email,
        broker: data.broker,
        exchanges: data.exchanges,
        products: data.products,
        order_types: data.order_types,
      },
    };
  } catch (err: any) {
    logger.error("[Zerodha] Error exchanging request token:", err);
    return {
      success: false,
      error: err.message || "Network error while connecting to Zerodha Kite API",
    };
  }
}

/**
 * Fetch Stock Holdings from Kite Connect.
 */
export async function fetchKiteHoldings(apiKey: string, accessToken: string) {
  const res = await fetch("https://api.kite.trade/portfolio/holdings", {
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  });

  const json = await res.json();
  if (!res.ok || json.status === "error") {
    throw new Error(json.message || "Failed to fetch stock holdings from Zerodha");
  }

  return json.data || [];
}

/**
 * Fetch F&O Positions from Kite Connect.
 */
export async function fetchKitePositions(apiKey: string, accessToken: string) {
  const res = await fetch("https://api.kite.trade/portfolio/positions", {
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  });

  const json = await res.json();
  if (!res.ok || json.status === "error") {
    throw new Error(json.message || "Failed to fetch F&O positions from Zerodha");
  }

  return json.data || { net: [], day: [] };
}

/**
 * Fetch Mutual Fund Holdings from Kite Connect (Coin DEMAT).
 */
export async function fetchKiteMfHoldings(apiKey: string, accessToken: string) {
  const res = await fetch("https://api.kite.trade/mf/holdings", {
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  });

  const json = await res.json();
  if (!res.ok || json.status === "error") {
    // If user has no mutual funds or endpoint returns empty
    if (json.status === "error" && json.error_type === "GeneralException") {
      return [];
    }
    throw new Error(json.message || "Failed to fetch mutual fund holdings from Zerodha");
  }

  return json.data || [];
}

/**
 * Fetch Cash Balance / Margins (Zerodha Wallet) from Kite Connect.
 */
export async function fetchKiteMargins(apiKey: string, accessToken: string): Promise<{
  equity?: {
    enabled?: boolean;
    net?: number;
    available?: {
      live_balance?: number;
      cash?: number;
      opening_balance?: number;
      intraday_payin?: number;
    };
  };
  commodity?: {
    enabled?: boolean;
    net?: number;
    available?: {
      live_balance?: number;
      cash?: number;
    };
  };
} | null> {
  try {
    const res = await fetch("https://api.kite.trade/user/margins", {
      headers: {
        "X-Kite-Version": "3",
        Authorization: `token ${apiKey}:${accessToken}`,
      },
    });

    const json = await res.json();
    if (!res.ok || json.status === "error") {
      logger.warn("[Zerodha Margins] API notice:", json.message);
      return null;
    }

    return json.data || null;
  } catch (err: any) {
    logger.warn("[Zerodha Margins] Network error:", err.message);
    return null;
  }
}

/**
 * Parse an F&O trading symbol into underlying, type, strike, and expiry.
 * Examples:
 *  - "NIFTY26NOV24000CE" -> symbol: "NIFTY", type: "CE", strike: 24000, expiry: "2026-11-26"
 *  - "BANKNIFTY26NOVFUT" -> symbol: "BANKNIFTY", type: "FUT", strike: null
 */
export function parseFnoSymbol(tradingsymbol: string): {
  symbol: string;
  instrument_type: "CE" | "PE" | "FUT";
  strike_price: number | null;
  expiry_date: string;
} {
  const clean = tradingsymbol.trim().toUpperCase();

  // Default fallback values
  let symbol = "DERIVATIVE";
  let instrument_type: "CE" | "PE" | "FUT" = "FUT";
  let strike_price: number | null = null;
  const today = new Date().toISOString().split("T")[0];
  let expiry_date = today;

  if (clean.endsWith("FUT")) {
    instrument_type = "FUT";
    symbol = clean.replace(/(\d{2}[A-Z]{3})?FUT$/, "");
  } else if (clean.endsWith("CE") || clean.endsWith("PE")) {
    instrument_type = clean.endsWith("CE") ? "CE" : "PE";
    const match = clean.match(/^([A-Z]+)(\d{2}[A-Z]{3}|\d{5})?(\d+)(CE|PE)$/);
    if (match) {
      symbol = match[1];
      strike_price = parseFloat(match[3]) || null;
    } else {
      // Basic split
      const optType = clean.slice(-2) as "CE" | "PE";
      const rest = clean.slice(0, -2);
      const strikeMatch = rest.match(/\d+$/);
      if (strikeMatch) {
        strike_price = parseFloat(strikeMatch[0]);
        symbol = rest.slice(0, -strikeMatch[0].length).replace(/\d{2}[A-Z]{3}$/, "");
      }
    }
  }

  if (!symbol) symbol = clean.slice(0, 10);

  return {
    symbol: symbol || "NIFTY",
    instrument_type,
    strike_price,
    expiry_date,
  };
}

/**
 * Full Sync Orchestrator for all 3 Sections:
 * 1. Stocks -> stock_holdings
 * 2. F&O -> fno_positions
 * 3. Mutual Funds -> mutual_fund_holdings
 */
export async function syncAllZerodhaSections(userId: string): Promise<{
  success: boolean;
  stocksSynced: number;
  fnoSynced: number;
  mfSynced: number;
  walletBalance?: number;
  error?: string;
}> {
  try {
    const { configured, connected, integration, isTokenExpired } =
      await getZerodhaIntegration(userId);

    if (!configured || !integration) {
      return {
        success: false,
        stocksSynced: 0,
        fnoSynced: 0,
        mfSynced: 0,
        error: "Zerodha integration is not configured. Please provide your API Key and Secret.",
      };
    }

    let activeApiKey = integration.api_key;
    let activeAccessToken = integration.access_token;

    // Check if session needs renewal (daily 6:00 AM IST reset)
    if (!connected || !activeAccessToken || isTokenExpired) {
      const autoCreds = getAutoLoginCredentials(integration, userId);
      if (autoCreds) {
        logger.info("[Zerodha Sync] Daily session expired. Attempting automated TOTP auto-login...");
        const loginRes = await performZerodhaAutoLogin(autoCreds);

        if (loginRes.success && loginRes.accessToken) {
          activeAccessToken = loginRes.accessToken;
          activeApiKey = autoCreds.apiKey;

          await supabaseAdmin
            .from("zerodha_integrations")
            .update({
              access_token: encryptSensitiveData(loginRes.accessToken, "broker-credentials"),
              public_token: encryptSensitiveData(loginRes.publicToken || null, "broker-credentials"),
              request_token: encryptSensitiveData(loginRes.requestToken || null, "broker-credentials"),
              token_generated_at: new Date().toISOString(),
              user_profile: loginRes.profile || integration.user_profile,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          logger.info("[Zerodha Sync] Automated TOTP login successful! Daily session renewed.");
        } else {
          logger.warn("[Zerodha Sync] Auto-login failed:", loginRes.error);
          return {
            success: false,
            stocksSynced: 0,
            fnoSynced: 0,
            mfSynced: 0,
            error: `Zerodha session expired. Auto-login failed (${loginRes.error || "Unknown"}). Please click 'Login with Kite' in Settings.`,
          };
        }
      } else {
        return {
          success: false,
          stocksSynced: 0,
          fnoSynced: 0,
          mfSynced: 0,
          error: "Zerodha session expired or not authenticated. Please log in with Zerodha today or configure auto-login in .env.local.",
        };
      }
    }

    const apiKey = activeApiKey;
    const accessToken = activeAccessToken;

    // 1. Fetch data from Kite API for holdings, positions, mutual funds, and cash margins in parallel
    const [holdingsRes, positionsRes, mfHoldingsRes, marginsRes] = await Promise.allSettled([
      fetchKiteHoldings(apiKey, accessToken),
      fetchKitePositions(apiKey, accessToken),
      fetchKiteMfHoldings(apiKey, accessToken),
      fetchKiteMargins(apiKey, accessToken),
    ]);

    // Compute live wallet/margin cash balance
    let walletBalance = 0;
    if (marginsRes.status === "fulfilled" && marginsRes.value) {
      const eqNet = Number(marginsRes.value?.equity?.net ?? marginsRes.value?.equity?.available?.live_balance ?? 0);
      const comNet = Number(marginsRes.value?.commodity?.net ?? marginsRes.value?.commodity?.available?.live_balance ?? 0);
      walletBalance = Math.round((eqNet + comNet) * 100) / 100;
    }

    // 2. Ensure or update Zerodha account in `accounts` table with fresh wallet cash balance
    let zerodhaAccountId: string | null = null;
    try {
      const { data: existingAccount } = await supabaseAdmin
        .from("accounts")
        .select("id, balance")
        .eq("user_id", userId)
        .ilike("name", "%Zerodha%")
        .maybeSingle();

      if (existingAccount) {
        zerodhaAccountId = existingAccount.id;
        await supabaseAdmin
          .from("accounts")
          .update({
            balance: walletBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAccount.id);
      } else {
        const { data: newAccount } = await supabaseAdmin
          .from("accounts")
          .insert({
            user_id: userId,
            name: "Zerodha Trading & Demat",
            type: "INVESTMENT",
            balance: walletBalance,
            currency: "INR",
            last_four: "HXH648",
          })
          .select("id")
          .maybeSingle();
        if (newAccount) zerodhaAccountId = newAccount.id;
      }
    } catch (accErr) {
      logger.warn("[Zerodha Sync] Account lookup skipped:", String(accErr));
    }

    let stocksSynced = 0;
    let fnoSynced = 0;
    let mfSynced = 0;

    // --- Section 1: Stocks Sync ---
    if (holdingsRes.status === "fulfilled" && Array.isArray(holdingsRes.value)) {
      for (const h of holdingsRes.value) {
        const totalQty = (h.quantity || 0) + (h.t1_quantity || 0);
        if (totalQty <= 0) continue;

        const exchange = (h.exchange || "NSE").toUpperCase() === "BSE" ? "BSE" : "NSE";
        const symbol = (h.tradingsymbol || "").toUpperCase();

        await supabaseAdmin.from("stock_holdings").upsert(
          {
            user_id: userId,
            symbol,
            exchange,
            company_name: h.tradingsymbol,
            sector: "Other",
            quantity: totalQty,
            avg_buy_price: h.average_price || 0,
            account_id: zerodhaAccountId,
            currency: "INR",
            notes: `Synced from Zerodha Kite. ISIN: ${h.isin || "N/A"}`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,symbol,exchange" }
        );
        stocksSynced++;
      }
    }

    // --- Section 2: F&O Positions Sync ---
    if (positionsRes.status === "fulfilled") {
      const netPositions = positionsRes.value?.net || [];
      for (const p of netPositions) {
        const qty = p.quantity || 0;
        if (qty === 0 && !p.m2m) continue; // Skip completely empty flat positions

        const parsed = parseFnoSymbol(p.tradingsymbol || "");
        const side = qty >= 0 ? "BUY" : "SELL";
        const lotSize = 25; // default lot size
        const lots = Math.max(1, Math.round(Math.abs(qty) / lotSize));
        const avgPrice = qty >= 0 ? p.buy_price || 0 : p.sell_price || 0;

        await supabaseAdmin.from("fno_positions").insert({
          user_id: userId,
          symbol: parsed.symbol,
          instrument_type: parsed.instrument_type,
          strike_price: parsed.strike_price,
          expiry_date: parsed.expiry_date,
          side,
          product: ["NRML", "MIS", "CNC"].includes(p.product) ? p.product : "NRML",
          lot_size: lotSize,
          lots,
          quantity: Math.abs(qty) || 1,
          avg_price: avgPrice,
          ltp: p.last_price || null,
          status: qty === 0 ? "CLOSED" : "OPEN",
          strategy_name: "Zerodha Live Sync",
          account_id: zerodhaAccountId,
          notes: `Zerodha Contract: ${p.tradingsymbol} | MTM: ₹${p.m2m || 0}`,
          updated_at: new Date().toISOString(),
        });
        fnoSynced++;
      }
    }

    // --- Section 3: Mutual Funds Sync ---
    if (mfHoldingsRes.status === "fulfilled" && Array.isArray(mfHoldingsRes.value)) {
      for (const mf of mfHoldingsRes.value) {
        const units = mf.quantity || 0;
        if (units <= 0) continue;

        const schemeCode = mf.tradingsymbol || mf.folio || "MF_SCHEME";
        const folioNumber = mf.folio || "COIN_DEMAT";
        const avgNav = mf.average_price || 0;
        const investedAmount = units * avgNav;
        const currentNav = mf.last_price || avgNav;

        await supabaseAdmin.from("mutual_fund_holdings").upsert(
          {
            user_id: userId,
            scheme_code: schemeCode,
            scheme_name: mf.fund || mf.tradingsymbol,
            fund_house: "Zerodha Coin",
            category: "Equity",
            plan_type: "Direct",
            dividend_option: "Growth",
            folio_number: folioNumber,
            units,
            avg_nav: avgNav,
            invested_amount: investedAmount,
            current_nav: currentNav,
            nav_date: new Date().toISOString().split("T")[0],
            account_id: zerodhaAccountId,
            notes: `Synced from Zerodha Coin DEMAT. Tradingsymbol: ${mf.tradingsymbol}`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,scheme_code,folio_number" }
        );
        mfSynced++;
      }
    }

    // 3. Update Integration status
    const summary = {
      stocks_synced: stocksSynced,
      fno_synced: fnoSynced,
      mf_synced: mfSynced,
      wallet_balance: walletBalance,
    };
    await supabaseAdmin
      .from("zerodha_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "SUCCESS",
        last_sync_error: null,
        last_sync_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // Invalidate Redis caches so Accounts & Portfolio views instantly reflect the fresh balance
    try {
      await Promise.allSettled([
        invalidateCachedData(getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS)),
        invalidateCachedData(getUserCacheKey(userId, CACHE_KEYS.STOCKS)),
        invalidateCachedData(getUserCacheKey(userId, CACHE_KEYS.MUTUAL_FUNDS)),
        invalidateCachedData(getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO)),
      ]);
    } catch (cacheErr) {
      logger.warn("[Zerodha Sync] Cache invalidation skipped:", String(cacheErr));
    }

    return {
      success: true,
      stocksSynced,
      fnoSynced,
      mfSynced,
      walletBalance,
    };
  } catch (err: any) {
    logger.error("[Zerodha Sync] Failed to sync:", err);
    await supabaseAdmin
      .from("zerodha_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "FAILED",
        last_sync_error: err.message || "Unknown error during sync",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return {
      success: false,
      stocksSynced: 0,
      fnoSynced: 0,
      mfSynced: 0,
      error: err.message || "Failed to sync Zerodha portfolio",
    };
  }
}
