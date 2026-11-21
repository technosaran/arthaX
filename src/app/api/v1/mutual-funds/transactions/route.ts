import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { rateLimit } from "@/utils/rateLimit";
import { z } from "zod";

const RecordTransactionSchema = z.object({
  holding_id: z.string().uuid("Invalid holding ID"),
  type: z.enum(["SIP", "BUY", "SELL", "SWITCH_IN", "SWITCH_OUT"]),
  units: z.number().positive("Units must be greater than 0"),
  nav: z.number().nonnegative("NAV must be non-negative"),
  amount: z.number().nonnegative().optional(),
  stamp_duty: z.number().min(0).default(0),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  notes: z.string().max(500).optional().nullable(),
});

// GET: Fetch mutual fund transactions
export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { searchParams } = new URL(req.url);
  const holdingId = searchParams.get("holding_id");

  try {
    let query = supabaseAdmin
      .from("mutual_fund_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    if (holdingId) {
      query = query.eq("holding_id", holdingId);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      console.error("[MF Transactions API] Fetch error:", error);
      return apiError(error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return NextResponse.json(
      { success: true, transactions: data || [] },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transactions";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// POST: Record a new transaction (SIP installment, Lumpsum Buy, or Sell/Redemption)
export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`mf_tx_post:${userId}`, 60, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const body = await req.json();
    const parsed = RecordTransactionSchema.safeParse(body);

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

    const { holding_id, type, units, nav, amount, stamp_duty, transaction_date, notes } = parsed.data;
    const computedAmount = amount !== undefined ? amount : +(units * nav).toFixed(2);

    // 1. Fetch current holding
    const { data: holding, error: holdErr } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .select("*")
      .eq("id", holding_id)
      .eq("user_id", userId)
      .single();

    if (holdErr || !holding) {
      return apiError("Holding not found or access denied", "NOT_FOUND", 404, undefined, req);
    }

    const currentUnits = Number(holding.units) || 0;
    const currentAvgNav = Number(holding.avg_nav) || 0;
    let newUnits = currentUnits;
    let newAvgNav = currentAvgNav;
    let realizedPnL: number | null = null;

    if (type === "SIP" || type === "BUY" || type === "SWITCH_IN") {
      // Accumulate units and recalculate weighted average NAV
      newUnits = +(currentUnits + units).toFixed(4);
      newAvgNav =
        newUnits > 0
          ? +((currentUnits * currentAvgNav + units * nav) / newUnits).toFixed(4)
          : nav;
    } else if (type === "SELL" || type === "SWITCH_OUT") {
      // Selling / Redemption check
      if (units > currentUnits + 0.0001) {
        return apiError(
          `Cannot redeem ${units} units. You currently hold ${currentUnits} units.`,
          "BAD_REQUEST",
          400,
          undefined,
          req
        );
      }

      newUnits = Math.max(0, +(currentUnits - units).toFixed(4));
      // Avg NAV remains unchanged on sale, but realized P&L is calculated
      realizedPnL = +((nav - currentAvgNav) * units - stamp_duty).toFixed(2);
    }

    const newInvestedAmount = +(newUnits * newAvgNav).toFixed(2);

    // 2. Insert transaction record
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("mutual_fund_transactions")
      .insert({
        user_id: userId,
        holding_id,
        scheme_code: holding.scheme_code,
        scheme_name: holding.scheme_name,
        type,
        units,
        nav,
        amount: computedAmount,
        stamp_duty,
        transaction_date,
        notes: notes || (type === "SIP" ? "SIP Installment" : type === "BUY" ? "Lumpsum purchase" : "Redemption"),
      })
      .select()
      .single();

    if (txErr) {
      console.error("[MF Transactions API] Insert error:", txErr);
      return apiError(txErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    // 3. Update holding
    const { data: updatedHolding, error: updateHoldErr } = await supabaseAdmin
      .from("mutual_fund_holdings")
      .update({
        units: newUnits,
        avg_nav: newAvgNav,
        invested_amount: newInvestedAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", holding_id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateHoldErr) {
      console.error("[MF Transactions API] Update holding error:", updateHoldErr);
      return apiError(updateHoldErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["MUTUAL_FUNDS", "PORTFOLIO", "ANALYTICS"]);

    return apiSuccess(
      {
        transaction: tx,
        holding: updatedHolding,
        realizedPnL,
      },
      undefined,
      201,
      req
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// DELETE: Delete a transaction
export async function DELETE(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return apiError("Transaction ID is required", "BAD_REQUEST", 400, undefined, req);
  }

  try {
    const { error: delErr } = await supabaseAdmin
      .from("mutual_fund_transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (delErr) {
      console.error("[MF Transactions API] Delete error:", delErr);
      return apiError(delErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["MUTUAL_FUNDS", "PORTFOLIO", "ANALYTICS"]);

    return apiSuccess({ deletedId: id }, undefined, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete transaction";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
