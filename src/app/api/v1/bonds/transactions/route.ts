import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { z } from "zod";

const RecordTransactionSchema = z.object({
  holding_id: z.string().uuid("Invalid bond holding ID"),
  type: z.enum(["BUY", "SELL", "COUPON_PAYOUT", "MATURITY_REDEMPTION"]),
  quantity: z.number().positive().default(1),
  price: z.number().nonnegative().default(0),
  amount: z.number().positive("Amount must be greater than 0"),
  platform: z.enum(["INDIABONDS", "GOLDENPI", "ZERODHA", "WINT_WEALTH", "OTHER"]).default("INDIABONDS"),
  demat_account_id: z.string().uuid().optional().nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().split("T")[0]),
  notes: z.string().max(500).optional().nullable(),
  auto_advance_next_coupon: z.boolean().default(true),
});

// GET: Fetch transactions with optional holding_id filter
export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const { searchParams } = new URL(req.url);
    const holdingId = searchParams.get("holding_id");

    let query = supabaseAdmin
      .from("bond_transactions")
      .select("*, bond_holdings(name, isin, issuer_name, coupon_rate, platform)")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    if (holdingId) {
      query = query.eq("holding_id", holdingId);
    }

    const { data, error } = await query;

    if (error) {
      return apiError(error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return NextResponse.json({ success: true, transactions: data || [] }, { headers: { "X-Request-Id": requestId } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch bond transactions";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// POST: Record a new transaction (Buy, Sell, Coupon Interest Received, or Maturity Redemption)
export async function POST(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const body = await req.json();
    const parsed = RecordTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || "Validation failed", "BAD_REQUEST", 400, undefined, req);
    }

    const {
      holding_id,
      type,
      quantity,
      price,
      amount,
      platform,
      demat_account_id,
      transaction_date,
      notes,
      auto_advance_next_coupon,
    } = parsed.data;

    // Verify holding exists
    const { data: holding, error: holdErr } = await supabaseAdmin
      .from("bond_holdings")
      .select("*")
      .eq("id", holding_id)
      .eq("user_id", userId)
      .single();

    if (holdErr || !holding) {
      return apiError("Bond holding not found", "NOT_FOUND", 404, undefined, req);
    }

    // Insert transaction
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("bond_transactions")
      .insert({
        user_id: userId,
        holding_id,
        isin: holding.isin,
        type,
        quantity,
        price,
        amount,
        platform: platform || holding.platform,
        demat_account_id: demat_account_id || holding.demat_account_id,
        transaction_date,
        notes,
      })
      .select()
      .single();

    if (txErr) {
      return apiError(txErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    // If Coupon Payout and auto_advance_next_coupon is true, calculate next coupon date
    if (type === "COUPON_PAYOUT" && auto_advance_next_coupon && holding.next_coupon_date) {
      const currentNext = new Date(holding.next_coupon_date);
      const freq = holding.coupon_frequency;

      if (freq === "MONTHLY") {
        currentNext.setMonth(currentNext.getMonth() + 1);
      } else if (freq === "QUARTERLY") {
        currentNext.setMonth(currentNext.getMonth() + 3);
      } else if (freq === "SEMI_ANNUAL") {
        currentNext.setMonth(currentNext.getMonth() + 6);
      } else if (freq === "ANNUAL") {
        currentNext.setFullYear(currentNext.getFullYear() + 1);
      }

      const nextIso = currentNext.toISOString().split("T")[0];
      await supabaseAdmin
        .from("bond_holdings")
        .update({
          next_coupon_date: nextIso,
          updated_at: new Date().toISOString(),
        })
        .eq("id", holding_id);
    }

    // If SELL, reduce holding quantity
    if (type === "SELL") {
      const currentQty = Number(holding.quantity) || 0;
      const remainingQty = Math.max(0, currentQty - quantity);
      const newInvested = remainingQty * (Number(holding.avg_buy_price) || 0);

      if (remainingQty === 0) {
        await supabaseAdmin.from("bond_holdings").delete().eq("id", holding_id);
      } else {
        await supabaseAdmin
          .from("bond_holdings")
          .update({
            quantity: remainingQty,
            invested_amount: Math.round(newInvested * 100) / 100,
            updated_at: new Date().toISOString(),
          })
          .eq("id", holding_id);
      }
    }

    try {
      await Promise.allSettled([
        invalidateCachedData(getUserCacheKey(userId, CACHE_KEYS.BONDS)),
        invalidateCachedData(getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO)),
      ]);
    } catch {}

    return apiSuccess({ message: "Transaction recorded successfully", transaction: tx }, undefined, 201, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record bond transaction";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
