import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiSuccess } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { logger } from "@/utils/logger";
import { getLocalDateString } from "@/utils/monthUtils";

export const SUPPORTED_STATEMENT_BANKS = [
  "State Bank of India (SBI)",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Indian Bank",
  "Generic Bank CSV",
  "Universal Bank PDF & OCR",
] as const;

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    try {
      const todayIst = getLocalDateString(new Date(), "Asia/Kolkata");

      // Single-.eq() queries for clean multi-tenant isolation & fast parallel execution
      const [
        statementsRes,
        txRes,
        zerodhaRes,
        gmailRes,
        jobsRes,
        recurringRes,
        attachmentsRes,
      ] = await Promise.all([
        supabaseAdmin
          .from("bank_statements")
          .select("id, bank_name, reconciliation_status, created_at, statement_source, transaction_count")
          .eq("user_id", userId!),
        supabaseAdmin
          .from("canonical_transactions")
          .select("id, is_transfer, classification_confidence", { count: "exact" })
          .eq("user_id", userId!)
          .order("transaction_date", { ascending: false })
          .limit(250),
        supabaseAdmin
          .from("zerodha_integrations")
          .select("id, api_key, last_sync_at, last_sync_status, last_sync_error, is_active")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabaseAdmin
          .from("gmail_integrations")
          .select("id, email_address, sync_status, last_sync_at, error_details")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabaseAdmin
          .from("automation_jobs")
          .select("id, job_type, status, started_at, completed_at, stats, error_message")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseAdmin
          .from("recurring_rules")
          .select("id, title, flow_type, amount, frequency, next_run_date, is_active")
          .eq("user_id", userId!)
          .order("next_run_date", { ascending: true })
          .limit(50),
        supabaseAdmin
          .from("statement_attachment_jobs")
          .select("id, file_name, detected_bank, status, error_code, error_message, updated_at")
          .eq("user_id", userId!)
          .order("updated_at", { ascending: false })
          .limit(25),
      ]);

      const statements = statementsRes.data || [];
      const totalStatements = statements.length;
      const reconciledStatements = statements.filter((s) => s.reconciliation_status === "RECONCILED").length;
      const discrepantStatements = statements.filter((s) => s.reconciliation_status === "DISCREPANCY").length;

      const txSample = txRes.data || [];
      const txCount = typeof txRes.count === "number" ? txRes.count : txSample.length;
      const transfersCount = txSample.filter((t) => t.is_transfer).length;

      const avgConfidence =
        txSample.length > 0
          ? Number(
              (
                txSample.reduce((acc, curr) => acc + (Number(curr.classification_confidence) || 0), 0) /
                txSample.length
              ).toFixed(4)
            )
          : 0;

      const recurringList = recurringRes.data || [];
      const activeRecurring = recurringList.filter((r) => r.is_active !== false);
      const dueRecurring = activeRecurring.filter((r) => r.next_run_date && r.next_run_date <= todayIst);
      const nextScheduledRunDate = activeRecurring.find((r) => Boolean(r.next_run_date))?.next_run_date || null;

      const attachmentList = attachmentsRes.data || [];
      const pendingAttachments = attachmentList.filter(
        (a) => a.status !== "RECONCILED" && a.status !== "COMPLETED"
      );
      const passwordRequiredJobs = pendingAttachments.filter(
        (a) =>
          a.error_code === "PASSWORD_REQUIRED" ||
          a.error_code === "PASSWORD_INCORRECT" ||
          a.status === "PASSWORD_REQUIRED"
      );
      const banksRequiringPassword = Array.from(
        new Set(
          passwordRequiredJobs
            .map((j) => (j.detected_bank || "BANK").trim().toUpperCase())
            .filter(Boolean)
        )
      );

      return apiSuccess(
        {
          automation: {
            gmail: {
              connected: Boolean(
                gmailRes.data &&
                  gmailRes.data.sync_status !== "DISCONNECTED" &&
                  gmailRes.data.sync_status !== "PENDING_AUTH"
              ),
              email: gmailRes.data?.email_address || null,
              syncStatus: gmailRes.data?.sync_status || "DISCONNECTED",
              lastSyncAt: gmailRes.data?.last_sync_at || null,
              error: gmailRes.data?.error_details || null,
            },
            statements: {
              totalIngested: totalStatements,
              reconciled: reconciledStatements,
              discrepancies: discrepantStatements,
              reconciliationPassRate:
                totalStatements > 0 ? ((reconciledStatements / totalStatements) * 100).toFixed(1) : "N/A",
              supportedBanks: [...SUPPORTED_STATEMENT_BANKS],
            },
            transactions: {
              totalCanonical: txCount,
              transfersMatched: transfersCount,
              averageConfidence: avgConfidence,
            },
            zerodha: {
              configured: Boolean(zerodhaRes.data?.api_key),
              active: zerodhaRes.data?.is_active ?? false,
              lastSyncAt: zerodhaRes.data?.last_sync_at || null,
              lastSyncStatus: zerodhaRes.data?.last_sync_status || null,
            },
            recurring: {
              activeCount: activeRecurring.length,
              dueCount: dueRecurring.length,
              nextRunDate: nextScheduledRunDate,
              todayIst,
            },
            pendingAttachments: {
              totalPending: pendingAttachments.length,
              passwordRequiredCount: passwordRequiredJobs.length,
              banksRequiringPassword,
              items: pendingAttachments.slice(0, 5),
            },
            recentJobs: jobsRes.data || [],
          },
        },
        undefined,
        200,
        req
      );
    } catch (err: unknown) {
      logger.error("Failed to fetch automation status", "AutomationStatus", err);
      return apiError("Failed to fetch automation status", "INTERNAL_ERROR", 500, undefined, req);
    }
  },
});
