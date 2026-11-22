import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import {
  roundMoney,
  mulMoney,
} from "@/utils/money";
import { z } from "zod";

const AddMutualFundSchema = z.object({
  scheme_code: z.string().min(1, "Scheme code is required"),
  scheme_name: z.string().min(1, "Scheme name is required").max(300),
  fund_house: z.string().default("Other"),
  category: z.string().default("Equity"),
  sub_category: z.string().optional().nullable(),
  plan_type: z.enum(["Direct", "Regular"]).default("Direct"),
  dividend_option: z.enum(["Growth", "IDCW", "Bonus"]).default("Growth"),
  folio_number: z.string().default("COIN_DEMAT"),
  units: z.number().positive("Units must be greater than 0"),
  avg_nav: z.number().nonnegative("NAV must be non-negative"),
  invested_amount: z.number().nonnegative().optional(),
  current_nav: z.number().nonnegative().optional(),
  nav_date: z.string().optional().nullable(),
  isin: z.string().optional().nullable(),
  is_sip_active: z.boolean().default(false),
  sip_amount: z.number().min(0).default(0),
  sip_frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).default("MONTHLY"),
  sip_day: z.number().min(1).max(31).default(1),
  sip_step_up_percent: z.number().min(0).default(0),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const UpdateMutualFundSchema = z.object({
  id: z.string().uuid("Invalid holding ID"),
  scheme_name: z.string().min(1).max(300).optional(),
  fund_house: z.string().optional(),
  category: z.string().optional(),
  folio_number: z.string().optional(),
  units: z.number().min(0).optional(),
  avg_nav: z.number().min(0).optional(),
  invested_amount: z.number().min(0).optional(),
  current_nav: z.number().min(0).optional(),
  is_sip_active: z.boolean().optional(),
  sip_amount: z.number().min(0).optional(),
  sip_frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).optional(),
  sip_day: z.number().min(1).max(31).optional(),
  sip_step_up_percent: z.number().min(0).optional(),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// GET: Fetch all mutual fund holdings and transactions for the authenticated user
export const GET = createApiRoute({
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const [holdingsRes, transactionsRes] = await Promise.all([
      supabaseAdmin
        .from("mutual_fund_holdings")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("mutual_fund_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("transaction_date", { ascending: false })
        .limit(100),
    ]);

    if (holdingsRes.error) {
      return apiError(holdingsRes.error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return {
      holdings: holdingsRes.data || [],
      transactions: transactionsRes.data || [],
    };
  },
});

// POST: Add a new holding or average into an existing scheme holding
export const POST = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  idempotent: true,
  schema: AddMutualFundSchema,
  handler: async ({ userId, body, req }) => {
    const {
      scheme_code,
      scheme_name,
      fund_house,
      category,
      sub_category,
      plan_type,
      dividend_option,
      folio_number,
      units,
      avg_nav,
      invested_amount: reqInvested,
      current_nav: reqCurrentNav,
      nav_date,
      isin,
      is_sip_active,
      sip_amount,
      sip_frequency,
      sip_day,
      sip_step_up_percent,
      account_id,
      notes,
      transaction_date,
    } = body;

    const actualInvested = reqInvested !== undefined ? roundMoney(reqInvested) : roundMoney(mulMoney(units, avg_nav));
    const actualCurrentNav = reqCurrentNav !== undefined ? reqCurrentNav : avg_nav;

    const { data: existingHolding } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .select("*")
      .eq("user_id", userId!)
      .eq("scheme_code", scheme_code)
      .eq("folio_number", folio_number)
      .maybeSingle();

    let holdingId: string;
    let finalHolding: Record<string, unknown>;

    if (existingHolding) {
      const existingUnits = Number(existingHolding.units) || 0;
      const existingAvgNav = Number(existingHolding.avg_nav) || 0;
      const totalUnits = +(existingUnits + units).toFixed(4);

      const newAvgNav =
        totalUnits > 0
          ? +((existingUnits * existingAvgNav + units * avg_nav) / totalUnits).toFixed(4)
          : avg_nav;
      const totalInvested = roundMoney(mulMoney(totalUnits, newAvgNav));

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("mutual_fund_holdings")
        .update({
          units: totalUnits,
          avg_nav: newAvgNav,
          invested_amount: totalInvested,
          current_nav: actualCurrentNav,
          nav_date: nav_date || existingHolding.nav_date,
          is_sip_active: is_sip_active !== undefined ? is_sip_active : existingHolding.is_sip_active,
          sip_amount: sip_amount > 0 ? sip_amount : existingHolding.sip_amount,
          sip_frequency: sip_frequency || existingHolding.sip_frequency,
          sip_day: sip_day || existingHolding.sip_day,
          sip_step_up_percent: sip_step_up_percent || existingHolding.sip_step_up_percent,
          account_id: account_id || existingHolding.account_id,
          notes: notes || existingHolding.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingHolding.id)
        .select()
        .single();

      if (updateErr) {
        return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = existingHolding.id;
      finalHolding = updated;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("mutual_fund_holdings")
        .insert({
          user_id: userId!,
          scheme_code,
          scheme_name,
          fund_house,
          category,
          sub_category: sub_category || null,
          plan_type,
          dividend_option,
          folio_number,
          units,
          avg_nav,
          invested_amount: actualInvested,
          current_nav: actualCurrentNav,
          previous_nav: actualCurrentNav,
          nav_date: nav_date || new Date().toISOString().split("T")[0],
          isin: isin || null,
          is_sip_active,
          sip_amount,
          sip_frequency,
          sip_day,
          sip_step_up_percent,
          account_id: account_id || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (insertErr) {
        return apiError(insertErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = inserted.id;
      finalHolding = inserted;
    }

    // Automatically record investment transaction
    const txType = is_sip_active ? "SIP" : "BUY";
    await supabaseAdmin.from("mutual_fund_transactions").insert({
      user_id: userId!,
      holding_id: holdingId,
      scheme_code,
      scheme_name,
      type: txType,
      units,
      nav: avg_nav,
      amount: roundMoney(mulMoney(units, avg_nav)),
      transaction_date: transaction_date || new Date().toISOString().split("T")[0],
      notes: notes || (is_sip_active ? "Initial SIP investment" : "Lumpsum investment"),
    });

    await invalidateUserCaches(userId, ["MUTUAL_FUNDS", "PORTFOLIO", "ANALYTICS"]);

    return finalHolding;
  },
});

// PUT: Update holding details
export const PUT = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  schema: UpdateMutualFundSchema,
  handler: async ({ userId, body, req }) => {
    const { id, ...updates } = body;

    const updatePayload: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.units !== undefined && updates.avg_nav !== undefined && updates.invested_amount === undefined) {
      updatePayload.invested_amount = roundMoney(mulMoney(updates.units, updates.avg_nav));
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId!)
      .select()
      .single();

    if (updateErr) {
      return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["MUTUAL_FUNDS", "PORTFOLIO", "ANALYTICS"]);

    return updated;
  },
});

// DELETE: Delete a mutual fund holding
export const DELETE = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const id = query.get("id");

    if (!id) {
      return apiError("Holding ID is required", "BAD_REQUEST", 400, undefined, req);
    }

    const { error: delErr } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId!);

    if (delErr) {
      return apiError(delErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["MUTUAL_FUNDS", "PORTFOLIO", "ANALYTICS"]);

    return { deletedId: id };
  },
});
