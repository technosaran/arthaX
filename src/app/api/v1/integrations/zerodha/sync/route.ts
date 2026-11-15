import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { syncAllZerodhaSections } from "@/utils/zerodha";

// POST: Trigger manual sync of all 3 portfolio sections from Zerodha
export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit: 10 syncs per minute
  const rl = await rateLimit(`zerodha_sync:${userId}`, 10, 60);
  if (!rl.success) {
    return apiError("Sync limit reached. Please wait a minute before syncing again.", "RATE_LIMITED", 429, undefined, req);
  }

  try {
    const result = await syncAllZerodhaSections(userId);

    if (!result.success) {
      return apiError(result.error || "Failed to sync Zerodha portfolio", "BAD_REQUEST", 400, undefined, req);
    }

    return apiSuccess(
      {
        message: "Zerodha portfolio synced successfully across all 3 sections!",
        stocksSynced: result.stocksSynced,
        fnoSynced: result.fnoSynced,
        mfSynced: result.mfSynced,
      },
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return apiError(err.message || "Internal server error during sync", "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
