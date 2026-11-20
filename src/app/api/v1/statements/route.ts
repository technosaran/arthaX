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

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  try {
    const { data: statements, error } = await supabaseAdmin
      .from("bank_statements")
      .select("*, account:accounts(name, type, last_four)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    return NextResponse.json({
      success: true,
      statements: statements || [],
      count: statements?.length || 0,
    }, { headers: { "X-Request-Id": requestId } });
  } catch (err: unknown) {
    return apiError("Failed to fetch bank statements", "INTERNAL_ERROR", 500, undefined, req);
  }
}
