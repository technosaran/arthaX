import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { extractRequestId, apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { getZerodhaIntegration, syncAllZerodhaSections } from "@/utils/zerodha";
import {
  performZerodhaAutoLogin,
  getAutoLoginCredentials,
  ZerodhaAutoLoginParams,
} from "@/utils/zerodhaAutoLogin";
import { encryptSensitiveData } from "@/utils/crypto";
import { z } from "zod";

const AutoLoginSchema = z.object({
  userId: z.string().optional(),
  password: z.string().optional(),
  totpSecret: z.string().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
});

// POST: Execute headless automated TOTP login and sync portfolio
export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit: 5 auto-login attempts per 10 minutes to protect against account lockout
  const rl = await rateLimit(`zerodha_autologin:${userId}`, 5, 600);
  if (!rl.success) {
    return apiError(
      "Too many login attempts. Please wait 10 minutes to protect your Zerodha account.",
      "RATE_LIMITED",
      429,
      undefined,
      req
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = AutoLoginSchema.safeParse(body);

    const status = await getZerodhaIntegration(userId);
    const envCreds = getAutoLoginCredentials(status.integration, userId);

    const provided = parsed.success ? parsed.data : {};
    const finalCreds: ZerodhaAutoLoginParams = {
      userId: (provided.userId || envCreds?.userId || "").trim(),
      password: (provided.password || envCreds?.password || "").trim(),
      totpSecret: (provided.totpSecret || envCreds?.totpSecret || "").trim(),
      apiKey: (provided.apiKey || envCreds?.apiKey || status.integration?.api_key || "").trim(),
      apiSecret: (provided.apiSecret || envCreds?.apiSecret || status.integration?.api_secret || "").trim(),
    };

    if (!finalCreds.userId || !finalCreds.password || !finalCreds.totpSecret) {
      return apiError(
        "Missing auto-login credentials. Please provide Zerodha User ID, Password, and TOTP Secret (or set ZERODHA_USER_ID, ZERODHA_PASSWORD, ZERODHA_TOTP_SECRET in .env.local).",
        "BAD_REQUEST",
        400,
        undefined,
        req
      );
    }

    if (!finalCreds.apiKey || !finalCreds.apiSecret) {
      return apiError(
        "Missing Kite API Key or API Secret. Please configure them in Settings or .env.local.",
        "BAD_REQUEST",
        400,
        undefined,
        req
      );
    }

    // Execute headless auto-login
    const loginResult = await performZerodhaAutoLogin(finalCreds);

    if (!loginResult.success || !loginResult.accessToken) {
      return apiError(
        loginResult.error || "Automated Zerodha login failed",
        "BAD_REQUEST",
        400,
        undefined,
        req
      );
    }

    // Persist new access_token to Supabase
    await supabaseAdmin
      .from("zerodha_integrations")
      .upsert(
        {
          user_id: userId,
          api_key: finalCreds.apiKey,
          api_secret: encryptSensitiveData(finalCreds.apiSecret, "broker-credentials"),
          access_token: encryptSensitiveData(loginResult.accessToken, "broker-credentials"),
          public_token: encryptSensitiveData(loginResult.publicToken || null, "broker-credentials"),
          request_token: encryptSensitiveData(loginResult.requestToken || null, "broker-credentials"),
          token_generated_at: new Date().toISOString(),
          user_profile: loginResult.profile || status.integration?.user_profile || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    // Immediately trigger a sync of all 3 portfolio sections
    const syncResult = await syncAllZerodhaSections(userId);

    return apiSuccess(
      {
        message: "Automated Zerodha login and portfolio sync succeeded!",
        profile: loginResult.profile,
        sync: syncResult,
      },
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return apiError(
      err.message || "Internal server error during Zerodha auto-login",
      "INTERNAL_SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
