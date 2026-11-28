import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiSuccess } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { parseIntParam } from "@/lib/backend/queryParams";

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const { searchParams } = new URL(req.url);
    const limit = parseIntParam(searchParams.get("limit"), 50, 1, 100);

    const { data: statements, error } = await supabaseAdmin
      .from("bank_statements")
      .select("*, account:accounts(name, type, last_four)")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    return apiSuccess(
      {
        statements: statements || [],
        count: statements?.length || 0,
      },
      undefined,
      200,
      req
    );
  },
});
