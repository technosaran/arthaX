import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { getZerodhaIntegration, syncAllZerodhaSections } from "@/utils/zerodha";
import {
  performZerodhaAutoLogin,
  getAutoLoginCredentials,
  type ZerodhaAutoLoginResult,
} from "@/utils/zerodhaAutoLogin";
import { encryptSensitiveData } from "@/utils/crypto";
import { checkAndSetIdempotency } from "@/utils/rateLimit";

export interface ZerodhaUserSyncResult {
  userId: string;
  autoLoginSuccess: boolean;
  syncSuccess: boolean;
  stocksSynced?: number;
  bondsSynced?: number;
  fnoSynced?: number;
  mfSynced?: number;
  walletBalance?: number;
  error?: string;
}

export interface ZerodhaCronSummary {
  status: "completed" | "skipped" | "partial_failure" | "failed";
  success: boolean;
  message?: string;
  results: ZerodhaUserSyncResult[];
  timestamp: string;
}

/**
 * Orchestrates automated Zerodha Kite login (TOTP) and portfolio sync
 * across all authorized owner IDs configured in ZERODHA_AUTHORIZED_USER_ID.
 *
 * Shares freshly obtained Kite sessions across authorized users who share
 * the same Kite API key + client ID within a single run so we never trigger
 * back-to-back TOTP reuse rejections or invalidate an earlier user's token.
 */
export async function runZerodhaCronSync(options?: {
  skipLock?: boolean;
}): Promise<ZerodhaCronSummary> {
  const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

  if (!isTest && !options?.skipLock) {
    const lockAcquired = await checkAndSetIdempotency("zerodha_cron_lock", 300);
    if (!lockAcquired) {
      logger.info(
        "[Zerodha Cron] Sync already in progress or recently executed. Skipping redundant run.",
        "ZerodhaCron"
      );
      return {
        status: "skipped",
        success: true,
        message: "Sync already in progress or recently completed",
        timestamp: new Date().toISOString(),
        results: [],
      };
    }
  }

  logger.info(
    `[Zerodha Cron] Initiating automated scheduled sync at ${new Date().toISOString()}`,
    "ZerodhaCron"
  );

  const rawTargetUserId =
    process.env.ZERODHA_AUTHORIZED_USER_ID || process.env.DEFAULT_SYNC_USER_ID;

  if (!rawTargetUserId || rawTargetUserId === "default_user") {
    logger.info(
      "[Zerodha Cron] No valid ZERODHA_AUTHORIZED_USER_ID configured. Skipping cron sync.",
      "ZerodhaCron"
    );
    return {
      status: "skipped",
      success: false,
      message: "No authorized user configured for auto-sync",
      timestamp: new Date().toISOString(),
      results: [],
    };
  }

  const targetUserIds = Array.from(
    new Set(
      rawTargetUserId
        .split(",")
        .map((u) => u.trim())
        .filter((u) => u && u !== "default_user")
    )
  );

  if (targetUserIds.length === 0) {
    return {
      status: "skipped",
      success: false,
      message: "No authorized user configured for auto-sync",
      timestamp: new Date().toISOString(),
      results: [],
    };
  }

  const results: ZerodhaUserSyncResult[] = [];
  const freshSessions = new Map<string, ZerodhaAutoLoginResult>();

  for (const targetUserId of targetUserIds) {
    try {
      const { configured, connected, integration, isTokenExpired } =
        await getZerodhaIntegration(targetUserId);

      if (!configured || !integration) {
        logger.info(
          `[Zerodha Cron] Integration not configured for user: ${targetUserId}`,
          "ZerodhaCron"
        );
        results.push({
          userId: targetUserId,
          autoLoginSuccess: false,
          syncSuccess: false,
          error: "Zerodha integration not configured in database",
        });
        continue;
      }

      let autoLoginSucceeded = false;
      const autoCreds = getAutoLoginCredentials(integration, targetUserId);
      const sessionKey = autoCreds ? `${autoCreds.apiKey}:${autoCreds.userId}` : null;
      const cachedFreshSession = sessionKey ? freshSessions.get(sessionKey) : undefined;

      if (cachedFreshSession?.accessToken && autoCreds) {
        // Persist the fresh session token obtained earlier in this run so all
        // authorized owners sharing the same Kite client stay synchronized.
        const { error: upsertErr } = await supabaseAdmin
          .from("zerodha_integrations")
          .upsert(
            {
              user_id: targetUserId,
              api_key: autoCreds.apiKey,
              api_secret: encryptSensitiveData(autoCreds.apiSecret, "broker-credentials"),
              access_token: encryptSensitiveData(cachedFreshSession.accessToken, "broker-credentials"),
              public_token: encryptSensitiveData(cachedFreshSession.publicToken || null, "broker-credentials"),
              request_token: encryptSensitiveData(cachedFreshSession.requestToken || null, "broker-credentials"),
              token_generated_at: new Date().toISOString(),
              user_profile: cachedFreshSession.profile || integration.user_profile || null,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (upsertErr) {
          throw new Error(`Failed to persist shared Zerodha session: ${upsertErr.message}`);
        }
        autoLoginSucceeded = true;
      } else if (isTokenExpired || !connected || !integration.access_token) {
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
          const failureMsg = loginResult.error || "Headless auto-login failed";
          await supabaseAdmin
            .from("zerodha_integrations")
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: "FAILED",
              last_sync_error: failureMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", targetUserId);

          results.push({
            userId: targetUserId,
            autoLoginSuccess: false,
            syncSuccess: false,
            error: failureMsg,
          });
          continue;
        }

        if (sessionKey) {
          freshSessions.set(sessionKey, loginResult);
        }

        const { error: upsertErr } = await supabaseAdmin
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

        if (upsertErr) {
          throw new Error(`Failed to persist Zerodha session: ${upsertErr.message}`);
        }

        autoLoginSucceeded = true;
      } else {
        autoLoginSucceeded = true;
      }

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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logger.error(
        `[Zerodha Cron] Unexpected error processing user ${targetUserId}`,
        "ZerodhaCron",
        { error: errorMsg }
      );
      results.push({
        userId: targetUserId,
        autoLoginSuccess: false,
        syncSuccess: false,
        error: errorMsg,
      });
    }
  }

  const anySuccess = results.some((r) => r.syncSuccess);
  const anyFailure = results.some((r) => !r.syncSuccess);
  const status =
    results.length === 0
      ? "skipped"
      : anySuccess && anyFailure
        ? "partial_failure"
        : anySuccess
          ? "completed"
          : "failed";

  return {
    status,
    success: anySuccess,
    results,
    timestamp: new Date().toISOString(),
  };
}
