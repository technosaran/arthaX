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
import { getZerodhaIntegration, isTokenValidToday, syncAllZerodhaSections } from "../src/utils/zerodha";
import { performZerodhaAutoLogin, getAutoLoginCredentials } from "../src/utils/zerodhaAutoLogin";

async function main() {
  console.log("=================================================");
  console.log("🚀 ArthaX - Zerodha Automated Daily Portfolio Sync");
  console.log("=================================================");
  console.log(`Current Time (Local): ${new Date().toLocaleString()}`);

  const targetUserId =
    process.env.ZERODHA_AUTHORIZED_USER_ID ||
    process.env.DEFAULT_SYNC_USER_ID ||
    "default_user";

  const { configured, connected, integration, isTokenExpired } =
    await getZerodhaIntegration(targetUserId);

  console.log(`User ID: ${targetUserId}`);
  console.log(`Configured: ${configured ? "YES" : "NO"}`);
  console.log(`Connected: ${connected ? "YES" : "NO"}`);
  console.log(`Session Expired Today: ${isTokenExpired ? "YES" : "NO"}`);

  if (!isTokenExpired && connected && integration?.access_token) {
    console.log("✅ Today's Zerodha session is already active. Proceeding with portfolio sync...");
  } else {
    console.log("⚠️ Daily session expired or not active. Attempting headless TOTP auto-login...");
    const autoCreds = getAutoLoginCredentials(integration);

    if (!autoCreds) {
      console.error(
        "❌ Error: Auto-login credentials missing! Please configure ZERODHA_USER_ID, ZERODHA_PASSWORD, and ZERODHA_TOTP_SECRET in .env.local"
      );
      process.exit(1);
    }

    console.log(`Logging in user: ${autoCreds.userId}...`);
    const loginResult = await performZerodhaAutoLogin(autoCreds);

    if (!loginResult.success || !loginResult.accessToken) {
      console.error("❌ Auto-login failed:", loginResult.error);
      process.exit(1);
    }

    console.log("✅ Auto-login succeeded! Saving access token to Supabase...");
    
    // Save to target user
    await supabaseAdmin
      .from("zerodha_integrations")
      .upsert(
        {
          user_id: targetUserId,
          api_key: autoCreds.apiKey,
          api_secret: autoCreds.apiSecret,
          access_token: loginResult.accessToken,
          public_token: loginResult.publicToken || null,
          request_token: loginResult.requestToken || null,
          token_generated_at: new Date().toISOString(),
          user_profile: loginResult.profile || integration?.user_profile || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    // Also synchronize session to all active user records in database
    const { data: allUsers } = await supabaseAdmin
      .from("zerodha_integrations")
      .select("user_id")
      .neq("user_id", targetUserId);

    for (const u of allUsers || []) {
      await supabaseAdmin
        .from("zerodha_integrations")
        .update({
          access_token: loginResult.accessToken,
          public_token: loginResult.publicToken || null,
          request_token: loginResult.requestToken || null,
          token_generated_at: new Date().toISOString(),
          user_profile: loginResult.profile || integration?.user_profile || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", u.user_id);
    }
  }

  // Sync holdings, positions, mutual funds, and cash margins for authorized user & default_user
  const usersToSync = new Set<string>([targetUserId, "default_user"]);

  for (const uid of usersToSync) {
    console.log(`📥 Syncing Zerodha sections & cash wallet for user: ${uid}...`);
    const syncResult = await syncAllZerodhaSections(uid);

    if (!syncResult.success) {
      console.error(`❌ Sync failed for ${uid}:`, syncResult.error);
    } else {
      console.log(`🎉 Sync Complete for ${uid}!`);
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
