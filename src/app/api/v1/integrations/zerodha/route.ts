import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { extractRequestId, apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import {
  getZerodhaIntegration,
  exchangeRequestToken,
  isTokenValidToday,
} from "@/utils/zerodha";
import { getAutoLoginCredentials } from "@/utils/zerodhaAutoLogin";
import { encryptSensitiveData } from "@/utils/crypto";
import { z } from "zod";

const SaveCredentialsSchema = z.object({
  apiKey: z.string().min(1, "API Key is required").max(100),
  apiSecret: z.string().min(1, "API Secret is required").max(100),
  requestToken: z.string().optional().nullable(),
  accessToken: z.string().optional().nullable(),
});

// GET: Check Zerodha Integration Status
export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`zerodha_get:${userId}`, 60, 60);
  if (!rl.success) {
    return apiError("Too many requests. Please slow down.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const status = await getZerodhaIntegration(userId);

    return apiSuccess(
      {
        configured: status.configured,
        connected: status.connected,
        isTokenExpired: status.isTokenExpired,
        autoLoginConfigured: Boolean(getAutoLoginCredentials(status.integration, userId)),
        autoLoginUserIdMasked: getAutoLoginCredentials(status.integration, userId)?.userId
          ? `${getAutoLoginCredentials(status.integration, userId)!.userId.slice(0, 2)}••••`
          : null,
        apiKeyMasked: status.integration?.api_key
          ? `${status.integration.api_key.slice(0, 3)}••••${status.integration.api_key.slice(-3)}`
          : null,
        userProfile: status.integration?.user_profile || null,
        lastSyncAt: status.integration?.last_sync_at || null,
        lastSyncStatus: status.integration?.last_sync_status || null,
        lastSyncSummary: status.integration?.last_sync_summary || null,
        lastSyncError: status.integration?.last_sync_error || null,
        loginUrl: status.integration?.api_key
          ? `https://kite.zerodha.com/connect/login?api_key=${status.integration.api_key}&v=3`
          : null,
      },
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return apiError(err.message || "Failed to get Zerodha status", "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// POST: Save Credentials or Exchange Request Token
export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`zerodha_post:${userId}`, 20, 60);
  if (!rl.success) {
    return apiError("Too many requests. Please slow down.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const body = await req.json();
    const parsed = SaveCredentialsSchema.safeParse(body);

    if (!parsed.success) {
      const issueMsg = parsed.error.issues?.[0]?.message || "Invalid input";
      return apiError(issueMsg, "VALIDATION_ERROR", 400, undefined, req);
    }

    const { apiKey, apiSecret, requestToken, accessToken } = parsed.data;

    let finalAccessToken = accessToken || null;
    let finalProfile = null;
    let finalPublicToken = null;

    // If request_token provided, exchange immediately
    if (requestToken && !accessToken) {
      const exchangeResult = await exchangeRequestToken(apiKey, apiSecret, requestToken);
      if (!exchangeResult.success) {
        return apiError(exchangeResult.error || "Failed to validate request token with Zerodha", "BAD_REQUEST", 400, undefined, req);
      }
      finalAccessToken = exchangeResult.accessToken || null;
      finalProfile = exchangeResult.profile || null;
      finalPublicToken = exchangeResult.publicToken || null;
    }

    const tokenGeneratedAt = finalAccessToken ? new Date().toISOString() : null;

    const { data: saved, error: dbErr } = await supabaseAdmin
      .from("zerodha_integrations")
      .upsert(
        {
          user_id: userId,
          api_key: apiKey.trim(),
          api_secret: encryptSensitiveData(apiSecret.trim(), "broker-credentials"),
          request_token: encryptSensitiveData(requestToken ? requestToken.trim() : null, "broker-credentials"),
          access_token: encryptSensitiveData(finalAccessToken, "broker-credentials"),
          public_token: encryptSensitiveData(finalPublicToken, "broker-credentials"),
          user_profile: finalProfile,
          token_generated_at: tokenGeneratedAt,
          updated_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (dbErr) {
      return apiError(dbErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    const loginUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey.trim()}&v=3`;

    return apiSuccess(
      {
        message: finalAccessToken
          ? "Zerodha credentials saved and authenticated successfully!"
          : "Zerodha credentials saved. Please complete login with Kite.",
        connected: Boolean(finalAccessToken),
        loginUrl,
      },
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return apiError(err.message || "Failed to save Zerodha credentials", "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// DELETE: Remove Integration
export async function DELETE(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    await supabaseAdmin.from("zerodha_integrations").delete().eq("user_id", userId);
    return apiSuccess({ message: "Zerodha integration removed successfully" }, undefined, 200, req);
  } catch (err: any) {
    return apiError(err.message || "Failed to remove Zerodha integration", "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
