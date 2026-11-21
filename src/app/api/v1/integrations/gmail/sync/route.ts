import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiSuccess } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { syncUserGmailStatements } from "@/utils/gmail";

/**
 * GET: Check Gmail statement discovery status and last sync telemetry
 */
export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const { data: integration, error } = await supabaseAdmin
      .from("gmail_integrations")
      .select("id, email_address, sync_status, last_sync_at, error_details, created_at, updated_at")
      .eq("user_id", userId!)
      .maybeSingle();

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    if (!integration) {
      return apiSuccess(
        {
          connected: false,
          status: "NOT_CONFIGURED",
          message: "Gmail integration is not connected for this account.",
        },
        undefined,
        200,
        req
      );
    }

    // Fetch latest automation job for this user
    const { data: latestJob } = await supabaseAdmin
      .from("automation_jobs")
      .select("*")
      .eq("user_id", userId!)
      .eq("job_type", "GMAIL_SYNC")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return apiSuccess(
      {
        connected: integration.sync_status !== "DISCONNECTED",
        email: integration.email_address,
        syncStatus: integration.sync_status,
        lastSyncAt: integration.last_sync_at,
        errorDetails: integration.error_details,
        latestJob: latestJob || null,
      },
      undefined,
      200,
      req
    );
  },
});

/**
 * POST: Trigger on-demand automated Gmail bank statement discovery & ingestion
 */
export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 10, windowSeconds: 60 },
  idempotent: true,
  handler: async ({ userId, req, body }) => {
    // 1. Verify user has active Gmail integration
    const { data: integration } = await supabaseAdmin
      .from("gmail_integrations")
      .select("sync_status, email_address")
      .eq("user_id", userId!)
      .maybeSingle();

    if (!integration || integration.sync_status === "DISCONNECTED") {
      return apiError(
        "Gmail integration is not connected. Please connect your Gmail account to enable automatic bank statement ingestion.",
        "BAD_REQUEST",
        400,
        undefined,
        req
      );
    }

    // 2. Parse optional query parameters or request body (e.g. maxMessages, customQuery)
    let maxMessages = 30;
    let customQuery: string | undefined = undefined;

    const requestBody = (body || {}) as Record<string, unknown>;
    if (typeof requestBody?.maxMessages === "number") {
      maxMessages = Math.min(Math.max(requestBody.maxMessages, 5), 100);
    }
    if (typeof requestBody?.customQuery === "string" && requestBody.customQuery.trim()) {
      customQuery = requestBody.customQuery.trim();
    }

    // 3. Execute statement sync pipeline
    const syncResult = await syncUserGmailStatements(userId!, {
      maxMessages,
      customQuery,
    });

    if (!syncResult.success && syncResult.status === "FAILED") {
      return apiError(
        syncResult.error || "Gmail statement synchronization failed",
        "SYNC_FAILED",
        500,
        syncResult,
        req
      );
    }

    await invalidateUserCaches(userId, [
      "ACCOUNTS",
      "EXPENSES",
      "INCOME",
      "PORTFOLIO",
      "LEDGER",
      "TRANSFERS",
      "ANALYTICS",
    ]);

    return apiSuccess(
      {
        message: `Gmail automated statement discovery complete. Processed ${syncResult.statementsCount} statements.`,
        ...syncResult,
      },
      undefined,
      200,
      req
    );
  },
});
