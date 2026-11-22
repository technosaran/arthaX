import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, extractRequestId } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    // Parallel burst: statements, canonical_txs, zerodha, gmail, automation_jobs
    const [
      statementsRes,
      txCountRes,
      zerodhaRes,
      gmailRes,
      jobsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("bank_statements")
        .select("id, bank_name, reconciliation_status, period_start, period_end, transaction_count, created_at")
        .eq("user_id", userId),
      supabaseAdmin
        .from("canonical_transactions")
        .select("id, is_transfer, is_verified, transaction_type, classification_confidence", { count: "exact" })
        .eq("user_id", userId),
      supabaseAdmin
        .from("zerodha_integrations")
        .select("id, api_key_encrypted, last_sync_at, last_sync_status, last_sync_error")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("gmail_integrations")
        .select("id, email_address, sync_status, last_sync_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("automation_jobs")
        .select("id, job_type, status, stats, error_message, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const statements = statementsRes.data || [];
    const totalStatements = statements.length;
    const reconciledStatements = statements.filter((s) => s.reconciliation_status === "RECONCILED").length;
    const discrepancyStatements = statements.filter((s) => s.reconciliation_status === "DISCREPANCY").length;

    const txCount = txCountRes.count || 0;
    const txSample = txCountRes.data || [];
    const transfersCount = txSample.filter((t) => t.is_transfer).length;

    const avgConfidence =
      txSample.length > 0
        ? txSample.reduce((acc, curr) => acc + (Number(curr.classification_confidence) || 0), 0) / txSample.length
        : 0;

    return NextResponse.json({
      success: true,
      automation: {
        gmail: {
          connected: Boolean(gmailRes.data && gmailRes.data.sync_status === "ACTIVE"),
          email: gmailRes.data?.email_address || null,
          syncStatus: gmailRes.data?.sync_status || "DISCONNECTED",
          lastSyncAt: gmailRes.data?.last_sync_at || null,
        },
        statements: {
          total: totalStatements,
          reconciled: reconciledStatements,
          discrepancies: discrepancyStatements,
          reconciliationPassRate: totalStatements > 0 ? ((reconciledStatements / totalStatements) * 100).toFixed(1) : "N/A",
          supportedBanks: ["State Bank of India (SBI)", "Indian Bank", "Generic Bank CSV (HDFC/ICICI/Axis)"],
        },
        transactions: {
          canonicalTotal: txCount,
          transfersDetected: transfersCount,
          averageConfidence: avgConfidence ? (avgConfidence * 100).toFixed(1) + "%" : "N/A",
        },
        zerodha: {
          configured: Boolean(zerodhaRes.data),
          lastSyncAt: zerodhaRes.data?.last_sync_at || null,
          lastSyncStatus: zerodhaRes.data?.last_sync_status || null,
          lastSyncError: zerodhaRes.data?.last_sync_error || null,
        },
        recentJobs: jobsRes.data || [],
      },
    }, { headers: { "X-Request-Id": requestId } });
  } catch {
    return apiError("Failed to fetch automation status", "INTERNAL_ERROR", 500, undefined, req);
  }
}
