import crypto from "crypto";
import { logger } from "@/utils/logger";
import { exchangeRequestToken, ZerodhaIntegrationRecord } from "@/utils/zerodha";
import { decryptSensitiveData } from "@/utils/crypto";

export interface ZerodhaAutoLoginParams {
  userId: string;
  password: string;
  totpSecret: string;
  apiKey: string;
  apiSecret: string;
}

export interface ZerodhaAutoLoginResult {
  success: boolean;
  accessToken?: string;
  publicToken?: string;
  requestToken?: string;
  profile?: Record<string, unknown> | null;
  error?: string;
}

/**
 * Decodes an RFC 4648 Base32 encoded string into a Buffer.
 * Ignores spaces, hyphens, and trailing padding.
 */
export function base32Decode(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  const clean = (base32 || "").replace(/[\s=-]+/g, "").toUpperCase();
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Computes a standard 6-digit Time-based One-Time Password (TOTP)
 * compliant with RFC 6238 / RFC 4226 using HMAC-SHA1 and 30-second intervals.
 */
export function generateTOTP(secret: string, timestampMs = Date.now()): string {
  const key = base32Decode(secret);
  if (key.length === 0) {
    throw new Error("Invalid or empty Base32 TOTP secret key");
  }

  // 30-second interval counter
  const counter = Math.floor(timestampMs / 1000 / 30);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;

  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;

  return code.toString().padStart(6, "0");
}

/**
 * Merges newly received Set-Cookie headers into an existing Cookie string.
 */
export function mergeCookies(existingCookies: string, newSetCookies: string[]): string {
  const cookieMap = new Map<string, string>();

  if (existingCookies) {
    existingCookies.split(";").forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx > -1) {
        cookieMap.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    });
  }

  for (const item of newSetCookies) {
    if (!item) continue;
    const firstPart = item.split(";")[0];
    const idx = firstPart.indexOf("=");
    if (idx > -1) {
      cookieMap.set(firstPart.slice(0, idx).trim(), firstPart.slice(idx + 1).trim());
    }
  }

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Helper to extract set-cookie headers from a Fetch response across environments.
 */
function extractSetCookies(res: Response): string[] {
  const headersWithCookies = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof headersWithCookies.getSetCookie === "function") {
    return headersWithCookies.getSetCookie();
  }
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

/**
 * Checks if auto-login credentials are configured in environment variables or database record.
 * Protects against multi-tenant leaks by ensuring environment credentials are only granted
 * to the authorized account owner (ZERODHA_AUTHORIZED_USER_ID) or local default_user.
 */
export function getAutoLoginCredentials(
  integration?: ZerodhaIntegrationRecord | null,
  currentUserId?: string
): ZerodhaAutoLoginParams | null {
  const rawAuthorized = (process.env.ZERODHA_AUTHORIZED_USER_ID || "").trim();
  const authorizedUserIds = rawAuthorized
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  // Ensure server environment broker credentials are strictly restricted to authorized account owners
  if (
    currentUserId &&
    currentUserId !== "default_user"
  ) {
    if (authorizedUserIds.length === 0 || !authorizedUserIds.includes(currentUserId)) {
      logger.warn(`[Zerodha Security] Unauthorized user ${currentUserId} attempted to use owner Zerodha credentials.`);
      return null;
    }
  }

  const userId = (process.env.ZERODHA_USER_ID || "").trim();
  const password = (process.env.ZERODHA_PASSWORD || "").trim();
  const totpSecret = (process.env.ZERODHA_TOTP_SECRET || "").trim();
  const apiKey = (process.env.ZERODHA_API_KEY || integration?.api_key || "").trim();
  const rawApiSecret = (process.env.ZERODHA_API_SECRET || integration?.api_secret || "").trim();
  const apiSecret = rawApiSecret.startsWith("enc:v1:")
    ? decryptSensitiveData(rawApiSecret, "broker-credentials", { allowPlaintextFallback: true }) || ""
    : rawApiSecret;

  if (userId && password && totpSecret && apiKey && apiSecret) {
    return {
      userId,
      password,
      totpSecret,
      apiKey,
      apiSecret,
    };
  }

  return null;
}

/**
 * Performs a headless automated login to Zerodha Kite:
 * 1. POST credentials to https://kite.zerodha.com/api/login
 * 2. Generate 6-digit TOTP from secret and POST to https://kite.zerodha.com/api/twofa
 * 3. Follow Kite Connect OAuth redirect to extract request_token
 * 4. Exchange request_token for Kite Connect access_token
 *
 * Safety: Stops immediately upon any failure to prevent the 3-attempt account lockout.
 */
export async function performZerodhaAutoLogin(
  params: ZerodhaAutoLoginParams
): Promise<ZerodhaAutoLoginResult> {
  const { userId, password, totpSecret, apiKey, apiSecret } = params;

  if (!userId || !password || !totpSecret || !apiKey || !apiSecret) {
    return {
      success: false,
      error: "Missing required auto-login credentials (user_id, password, totp_secret, api_key, api_secret).",
    };
  }

  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  let cookies = "";

  try {
    // -------------------------------------------------------------------------
    // Step 1: Submit Zerodha User ID & Password
    // -------------------------------------------------------------------------
    logger.info("[Zerodha Auto-Login] Step 1: Submitting credentials for user:", userId);

    const loginBody = new URLSearchParams();
    loginBody.append("user_id", userId);
    loginBody.append("password", password);

    const loginRes = await fetch("https://kite.zerodha.com/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: loginBody.toString(),
    });

    cookies = mergeCookies(cookies, extractSetCookies(loginRes));
    const loginJson = await loginRes.json().catch(() => null);

    if (!loginRes.ok || !loginJson || loginJson.status !== "success") {
      const errMsg = loginJson?.message || "Login request rejected by Zerodha";
      logger.error("[Zerodha Auto-Login] Step 1 Failed:", errMsg);
      return {
        success: false,
        error: `Zerodha authentication failed: ${errMsg}`,
      };
    }

    const requestId = loginJson.data?.request_id;
    if (!requestId) {
      return {
        success: false,
        error: "Zerodha did not return a 2FA request_id.",
      };
    }

    // -------------------------------------------------------------------------
    // Step 2: Compute and Submit TOTP 2FA
    // -------------------------------------------------------------------------
    logger.info("[Zerodha Auto-Login] Step 2: Generating and submitting TOTP 2FA...");
    const totpCode = generateTOTP(totpSecret);

    const twofaBody = new URLSearchParams();
    twofaBody.append("user_id", userId);
    twofaBody.append("request_id", requestId);
    twofaBody.append("twofa_value", totpCode);
    twofaBody.append("twofa_type", "totp");
    twofaBody.append("skip_session", "true");

    const twofaRes = await fetch("https://kite.zerodha.com/api/twofa", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
        Cookie: cookies,
      },
      body: twofaBody.toString(),
    });

    cookies = mergeCookies(cookies, extractSetCookies(twofaRes));
    const twofaJson = await twofaRes.json().catch(() => null);

    if (!twofaRes.ok || !twofaJson || twofaJson.status !== "success") {
      const errMsg = twofaJson?.message || "2FA TOTP verification failed";
      logger.error("[Zerodha Auto-Login] Step 2 Failed:", errMsg);
      return {
        success: false,
        error: `Zerodha 2FA failed: ${errMsg}`,
      };
    }

    // -------------------------------------------------------------------------
    // Step 3: Call Kite Connect Login URL to get request_token redirect
    // -------------------------------------------------------------------------
    logger.info("[Zerodha Auto-Login] Step 3: Fetching Kite Connect OAuth redirect...");

    let currentUrl = `https://kite.zerodha.com/connect/login?api_key=${encodeURIComponent(apiKey)}&v=3`;
    let requestToken: string | null = null;

    // Follow up to 4 redirects manually to capture request_token from callback URL
    for (let hop = 0; hop < 4; hop++) {
      const connectRes = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": userAgent,
          Cookie: cookies,
        },
        redirect: "manual",
      });

      cookies = mergeCookies(cookies, extractSetCookies(connectRes));
      const location = connectRes.headers.get("location");

      if (!location) {
        // Check body text for request_token if rendered directly
        const bodyText = await connectRes.text();
        const match = bodyText.match(/request_token=([a-zA-Z0-9]+)/);
        if (match) {
          requestToken = match[1];
        }
        break;
      }

      const parsedLoc = new URL(location, currentUrl);
      const tokenInQuery = parsedLoc.searchParams.get("request_token");

      if (tokenInQuery) {
        requestToken = tokenInQuery;
        break;
      }

      currentUrl = parsedLoc.toString();
    }

    if (!requestToken) {
      logger.error("[Zerodha Auto-Login] Failed to obtain request_token from Kite redirect.");
      return {
        success: false,
        error: "Unable to retrieve request_token from Kite Connect authorization redirect.",
      };
    }

    // -------------------------------------------------------------------------
    // Step 4: Exchange request_token for access_token with Kite Connect API
    // -------------------------------------------------------------------------
    logger.info("[Zerodha Auto-Login] Step 4: Exchanging request_token with Kite Connect...");
    const exchange = await exchangeRequestToken(apiKey, apiSecret, requestToken);

    if (!exchange.success || !exchange.accessToken) {
      logger.error("[Zerodha Auto-Login] Step 4 Exchange failed:", exchange.error);
      return {
        success: false,
        error: exchange.error || "Failed to exchange request_token for Kite Connect access_token.",
      };
    }

    logger.info("[Zerodha Auto-Login] Success! New daily access_token obtained.");
    return {
      success: true,
      accessToken: exchange.accessToken,
      publicToken: exchange.publicToken,
      requestToken,
      profile: exchange.profile as Record<string, unknown> | null | undefined,
    };
  } catch (err: unknown) {
    logger.error("[Zerodha Auto-Login] Unexpected exception:", "ZerodhaAutoLogin", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected network error during Zerodha auto-login.",
    };
  }
}
