import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
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
export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const [holdingsRes, transactionsRes] = await Promise.all([
      supabaseAdmin
        .from("mutual_fund_holdings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("mutual_fund_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("transaction_date", { ascending: false })
        .limit(100),
    ]);

    if (holdingsRes.error) {
      console.error("[MF API] Error fetching holdings:", holdingsRes.error);
      return apiError(holdingsRes.error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return NextResponse.json(
      {
        success: true,
        holdings: holdingsRes.data || [],
        transactions: transactionsRes.data || [],
      },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch mutual fund holdings";
    console.error("[MF API] Unexpected error:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// POST: Add a new holding or average into an existing scheme holding
export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`mf_post:${userId}`, 60, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const body = await req.json();
    const parsed = AddMutualFundSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400, headers: { "X-Request-Id": requestId } }
      );
    }

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
    } = parsed.data;

    const actualInvested = reqInvested !== undefined ? reqInvested : +(units * avg_nav).toFixed(2);
    const actualCurrentNav = reqCurrentNav !== undefined ? reqCurrentNav : avg_nav;

    // Check if user already holds this scheme + folio (e.g. Zerodha Coin Demat holding)
    const { data: existingHolding } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .select("*")
      .eq("user_id", userId)
      .eq("scheme_code", scheme_code)
      .eq("folio_number", folio_number)
      .maybeSingle();

    let holdingId: string;
    let finalHolding: Record<string, unknown>;

    if (existingHolding) {
      // Average into existing holding
      const existingUnits = Number(existingHolding.units) || 0;
      const existingAvgNav = Number(existingHolding.avg_nav) || 0;
      const totalUnits = +(existingUnits + units).toFixed(4);

      // Weighted average NAV
      const newAvgNav =
        totalUnits > 0
          ? +((existingUnits * existingAvgNav + units * avg_nav) / totalUnits).toFixed(4)
          : avg_nav;
      const totalInvested = +(totalUnits * newAvgNav).toFixed(2);

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
        console.error("[MF API] Update holding error:", updateErr);
        return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = existingHolding.id;
      finalHolding = updated;
    } else {
      // Insert brand new holding
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("mutual_fund_holdings")
        .insert({
          user_id: userId,
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
        console.error("[MF API] Insert holding error:", insertErr);
        return apiError(insertErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = inserted.id;
      finalHolding = inserted;
    }

    // Automatically record the investment transaction
    const txType = is_sip_active ? "SIP" : "BUY";
    await supabaseAdmin.from("mutual_fund_transactions").insert({
      user_id: userId,
      holding_id: holdingId,
      scheme_code,
      scheme_name,
      type: txType,
      units,
      nav: avg_nav,
      amount: +(units * avg_nav).toFixed(2),
      transaction_date: transaction_date || new Date().toISOString().split("T")[0],
      notes: notes || (is_sip_active ? "Initial SIP investment" : "Lumpsum investment"),
    });

    return apiSuccess(finalHolding, undefined, 201, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create mutual fund holding";
    console.error("[MF API] Unexpected error:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// PUT: Update holding details
export async function PUT(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const body = await req.json();
    const parsed = UpdateMutualFundSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400, headers: { "X-Request-Id": requestId } }
      );
    }

    const { id, ...updates } = parsed.data;

    // Recalculate invested_amount if units or avg_nav changed and invested_amount not provided
    const updatePayload: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.units !== undefined && updates.avg_nav !== undefined && updates.invested_amount === undefined) {
      updatePayload.invested_amount = +(updates.units * updates.avg_nav).toFixed(2);
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateErr) {
      console.error("[MF API] Update error:", updateErr);
      return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return apiSuccess(updated, undefined, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update holding";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// DELETE: Delete a mutual fund holding
export async function DELETE(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return apiError("Holding ID is required", "BAD_REQUEST", 400, undefined, req);
  }

  try {
    const { error: delErr } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (delErr) {
      console.error("[MF API] Delete error:", delErr);
      return apiError(delErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return apiSuccess({ deletedId: id }, undefined, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete holding";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
