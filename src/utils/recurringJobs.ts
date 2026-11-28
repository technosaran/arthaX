import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { getLocalDateString } from "@/utils/monthUtils";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { checkAndSetIdempotency } from "@/utils/rateLimit";
import * as rateLimitModule from "@/utils/rateLimit";

async function safeReleaseIdempotency(key: string): Promise<void> {
  try {
    const mod = rateLimitModule as { releaseIdempotency?: (k: string) => Promise<void> };
    if (typeof mod.releaseIdempotency === "function") {
      await mod.releaseIdempotency(key);
    }
  } catch {
    // Safe no-op under partial mocks
  }
}

export interface RecurringJobsSummary {
  success: boolean;
  processed: number;
  skippedIdempotent?: number;
  errors: string[];
  message?: string;
  timestamp: string;
}

/**
 * Safely computes next run date strictly clamping month-end dates (e.g. Jan 31 -> Feb 28/29).
 * Gracefully falls back to current IST date when input is empty or malformed.
 */
export function computeNextRunDate(currentDateStr: string, frequency: string): string {
  const isoMatch = typeof currentDateStr === "string" ? currentDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  let y: number;
  let m: number;
  let d: number;

  if (isoMatch) {
    y = Number(isoMatch[1]);
    m = Number(isoMatch[2]);
    d = Number(isoMatch[3]);
  } else {
    const parsed = currentDateStr ? new Date(currentDateStr) : new Date(NaN);
    if (!Number.isNaN(parsed.getTime())) {
      y = parsed.getUTCFullYear();
      m = parsed.getUTCMonth() + 1;
      d = parsed.getUTCDate();
    } else {
      const istToday = getLocalDateString(new Date(), "Asia/Kolkata").split("-");
      y = Number(istToday[0]);
      m = Number(istToday[1]);
      d = Number(istToday[2]);
    }
  }

  const normalizedFreq = (frequency || "monthly").trim().toLowerCase();

  if (normalizedFreq === "daily") {
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    return dt.toISOString().split("T")[0];
  }

  if (normalizedFreq === "weekly") {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return dt.toISOString().split("T")[0];
  }

  if (normalizedFreq === "biweekly" || normalizedFreq === "fortnightly") {
    const dt = new Date(Date.UTC(y, m - 1, d + 14));
    return dt.toISOString().split("T")[0];
  }

  let monthsToAdd = 1;
  if (normalizedFreq === "quarterly") monthsToAdd = 3;
  else if (normalizedFreq === "half-yearly" || normalizedFreq === "semi-annual") monthsToAdd = 6;
  else if (normalizedFreq === "yearly" || normalizedFreq === "annual" || normalizedFreq === "annually") {
    monthsToAdd = 12;
  }

  const totalMonths = y * 12 + (m - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);

  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/**
 * Executes all active due recurring rules in Asia/Kolkata (IST) with per-occurrence idempotency
 * and cache invalidation.
 */
export async function runRecurringJobs(): Promise<RecurringJobsSummary> {
  const todayStr = getLocalDateString(new Date(), "Asia/Kolkata");
  const timestamp = new Date().toISOString();

  const { data: dueRules, error: queryError } = await supabaseAdmin
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_date", todayStr);

  if (queryError) {
    logger.error("Failed to fetch recurring rules", "RecurringJobs", queryError);
    throw new Error(queryError.message);
  }

  if (!dueRules || dueRules.length === 0) {
    return {
      success: true,
      processed: 0,
      skippedIdempotent: 0,
      errors: [],
      message: "No due recurring transactions for today.",
      timestamp,
    };
  }

  let processedCount = 0;
  let skippedIdempotent = 0;
  const errors: string[] = [];
  const touchedUsers = new Set<string>();

  for (const rule of dueRules) {
    const idempotencyKey = `recurring_rule_exec:${rule.id}:${rule.next_run_date}`;
    const lockClaimed = await checkAndSetIdempotency(idempotencyKey, 86400 * 7);
    if (!lockClaimed) {
      skippedIdempotent += 1;
      continue;
    }

    try {
      let execError: { message?: string } | null = null;

      if (rule.flow_type === "expense") {
        const { error: expErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
          p_user_id: rule.user_id,
          p_title: `${rule.title} (Auto)`,
          p_amount: Number(rule.amount),
          p_category: rule.category,
          p_account_id: rule.account_id || null,
          p_expense_date: rule.next_run_date || todayStr,
          p_notes: "Automatically recorded via ArthaX Recurring Automation",
          p_tags: ["recurring", "automated"],
        });
        execError = expErr;
      } else if (rule.flow_type === "income") {
        const { error: incErr } = await supabaseAdmin.rpc("fn_record_income_atomic", {
          p_user_id: rule.user_id,
          p_title: `${rule.title} (Auto)`,
          p_amount: Number(rule.amount),
          p_category: rule.category,
          p_frequency: rule.frequency || "monthly",
          p_account_id: rule.account_id || null,
          p_received_date: rule.next_run_date || todayStr,
          p_notes: "Automatically recorded via ArthaX Recurring Automation",
          p_tags: ["recurring", "automated"],
        });
        execError = incErr;
      }

      if (execError) {
        await safeReleaseIdempotency(idempotencyKey);
        errors.push(`Rule ${rule.id}: ${execError.message || "RPC failed"}`);
        continue;
      }

      // Compute next schedule date; if catch-up date is still before todayStr, advance iteratively capped safely
      let nextDate = computeNextRunDate(rule.next_run_date, rule.frequency);
      let safetyHops = 0;
      while (nextDate < todayStr && safetyHops < 24) {
        nextDate = computeNextRunDate(nextDate, rule.frequency);
        safetyHops += 1;
      }

      const { error: updErr } = await supabaseAdmin
        .from("recurring_rules")
        .update({
          next_run_date: nextDate,
          last_run_at: new Date().toISOString(),
        })
        .eq("id", rule.id)
        .eq("user_id", rule.user_id);

      if (updErr) {
        errors.push(`Rule ${rule.id} schedule update: ${updErr.message}`);
      } else {
        processedCount += 1;
        if (rule.user_id) touchedUsers.add(rule.user_id);
      }
    } catch (e: unknown) {
      await safeReleaseIdempotency(idempotencyKey);
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.push(`Rule ${rule.id} exception: ${errMsg}`);
    }
  }

  // Invalidate affected user caches and write audit telemetry (non-blocking)
  await Promise.allSettled([
    ...Array.from(touchedUsers).map(async (uid) => {
      await invalidateUserCaches(uid, ["ACCOUNTS", "EXPENSES", "INCOME", "PORTFOLIO", "LEDGER"]);
      try {
        await supabaseAdmin.from("automation_jobs").insert({
          user_id: uid,
          job_type: "RECURRING_RULES",
          status: errors.length > 0 ? "PARTIAL" : "COMPLETED",
          started_at: timestamp,
          completed_at: new Date().toISOString(),
          stats: { processedCount, skippedIdempotent, runDateIst: todayStr },
        });
      } catch {
        // Non-fatal telemetry log
      }
    }),
  ]);

  logger.info(
    `Recurring job completed. Processed: ${processedCount}, Skipped: ${skippedIdempotent}, Errors: ${errors.length}`,
    "RecurringJobs"
  );

  return {
    success: errors.length === 0,
    processed: processedCount,
    skippedIdempotent,
    errors,
    timestamp: new Date().toISOString(),
  };
}
