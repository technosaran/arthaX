import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { constantTimeCompare } from "@/utils/crypto";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export function computeNextRunDate(currentDateStr: string, frequency: string): string {
  if (!currentDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(currentDateStr)) {
    currentDateStr = new Date().toISOString().split("T")[0];
  }

  const parts = currentDateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);

  if (frequency === "daily") {
    const d = new Date(Date.UTC(year, month, day + 1));
    return d.toISOString().split("T")[0];
  } else if (frequency === "weekly") {
    const d = new Date(Date.UTC(year, month, day + 7));
    return d.toISOString().split("T")[0];
  } else if (frequency === "monthly" || frequency === "quarterly") {
    const monthsToAdd = frequency === "quarterly" ? 3 : 1;
    const targetMonth = month + monthsToAdd;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    // Get last day of target month (day 0 of next month in UTC gives last day of target month)
    const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(day, lastDayOfTargetMonth);
    const d = new Date(Date.UTC(targetYear, normalizedMonth, targetDay));
    return d.toISOString().split("T")[0];
  } else if (frequency === "yearly") {
    const targetYear = year + 1;
    const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
    const targetDay = Math.min(day, lastDayOfTargetMonth);
    const d = new Date(Date.UTC(targetYear, month, targetDay));
    return d.toISOString().split("T")[0];
  } else {
    // Default monthly
    const targetMonth = month + 1;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(day, lastDayOfTargetMonth);
    const d = new Date(Date.UTC(targetYear, normalizedMonth, targetDay));
    return d.toISOString().split("T")[0];
  }
}

export async function POST(req: NextRequest) {
  // 1. Authenticate Job Invoker (Strict CRON_SECRET constant-time validation)
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  if (!isTest) {
    if (!cronSecret) {
      logger.error("CRON_SECRET environment variable is missing on server", "QStashJob");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const expectedHeader = `Bearer ${cronSecret}`;
    if (!constantTimeCompare(authHeader.trim(), expectedHeader.trim())) {
      logger.warn("Unauthorized recurring job attempt", "QStashJob");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];
  logger.info(`Starting recurring transactions run for ${todayStr}`, "QStashJob");

  try {
    // 2. Fetch all active rules due on or before today
    const { data: dueRules, error: fetchErr } = await supabaseAdmin
      .from("recurring_rules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", todayStr);

    if (fetchErr) {
      logger.error("Failed to query due recurring rules", "QStashJob", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!dueRules || dueRules.length === 0) {
      logger.info("No recurring rules due today.", "QStashJob");
      return NextResponse.json({ success: true, processed: 0, message: "No due rules" });
    }

    let processedCount = 0;
    const errors: Array<{ ruleId: string; error: string }> = [];

    // 3. Process each rule atomically
    for (const rule of dueRules) {
      try {
        if (rule.transaction_type === "expense") {
          const { error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
            p_user_id: rule.user_id,
            p_title: rule.title,
            p_amount: rule.amount,
            p_category: rule.category || "Subscriptions & SaaS",
            p_account_id: rule.from_account_id || null,
            p_expense_date: todayStr,
            p_notes: `Automated recurring: ${rule.notes || rule.title}`,
            p_tags: ["recurring", "automated"],
          });
          if (rpcErr) throw rpcErr;
        } else if (rule.transaction_type === "income") {
          const { error: rpcErr } = await supabaseAdmin.rpc("fn_record_income_atomic", {
            p_user_id: rule.user_id,
            p_title: rule.title,
            p_amount: rule.amount,
            p_category: rule.category || "Salary",
            p_frequency: rule.frequency,
            p_account_id: rule.to_account_id || null,
            p_received_date: todayStr,
            p_notes: `Automated recurring: ${rule.notes || rule.title}`,
            p_tags: ["recurring", "automated"],
          });
          if (rpcErr) throw rpcErr;
        } else if (rule.transaction_type === "transfer" && rule.from_account_id && rule.to_account_id) {
          const { error: rpcErr } = await supabaseAdmin.rpc("fn_record_transfer_atomic", {
            p_user_id: rule.user_id,
            p_from_account_id: rule.from_account_id,
            p_to_account_id: rule.to_account_id,
            p_amount: rule.amount,
            p_transfer_date: todayStr,
            p_notes: `Automated recurring transfer: ${rule.notes || rule.title}`,
          });
          if (rpcErr) throw rpcErr;
        }

        // Advance next_run_date
        const nextDate = computeNextRunDate(rule.next_run_date, rule.frequency);
        await supabaseAdmin
          .from("recurring_rules")
          .update({
            last_run_date: todayStr,
            next_run_date: nextDate,
          })
          .eq("id", rule.id);

        // Invalidate user cache
        await invalidateCachedData([
          getUserCacheKey(rule.user_id, CACHE_KEYS.EXPENSES),
          getUserCacheKey(rule.user_id, CACHE_KEYS.INCOME),
          getUserCacheKey(rule.user_id, CACHE_KEYS.ACCOUNTS),
          getUserCacheKey(rule.user_id, CACHE_KEYS.PORTFOLIO),
          getUserCacheKey(rule.user_id, CACHE_KEYS.LEDGER),
        ]);

        processedCount++;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Error processing rule ${rule.id}`, "QStashJob", err);
        errors.push({ ruleId: rule.id, error: errorMsg });
      }
    }

    logger.info(`Recurring job completed. Processed: ${processedCount}, Errors: ${errors.length}`, "QStashJob");

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Job runner failure";
    logger.error("Recurring runner unhandled exception", "QStashJob", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
