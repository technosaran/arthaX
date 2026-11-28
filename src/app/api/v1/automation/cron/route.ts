import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { checkAndSetIdempotency } from "@/utils/rateLimit";
import * as rateLimitModule from "@/utils/rateLimit";
import { syncUserGmailStatements } from "@/utils/gmail";
import { constantTimeCompare } from "@/utils/crypto";
import { checkAndAutoUpdateTaxRules } from "@/utils/taxAutoUpdater";
import { runRecurringJobs } from "@/utils/recurringJobs";
import { runZerodhaCronSync } from "@/utils/zerodhaCron";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const GMAIL_BATCH_CONCURRENCY = 3;

async function handleAutomationCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  if (!isTest) {
    if (!cronSecret) {
      logger.error("CRON_SECRET missing from environment", "AutomationCron");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const expected = `Bearer ${cronSecret}`;
    if (!constantTimeCompare(authHeader.trim(), expected.trim())) {
      logger.warn("Unauthorized automation cron trigger attempt", "AutomationCron");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const lockKey = "universal_automation_cron_lock";
  const lockAcquired = await checkAndSetIdempotency(lockKey, 300);
  if (!lockAcquired) {
    return NextResponse.json(
      { status: "skipped", reason: "Automation cron already active in distributed lock window" },
      { status: 200 }
    );
  }

  try {
    logger.info(
      `[Automation Cron] Initiating universal automation cycle at ${new Date().toISOString()}`,
      "AutomationCron"
    );

    // 1. Recover timed-out stuck RUNNING jobs (>15 minutes old) by marking them FAILED cleanly
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: staleJobs } = await supabaseAdmin
      .from("automation_jobs")
      .select("id")
      .eq("status", "RUNNING")
      .lt("started_at", fifteenMinsAgo);

    if (staleJobs && staleJobs.length > 0) {
      for (const job of staleJobs) {
        await supabaseAdmin
          .from("automation_jobs")
          .update({
            status: "FAILED",
            completed_at: new Date().toISOString(),
            error_message: "Execution timed out (>15m) — marked failed by automation supervisor",
          })
          .eq("id", job.id);
      }
      logger.info(`[Automation Cron] Closed ${staleJobs.length} timed-out automation job(s)`, "AutomationCron");
    }

    // 2. Run independent sub-crons (Recurring rules, Zerodha holdings, Statutory Indian Tax check) concurrently
    const shouldRunSubCrons = !isTest || process.env.RUN_SUB_CRONS_IN_TEST === "1";

    let recurringJobs: unknown = null;
    let zerodhaSync: unknown = null;
    let taxRules: unknown = null;

    if (shouldRunSubCrons) {
      const [recOutcome, zOutcome, taxOutcome] = await Promise.allSettled([
        runRecurringJobs(),
        runZerodhaCronSync({ skipLock: true }),
        checkAndAutoUpdateTaxRules().catch(() => null),
      ]);

      if (recOutcome.status === "fulfilled") {
        recurringJobs = recOutcome.value;
      } else {
        const msg = recOutcome.reason instanceof Error ? recOutcome.reason.message : String(recOutcome.reason);
        logger.error("Recurring job execution failed inside unified cron", "AutomationCron", recOutcome.reason);
        recurringJobs = { success: false, error: msg };
      }

      if (zOutcome.status === "fulfilled") {
        zerodhaSync = zOutcome.value;
      } else {
        const msg = zOutcome.reason instanceof Error ? zOutcome.reason.message : String(zOutcome.reason);
        logger.error("Zerodha sync failed inside unified cron", "AutomationCron", zOutcome.reason);
        zerodhaSync = { success: false, error: msg };
      }

      if (taxOutcome.status === "fulfilled") {
        taxRules = taxOutcome.value;
      }
    }

    // 3. Discover active Gmail integrations and sync in bounded concurrent batches
    const { data: integrations, error: intErr } = await supabaseAdmin
      .from("gmail_integrations")
      .select("user_id, email_address, sync_status")
      .neq("sync_status", "DISCONNECTED");

    if (intErr) {
      logger.error("Failed to fetch Gmail integrations during automation cron", "AutomationCron", intErr);
      return NextResponse.json(
        { status: "error", error: intErr.message, timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    const activeIntegrations = integrations || [];
    const results: Array<Record<string, unknown>> = [];

    for (let i = 0; i < activeIntegrations.length; i += GMAIL_BATCH_CONCURRENCY) {
      const batch = activeIntegrations.slice(i, i + GMAIL_BATCH_CONCURRENCY);
      const batchOutcomes = await Promise.allSettled(
        batch.map(async (integration) => {
          const syncRes = await syncUserGmailStatements(integration.user_id, {
            maxMessages: 15,
            lookbackDays: 14,
          });
          return {
            userId: integration.user_id,
            email: integration.email_address,
            success: syncRes.success,
            statementsCount: syncRes.statementsCount,
            transactionsImported: syncRes.transactionsImported,
            duplicatesSkipped: syncRes.duplicatesSkipped,
            error: syncRes.error,
          };
        })
      );

      batchOutcomes.forEach((outcome, idx) => {
        const integration = batch[idx];
        if (outcome.status === "fulfilled") {
          results.push(outcome.value);
        } else {
          const msg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
          logger.error(`Cron failed for user ${integration.user_id}`, "AutomationCron", outcome.reason);
          results.push({
            userId: integration.user_id,
            email: integration.email_address,
            success: false,
            error: msg,
          });
        }
      });
    }

    const hasFailure = results.some((r) => !r.success);
    const overallStatus =
      results.length > 0 && results.every((r) => !r.success)
        ? "failed"
        : hasFailure
        ? "partial"
        : "completed";

    logger.info(
      `[Automation Cron] Completed cycle: status=${overallStatus}, processed=${results.length} Gmail integration(s).`,
      "AutomationCron"
    );

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      processedUsers: results.length,
      results,
      ...(recurringJobs !== null ? { recurringJobs } : {}),
      ...(zerodhaSync !== null ? { zerodhaSync } : {}),
      ...(taxRules !== null ? { taxRules } : {}),
    });
  } catch (err: unknown) {
    logger.error("Unexpected error in automation cron runner", "AutomationCron", err);
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : "Automation cron error" },
      { status: 500 }
    );
  } finally {
    try {
      const mod = rateLimitModule as { releaseIdempotency?: (k: string) => Promise<void> };
      if (typeof mod.releaseIdempotency === "function") {
        await mod.releaseIdempotency(lockKey);
      }
    } catch {
      // Safe no-op when test suites mock only checkAndSetIdempotency on @/utils/rateLimit
    }
  }
}

export async function GET(req: NextRequest) {
  return handleAutomationCron(req);
}

export async function POST(req: NextRequest) {
  return handleAutomationCron(req);
}
