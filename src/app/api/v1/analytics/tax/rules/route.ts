import { z } from "zod";
import { NextRequest } from "next/server";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiSuccess } from "@/utils/apiResponse";
import { checkAndAutoUpdateTaxRules, getCachedAutoTaxRecord } from "@/utils/taxAutoUpdater";
import {
  TaxRuleOverridesMap,
  TaxRuleOverridesMapSchema,
  getCurrentIndianAssessmentYear,
  getCurrentTaxYearPreset,
  normalizeAssessmentYear,
  resolveTaxYearPreset,
} from "@/utils/taxRules";
import { logger } from "@/utils/logger";

const PutTaxRulesSchema = z.object({
  overrides: TaxRuleOverridesMapSchema,
});

function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "42703" || err.code === "PGRST204") return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("tax_rule_overrides") && (msg.includes("does not exist") || msg.includes("schema cache"));
}

async function readUserTaxOverrides(
  userId: string,
  req: NextRequest
): Promise<{ overrides: TaxRuleOverridesMap; dbPersistenceAvailable: boolean; errorResponse?: ReturnType<typeof apiError> }> {
  let overrides: TaxRuleOverridesMap = {};
  let dbPersistenceAvailable = true;

  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .select("tax_rule_overrides")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      dbPersistenceAvailable = false;
    } else {
      logger.warn("Failed to load user tax rule overrides", "TaxRulesAPI", { userId, error: error.message });
      return {
        overrides,
        dbPersistenceAvailable,
        errorResponse: apiError(error.message || "Failed to load tax rules.", "DATABASE_ERROR", 500, undefined, req),
      };
    }
  } else if (data && typeof (data as Record<string, unknown>).tax_rule_overrides === "object") {
    const parsed = TaxRuleOverridesMapSchema.safeParse(
      (data as Record<string, unknown>).tax_rule_overrides || {}
    );
    if (parsed.success) overrides = parsed.data;
  }

  return { overrides, dbPersistenceAvailable };
}

async function persistUserTaxOverrides(
  userId: string,
  overrides: TaxRuleOverridesMap,
  req: NextRequest
): Promise<{ savedInDatabase: boolean; errorResponse?: ReturnType<typeof apiError> }> {
  const nowIso = new Date().toISOString();
  const { data: updatedRows, error: updateErr } = await supabaseAdmin
    .from("user_settings")
    .update({ tax_rule_overrides: overrides, updated_at: nowIso } as Record<string, unknown>)
    .eq("id", userId)
    .select("id");

  if (updateErr) {
    if (isMissingColumnError(updateErr)) return { savedInDatabase: false };
    logger.error("Failed to update user tax rule overrides", "TaxRulesAPI", updateErr, { userId });
    return {
      savedInDatabase: false,
      errorResponse: apiError(updateErr.message || "Failed to persist tax rules.", "DATABASE_ERROR", 500, undefined, req),
    };
  }
  if (updatedRows && updatedRows.length > 0) return { savedInDatabase: true };

  const { error: insertErr } = await supabaseAdmin.from("user_settings").insert({
    id: userId,
    name: "User",
    tax_rule_overrides: overrides,
    updated_at: nowIso,
  } as Record<string, unknown>);

  if (insertErr) {
    if (isMissingColumnError(insertErr)) return { savedInDatabase: false };
    logger.error("Failed to insert user tax rule overrides", "TaxRulesAPI", insertErr, { userId });
    return {
      savedInDatabase: false,
      errorResponse: apiError(insertErr.message || "Failed to persist tax rules.", "DATABASE_ERROR", 500, undefined, req),
    };
  }
  return { savedInDatabase: true };
}

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ req, userId }) => {
    const currentAy = getCurrentIndianAssessmentYear();
    const [{ overrides, dbPersistenceAvailable, errorResponse }, autoUpdateStatus] = await Promise.all([
      readUserTaxOverrides(userId!, req),
      getCachedAutoTaxRecord(currentAy),
    ]);
    if (errorResponse) return errorResponse;

    const currentOverride = overrides[currentAy] ?? autoUpdateStatus?.override ?? null;
    const currentPreset = getCurrentTaxYearPreset(currentOverride);

    return apiSuccess(
      {
        currentAssessmentYear: currentAy,
        currentPreset,
        overrides,
        autoUpdateStatus,
        dbPersistenceAvailable,
      },
      undefined,
      200,
      req
    );
  },
});

export const PUT = createApiRoute({
  auth: "required",
  rateLimit: { limit: 30, windowSeconds: 60 },
  schema: PutTaxRulesSchema,
  handler: async ({ req, userId, body }) => {
    const normalizedOverrides: TaxRuleOverridesMap = {};
    for (const [rawAy, rule] of Object.entries(body.overrides)) {
      normalizedOverrides[normalizeAssessmentYear(rawAy)] = rule;
    }

    const { savedInDatabase, errorResponse } = await persistUserTaxOverrides(userId!, normalizedOverrides, req);
    if (errorResponse) return errorResponse;

    const currentAy = getCurrentIndianAssessmentYear();
    return apiSuccess(
      {
        overrides: normalizedOverrides,
        currentPreset: resolveTaxYearPreset(currentAy, normalizedOverrides[currentAy]),
        savedInDatabase,
      },
      undefined,
      200,
      req
    );
  },
});

export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 15, windowSeconds: 60 },
  handler: async ({ req, userId }) => {
    const currentAy = getCurrentIndianAssessmentYear();
    const record = await checkAndAutoUpdateTaxRules({ force: true, assessmentYear: currentAy });
    let savedInDatabase = false;
    let updatedOverrides: TaxRuleOverridesMap | undefined;

    if (record.updated && record.override) {
      const { overrides, errorResponse } = await readUserTaxOverrides(userId!, req);
      if (errorResponse) return errorResponse;

      updatedOverrides = { ...overrides, [currentAy]: record.override };
      const persistRes = await persistUserTaxOverrides(userId!, updatedOverrides, req);
      if (persistRes.errorResponse) return persistRes.errorResponse;
      savedInDatabase = persistRes.savedInDatabase;
    }

    return apiSuccess(
      {
        record,
        currentPreset: resolveTaxYearPreset(currentAy, record.override),
        overrides: updatedOverrides,
        savedInDatabase,
      },
      undefined,
      200,
      req
    );
  },
});
