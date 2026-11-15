import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";
import { z } from "zod";

const TransactionSchema = z.object({
  holding_id: z.string().uuid("Invalid holding ID"),
  type: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive("Quantity must be greater than 0"),
  price: z.number().positive("Price must be greater than 0"),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  brokerage_charges: z.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const body = await req.json();
    const parsed = TransactionSchema.safeParse(body);

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

    const { holding_id, type, quantity, price, transaction_date, brokerage_charges, notes } =
      parsed.data;

    // Fetch holding
    const { data: holding, error: holdingErr } = await supabaseAdmin
      .from("stock_holdings")
      .select("*")
      .eq("id", holding_id)
      .eq("user_id", userId)
      .single();

    if (holdingErr || !holding) {
      return apiError("Stock holding not found", "NOT_FOUND", 404, undefined, req);
    }

    const currentQty = Number(holding.quantity) || 0;
    const currentAvg = Number(holding.avg_buy_price) || 0;
    let newQty: number;
    let newAvgPrice: number = currentAvg;
    let realizedPnL: number | null = null;

    if (type === "BUY") {
      newQty = currentQty + quantity;
      newAvgPrice = +((currentQty * currentAvg + quantity * price) / newQty).toFixed(2);
    } else {
      // SELL transaction
      if (quantity > currentQty) {
        return apiError(
          `Cannot sell ${quantity} shares. You currently own only ${currentQty} shares.`,
          "BAD_REQUEST",
          400,
          undefined,
          req
        );
      }
      newQty = currentQty - quantity;
      // Realized profit calculation
      realizedPnL = +((price - currentAvg) * quantity - brokerage_charges).toFixed(2);
    }

    // Update holding quantity and avg price
    const { error: updateErr } = await supabaseAdmin
      .from("stock_holdings")
      .update({
        quantity: newQty,
        avg_buy_price: newAvgPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", holding_id)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("[Stock Txn] Error updating holding:", updateErr);
      return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    // Insert transaction
    const { data: txn, error: insertErr } = await supabaseAdmin
      .from("stock_transactions")
      .insert({
        user_id: userId,
        holding_id,
        symbol: holding.symbol,
        exchange: holding.exchange,
        type,
        quantity,
        price,
        brokerage_charges,
        transaction_date: transaction_date || new Date().toISOString().split("T")[0],
        notes:
          notes ||
          (type === "SELL"
            ? `Sold ${quantity} shares at ₹${price}. Realized P&L: ₹${realizedPnL}`
            : `Bought ${quantity} shares at ₹${price}`),
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[Stock Txn] Insert error:", insertErr);
      return apiError(insertErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return apiSuccess(
      {
        transaction: txn,
        updatedHolding: {
          id: holding_id,
          quantity: newQty,
          avg_buy_price: newAvgPrice,
        },
        realizedPnL,
      },
      undefined,
      200,
      req
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
