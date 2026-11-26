import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { constantTimeCompare } from "@/utils/crypto";
import { checkAndSetIdempotency } from "@/utils/rateLimit";
import { syncUserGmailStatements } from "@/utils/gmail";
import { runRecurringJobs } from "@/utils/recurringJobs";
import { runZerodhaCronSync } from "@/utils/zerodhaCron";
import { checkAndAutoUpdateTaxRules } from "@/utils/taxAutoUpdater";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Universal Background Automation Cron Endpoint
 * Scheduled via Vercel Schedules / Cron or QStash.
 * Executes recurring transaction rules, Zerodha daily auto-login & sync,
 * automated Gmail discovery, bank statement ingestion, and job recovery.
 */
async function handleAutomationCron(req: NextRequest) {
  // 1. Authenticate Invoker using CRON_SECRET with constant-time comparison
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  if (!isTest) {
    if (!cronSecret) {
      logger.error("CRON_SECRET environment variable is missing on server", "AutomationCron");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const expectedHeader = `Bearer ${cronSecret}`;
    if (!constantTimeCompare(authHeader.trim(), expectedHeader.trim())) {
      logger.warn("Unauthorized automation cron trigger attempt", "AutomationCron");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. Distributed lock to prevent concurrent overlapping executions
  if (!isTest) {
    const lockAcquired = await checkAndSetIdempotency("universal_automation_cron_lock", 300);
    if (!lockAcquired) {
      logger.info("[Automation Cron] Sync already in progress or recently executed. Skipping redundant run.", "AutomationCron");
      return NextResponse.json({
        status: "skipped",
        message: "Automation sync already in progress or recently executed",
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }
  }

  logger.info(`[Automation Cron] Initiating universal automation cycle at ${new Date().toISOString()}`, "AutomationCron");

  try {
    // 2b. Recover abandoned RUNNING jobs older than 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    try {
      const { data: abandonedJobs } = await supabaseAdmin
        .from("automation_jobs")
        .select("id, retry_count")
        .eq("status", "RUNNING")
        .lt("started_at", fifteenMinutesAgo);

      if (abandonedJobs && abandonedJobs.length > 0) {
        for (const job of abandonedJobs) {
          const nextRetry = (job.retry_count || 0) + 1;
          const newStatus = nextRetry >= 3 ? "FAILED" : "QUEUED"; // Retry if < 3, else permanently FAILED
          await supabaseAdmin
            .from("automation_jobs")
            .update({
              status: newStatus,
              error_message: "Job timed out or worker abandoned execution after 15 minutes",
              retry_count: nextRetry,
              completed_at: newStatus === "FAILED" ? new Date().toISOString() : null,
            })
            .eq("id", job.id);
        }
        logger.info(`[Automation Cron] Recovered ${abandonedJobs.length} abandoned running jobs`, "AutomationCron");
      }
    } catch (recErr) {
      logger.warn("Failed to check or recover abandoned jobs", "AutomationCron", { error: String(recErr) });
    }

    // 2c. Directly await recurring transactions & Zerodha daily auto-sync in-process
    // so Vercel never drops unawaited background fetch promises upon returning.
    let recurringJobs: unknown = null;
    let zerodhaSync: unknown = null;
    let taxAutoUpdate: unknown = null;
    if (!isTest || process.env.RUN_SUB_CRONS_IN_TEST === "1") {
      const [recOutcome, zerodhaOutcome, taxOutcome] = await Promise.allSettled([
        runRecurringJobs(),
        runZerodhaCronSync(),
        checkAndAutoUpdateTaxRules(),
      ]);

      if (recOutcome.status === "fulfilled") {
        recurringJobs = recOutcome.value;
      } else {
        const msg = recOutcome.reason instanceof Error ? recOutcome.reason.message : String(recOutcome.reason);
        logger.error("Recurring job execution failed inside unified cron", "AutomationCron", recOutcome.reason);
        recurringJobs = { success: false, error: msg };
      }

      if (zerodhaOutcome.status === "fulfilled") {
        zerodhaSync = zerodhaOutcome.value;
        if (zerodhaOutcome.value.status === "failed" || zerodhaOutcome.value.status === "partial_failure") {
          logger.error("Zerodha sync reported errors inside unified cron", "AutomationCron", undefined, {
            status: zerodhaOutcome.value.status,
            results: zerodhaOutcome.value.results,
          });
        }
      } else {
        const msg = zerodhaOutcome.reason instanceof Error ? zerodhaOutcome.reason.message : String(zerodhaOutcome.reason);
        logger.error("Zerodha sync execution threw inside unified cron", "AutomationCron", zerodhaOutcome.reason);
        zerodhaSync = { status: "failed", success: false, error: msg };
      }

      taxAutoUpdate =
        taxOutcome.status === "fulfilled"
          ? {
              assessmentYear: taxOutcome.value.assessmentYear,
              source: taxOutcome.value.source,
              updated: taxOutcome.value.updated,
              rulesVersion: taxOutcome.value.rulesVersion,
            }
          : { updated: false, error: String(taxOutcome.reason) };
    }

    // 3. Query all users with active Gmail integrations (strictly ACTIVE status)
    const { data: rawIntegrations, error: fetchErr } = await supabaseAdmin
      .from("gmail_integrations")
      .select("user_id, email_address, sync_status")
      .neq("sync_status", "DISCONNECTED");

    if (fetchErr) {
      logger.error("Failed to query active Gmail integrations", "AutomationCron", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const integrations = (rawIntegrations || []).filter((item) => item.sync_status === "ACTIVE");

    const results: Array<{
      userId: string;
      email: string;
      success: boolean;
      statementsCount: number;
      transactionsImported: number;
      duplicatesSkipped: number;
      error?: string;
    }> = [];

    // 4. Process each user's statements in isolation
    for (const item of integrations || []) {
      const syncResult = await syncUserGmailStatements(item.user_id);
      results.push({
        userId: item.user_id,
        email: item.email_address,
        success: syncResult.success,
        statementsCount: syncResult.statementsCount,
        transactionsImported: syncResult.transactionsImported,
        duplicatesSkipped: syncResult.duplicatesSkipped,
        error: syncResult.error,
      });
    }

    const hasFailures = results.some((r) => !r.success);
    const allFailed = results.length > 0 && results.every((r) => !r.success);
    const overallStatus = allFailed ? "failed" : hasFailures ? "partial_failure" : "completed";

    logger.info(`[Automation Cron] Completed automation cycle: status=${overallStatus}, processed=${results.length} integrations.`, "AutomationCron");

    return NextResponse.json({
      status: overallStatus,
      processedUsers: results.length,
      timestamp: new Date().toISOString(),
      results,
      ...(recurringJobs !== null ? { recurringJobs } : {}),
      ...(zerodhaSync !== null ? { zerodhaSync } : {}),
      ...(taxAutoUpdate !== null ? { taxAutoUpdate } : {}),
    }, { status: 200 });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Unexpected error in automation cron runner", "AutomationCron", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleAutomationCron(req);
}

export async function POST(req: NextRequest) {
  return handleAutomationCron(req);
}
