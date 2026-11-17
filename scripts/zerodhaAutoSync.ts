/**
 * Standalone Zerodha Kite Connect Automated Daily Sync Script
 *
 * Can be scheduled to run every morning (e.g. 8:30 AM IST) via:
 *   - Windows Task Scheduler
 *   - Crontab / GitHub Actions
 *   - "npm run zerodha:sync"
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/zerodhaAutoSync.ts
 */

import { supabaseAdmin } from "../src/utils/supabase/admin";
import { getZerodhaIntegration, syncAllZerodhaSections } from "../src/utils/zerodha";
import { performZerodhaAutoLogin, getAutoLoginCredentials } from "../src/utils/zerodhaAutoLogin";
import { encryptSensitiveData } from "../src/utils/crypto";

async function main() {
  console.log("=================================================");
  console.log("🚀 ArthaX - Zerodha Automated Daily Portfolio Sync");
  console.log("=================================================");
  console.log(`Current Time (Local): ${new Date().toLocaleString()}`);

  const rawTargetUserId =
    process.env.ZERODHA_AUTHORIZED_USER_ID ||
    process.env.DEFAULT_SYNC_USER_ID ||
    "default_user";

  const targetUserIds = rawTargetUserId
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  for (const targetUserId of targetUserIds) {
    console.log(`\n-------------------------------------------------`);
    console.log(`👤 Processing Target User: ${targetUserId}`);
    console.log(`-------------------------------------------------`);

    const { configured, connected, integration, isTokenExpired } =
      await getZerodhaIntegration(targetUserId);

    console.log(`Configured: ${configured ? "YES" : "NO"}`);
    console.log(`Connected: ${connected ? "YES" : "NO"}`);
    console.log(`Session Expired Today: ${isTokenExpired ? "YES" : "NO"}`);

    if (!isTokenExpired && connected && integration?.access_token) {
      console.log("✅ Today's Zerodha session is already active. Proceeding with portfolio sync...");
    } else {
      console.log("⚠️ Daily session expired or not active. Attempting headless TOTP auto-login...");
      const autoCreds = getAutoLoginCredentials(integration, targetUserId);

      if (!autoCreds) {
        console.error(
          `❌ Error: Auto-login credentials missing or unauthorized for ${targetUserId}!`
        );
        continue;
      }

      console.log(`Logging in user: ${autoCreds.userId}...`);
      const loginResult = await performZerodhaAutoLogin(autoCreds);

      if (!loginResult.success || !loginResult.accessToken) {
        console.error("❌ Auto-login failed:", loginResult.error);
        continue;
      }

      console.log("✅ Auto-login succeeded! Saving access token to Supabase...");

      // Save strictly to target user with AES-256-GCM authenticated encryption
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
            user_profile: loginResult.profile || integration?.user_profile || null,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
    }

    console.log(`📥 Syncing Zerodha sections & cash wallet for user: ${targetUserId}...`);
    const syncResult = await syncAllZerodhaSections(targetUserId);

    if (!syncResult.success) {
      console.error(`❌ Sync failed for ${targetUserId}:`, syncResult.error);
    } else {
      console.log(`🎉 Sync Complete for ${targetUserId}!`);
      console.log(`   - Wallet Cash Balance: ₹${syncResult.walletBalance ?? 0}`);
      console.log(`   - Stocks Synced: ${syncResult.stocksSynced}`);
      console.log(`   - F&O Positions Synced: ${syncResult.fnoSynced}`);
      console.log(`   - Mutual Funds Synced: ${syncResult.mfSynced}`);
    }
  }

  console.log("=================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error in Zerodha auto-sync:", err);
  process.exit(1);
});
