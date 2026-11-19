import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  return handleDisconnect(req);
}

export async function DELETE(req: NextRequest) {
  return handleDisconnect(req);
}

async function handleDisconnect(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const { error } = await supabaseAdmin
      .from("binance_integrations")
      .delete()
      .eq("user_id", userId);

    if (error) {
      return apiError(`Failed to disconnect: ${error.message}`, "DATABASE_ERROR", 500, undefined, req);
    }

    return apiSuccess({ disconnected: true, message: "Binance integration disconnected successfully" }, undefined, req);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Error disconnecting Binance",
      "SERVER_ERROR",
      500,
      undefined,
      req
    );
  }
}
