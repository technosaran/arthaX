import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { constantTimeCompare } from "@/utils/crypto";
import { getZerodhaIntegration, syncAllZerodhaSections } from "@/utils/zerodha";
import { performZerodhaAutoLogin, getAutoLoginCredentials } from "@/utils/zerodhaAutoLogin";
import { encryptSensitiveData } from "@/utils/crypto";
import { checkAndSetIdempotency } from "@/utils/rateLimit";

async function handleZerodhaCron(req: NextRequest) {
  // 1. Authenticate Job Invoker (Strict CRON_SECRET constant-time validation)
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  if (!isTest) {
    if (!cronSecret) {
      logger.error("CRON_SECRET environment variable is missing on server", "ZerodhaCron");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const expectedHeader = `Bearer ${cronSecret}`;
    if (!constantTimeCompare(authHeader.trim(), expectedHeader.trim())) {
      logger.warn("Unauthorized Zerodha cron attempt", "ZerodhaCron");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. Distributed lock to prevent concurrent cron / action execution collisions
  if (!isTest) {
    const lockAcquired = await checkAndSetIdempotency("zerodha_cron_lock", 300);
    if (!lockAcquired) {
      logger.info("[Zerodha Cron] Sync already in progress or recently executed. Skipping redundant run.", "ZerodhaCron");
      return NextResponse.json({
        status: "skipped",
        message: "Sync already in progress or recently completed",
        timestamp: new Date().toISOString(),
        results: [],
      }, { status: 200 });
    }
  }

  logger.info(`[Zerodha Cron] Initiating automated scheduled sync at ${new Date().toISOString()}`, "ZerodhaCron");

  const rawTargetUserId =
    process.env.ZERODHA_AUTHORIZED_USER_ID ||
    process.env.DEFAULT_SYNC_USER_ID;

  if (!rawTargetUserId || rawTargetUserId === "default_user") {
    logger.info("[Zerodha Cron] No valid ZERODHA_AUTHORIZED_USER_ID configured. Skipping cron sync.", "ZerodhaCron");
    return NextResponse.json({
      status: "skipped",
      message: "No authorized user configured for auto-sync",
      timestamp: new Date().toISOString(),
      results: [],
    }, { status: 200 });
  }

  const targetUserIds = rawTargetUserId
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u && u !== "default_user");

  const results: Array<{
    userId: string;
    autoLoginSuccess: boolean;
    syncSuccess: boolean;
    stocksSynced?: number;
    bondsSynced?: number;
    fnoSynced?: number;
    mfSynced?: number;
    walletBalance?: number;
    error?: string;
  }> = [];

  for (const targetUserId of targetUserIds) {
    try {
      const { configured, connected, integration, isTokenExpired } =
        await getZerodhaIntegration(targetUserId);

      if (!configured || !integration) {
        logger.info(`[Zerodha Cron] Integration not configured for user: ${targetUserId}`, "ZerodhaCron");
        results.push({
          userId: targetUserId,
          autoLoginSuccess: false,
          syncSuccess: false,
          error: "Zerodha integration not configured in database",
        });
        continue;
      }

      let autoLoginSucceeded = false;

      // Renew session if expired for today or not connected
      if (isTokenExpired || !connected || !integration.access_token) {
        const autoCreds = getAutoLoginCredentials(integration, targetUserId);
        if (!autoCreds) {
          results.push({
            userId: targetUserId,
            autoLoginSuccess: false,
            syncSuccess: false,
            error: "Auto-login credentials missing or unauthorized in environment",
          });
          continue;
        }

        const loginResult = await performZerodhaAutoLogin(autoCreds);
        if (!loginResult.success || !loginResult.accessToken) {
          results.push({
            userId: targetUserId,
            autoLoginSuccess: false,
            syncSuccess: false,
            error: loginResult.error || "Headless auto-login failed",
          });
          continue;
        }

        // Persist fresh access token to Supabase
        await supabaseAdmin
          .from("zerodha_integrations")
          .upsert(
            {
              user_id: targetUserId,
              api_key: autoCreds.apiKey,
              api_secret: encryptSensitiveData(autoCreds.apiSecret, "broker-credentials"),
              access_token: encryptSensitiveData(loginResult.accessToken, "broker-credentials"),
              public_token: encryptSensitiveData(loginResult.publicToken || null, "broker-credentials"),
              request_token: encryptSensitiveData(loginResult.requestToken || null, "broker-credentials"),
              token_generated_at: new Date().toISOString(),
              user_profile: loginResult.profile || integration.user_profile || null,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        autoLoginSucceeded = true;
      } else {
        autoLoginSucceeded = true;
      }

      // Sync all portfolio sections
      const syncResult = await syncAllZerodhaSections(targetUserId);

      results.push({
        userId: targetUserId,
        autoLoginSuccess: autoLoginSucceeded,
        syncSuccess: syncResult.success,
        stocksSynced: syncResult.stocksSynced,
        bondsSynced: syncResult.bondsSynced,
        fnoSynced: syncResult.fnoSynced,
        mfSynced: syncResult.mfSynced,
        walletBalance: syncResult.walletBalance,
        error: syncResult.error,
      });
    } catch (err: any) {
      logger.error(`[Zerodha Cron] Unexpected error processing user ${targetUserId}`, "ZerodhaCron", err);
      results.push({
        userId: targetUserId,
        autoLoginSuccess: false,
        syncSuccess: false,
        error: err?.message || "Unknown error",
      });
    }
  }

  return NextResponse.json({
    success: results.some((r) => r.syncSuccess),
    results,
    timestamp: new Date().toISOString(),
  });
}

// GET handler (used by Vercel Cron)
export async function GET(req: NextRequest) {
  return handleZerodhaCron(req);
}

// POST handler (used by webhooks, crontab, or external dispatchers)
export async function POST(req: NextRequest) {
  return handleZerodhaCron(req);
}
