import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { fetchBinanceSpotAccount } from "@/utils/binance";
import { encryptSensitiveData } from "@/utils/crypto";
import { z } from "zod";

const ConnectSchema = z.object({
  apiKey: z.string().min(10, "Valid Binance API Key is required").max(128),
  apiSecret: z.string().min(10, "Valid Binance API Secret is required").max(128),
});

export async function POST(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`crypto:binance:connect:${userId}`, 10, 60);
  if (!rl.success) {
    return apiError("Too many connection attempts. Please slow down.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const body = await req.json();
    const parsed = ConnectSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Invalid input", "VALIDATION_ERROR", 400, undefined, req);
    }

    const { apiKey, apiSecret } = parsed.data;

    // 1. Verify credentials against Binance API
    const testRes = await fetchBinanceSpotAccount(apiKey, apiSecret);
    if (!testRes.success || !testRes.data) {
      return apiError(
        testRes.error || "Failed to authenticate with Binance. Check your API Key and Secret.",
        "BINANCE_AUTH_FAILED",
        400,
        undefined,
        req
      );
    }

    // 2. Encrypt API Secret using AES-256-GCM
    const encryptedSecret = encryptSensitiveData(apiSecret, "binance-credentials");
    if (!encryptedSecret) {
      return apiError("Internal encryption failure", "ENCRYPTION_ERROR", 500, undefined, req);
    }

    // 3. Upsert credentials into database
    const { error: dbError } = await supabaseAdmin
      .from("binance_integrations")
      .upsert(
        {
          user_id: userId,
          api_key: apiKey,
          api_secret: encryptedSecret,
          is_active: true,
          auto_sync: true,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      return apiError(`Failed to save integration: ${dbError.message}`, "DATABASE_ERROR", 500, undefined, req);
    }

    return apiSuccess(
      {
        connected: true,
        accountType: testRes.data.accountType || "SPOT",
        permissions: testRes.data.permissions || ["SPOT"],
        message: "Binance successfully connected and verified.",
      },
      undefined,
      req
    );
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Internal server error connecting Binance",
      "SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
