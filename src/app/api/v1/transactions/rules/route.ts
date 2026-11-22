import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiSuccess, apiError } from "@/utils/apiResponse";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { z } from "zod";

const CreateClassificationRuleSchema = z.object({
  match_field: z.enum(["NARATION_CONTAINS", "COUNTERPARTY", "UPI_VPA", "REGEX"]),
  match_pattern: z.string().min(2).max(100),
  assigned_category: z.string().min(2).max(50),
  assigned_type: z.enum(["EXPENSE", "INCOME", "TRANSFER", "INVESTMENT", "REFUND"]),
});

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const { data: rules, error } = await supabaseAdmin
      .from("user_classification_rules")
      .select("*")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false });

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 500, undefined, req);
    }

    return apiSuccess(rules || [], undefined, 200, req);
  },
});

export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 30, windowSeconds: 60 },
  schema: CreateClassificationRuleSchema,
  handler: async ({ userId, body, req }) => {
    const { match_field, match_pattern, assigned_category, assigned_type } = body;
    const cleanPattern = match_pattern.trim();

    const { data: newRule, error: insertErr } = await supabaseAdmin
      .from("user_classification_rules")
      .upsert(
        {
          user_id: userId!,
          match_field,
          match_pattern: cleanPattern,
          assigned_category,
          assigned_type,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,match_field,match_pattern" }
      )
      .select()
      .single();

    if (insertErr) {
      return apiError(insertErr.message, "DATABASE_ERROR", 500, undefined, req);
    }

    // Apply rule retrospectively to unverified canonical transactions matching pattern
    try {
      if (match_field === "NARATION_CONTAINS") {
        await supabaseAdmin
          .from("canonical_transactions")
          .update({
            category: assigned_category,
            transaction_type: assigned_type,
            classification_confidence: 0.9900,
            classification_reason: `User rule override: ${cleanPattern}`,
            user_overridden: true,
          })
          .eq("user_id", userId!)
          .ilike("original_narration", `%${cleanPattern}%`);
      }
    } catch {}

    await invalidateUserCaches(userId!, ["EXPENSES", "INCOME", "LEDGER"]);

    return apiSuccess(newRule, undefined, 201, req);
  },
});

export const DELETE = createApiRoute({
  auth: "required",
  rateLimit: { limit: 30, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const ruleId = query.get("id");
    if (!ruleId) {
      return apiError("Missing rule 'id' parameter in query", "BAD_REQUEST", 400, undefined, req);
    }

    const { error: delErr } = await supabaseAdmin
      .from("user_classification_rules")
      .delete()
      .eq("id", ruleId)
      .eq("user_id", userId!);

    if (delErr) {
      return apiError(delErr.message, "DATABASE_ERROR", 500, undefined, req);
    }

    return apiSuccess({ deleted: true, id: ruleId }, undefined, 200, req);
  },
});
