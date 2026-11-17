import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { z } from "zod";

const TransactionSchema = z.object({
  holding_id: z.string().uuid("Invalid holding ID"),
  metal: z.enum(["GOLD", "SILVER"]),
  type: z.enum(["BUY", "SELL"]),
  weight_grams: z.number().positive("Weight must be greater than 0"),
  price_per_gram: z.number().min(0, "Price per gram must be non-negative"),
  making_charges: z.number().min(0).default(0),
  tax_gst: z.number().min(0).default(0),
  total_amount: z.number().min(0).optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

// GET: Fetch bullion transaction history
export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  try {
    const { data, error } = await supabaseAdmin
      .from("bullion_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (error) {
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

// POST: Record a Buy or Sell transaction against a bullion holding
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
          error: parsed.error.issues[0]?.message || "Invalid transaction input",
          issues: parsed.error.issues,
        },
        { status: 400, headers: { "X-Request-Id": requestId } }
      );
    }

    const tx = parsed.data;

    // Verify holding exists and belongs to user
    const { data: holding, error: holdingError } = await supabaseAdmin
      .from("bullion_holdings")
      .select("*")
      .eq("id", tx.holding_id)
      .eq("user_id", userId)
      .single();

    if (holdingError || !holding) {
      return apiError("Holding not found or access denied", "NOT_FOUND", 404, undefined, req);
    }

    const calculatedTotal =
      tx.total_amount !== undefined
        ? tx.total_amount
        : +(tx.weight_grams * tx.price_per_gram + tx.making_charges + tx.tax_gst).toFixed(2);

    const txDate = tx.transaction_date || new Date().toISOString().split("T")[0];

    if (tx.type === "SELL") {
      const currentTotalWeight = holding.weight_grams * (holding.quantity || 1);
      if (tx.weight_grams > currentTotalWeight) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot sell ${tx.weight_grams}g. Current total holding is only ${currentTotalWeight}g.`,
          },
          { status: 400, headers: { "X-Request-Id": requestId } }
        );
      }

      // Record transaction
      const { data: createdTx, error: txError } = await supabaseAdmin
        .from("bullion_transactions")
        .insert({
          user_id: userId,
          holding_id: holding.id,
          metal: tx.metal,
          type: "SELL",
          weight_grams: tx.weight_grams,
          price_per_gram: tx.price_per_gram,
          making_charges: tx.making_charges,
          tax_gst: tx.tax_gst,
          total_amount: calculatedTotal,
          transaction_date: txDate,
          notes: tx.notes || `Sold ${tx.weight_grams}g of ${holding.name}`,
        })
        .select()
        .single();

      if (txError) {
        return apiError(txError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      // Update remaining weight
      const remainingWeight = currentTotalWeight - tx.weight_grams;
      if (remainingWeight <= 0.001) {
        // Complete liquidation: delete holding
        await supabaseAdmin.from("bullion_holdings").delete().eq("id", holding.id);
      } else {
        // Pro-rate remaining total buy price
        const fractionRemaining = remainingWeight / currentTotalWeight;
        const remainingBuyPrice = +(holding.total_buy_price * fractionRemaining).toFixed(2);

        await supabaseAdmin
          .from("bullion_holdings")
          .update({
            weight_grams: remainingWeight,
            quantity: 1, // Normalized to single remaining batch
            total_buy_price: remainingBuyPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", holding.id);
      }

      return NextResponse.json(
        {
          success: true,
          message: `Successfully recorded sale of ${tx.weight_grams}g`,
          transaction: createdTx,
        },
        { status: 201, headers: { "X-Request-Id": requestId } }
      );
    } else {
      // BUY transaction (additional purchase into existing holding)
      const currentTotalWeight = holding.weight_grams * (holding.quantity || 1);
      const newTotalWeight = currentTotalWeight + tx.weight_grams;
      const newTotalBuyPrice = +(holding.total_buy_price + calculatedTotal).toFixed(2);
      const newAvgBuyPrice = +(newTotalBuyPrice / newTotalWeight).toFixed(2);

      const { data: createdTx, error: txError } = await supabaseAdmin
        .from("bullion_transactions")
        .insert({
          user_id: userId,
          holding_id: holding.id,
          metal: tx.metal,
          type: "BUY",
          weight_grams: tx.weight_grams,
          price_per_gram: tx.price_per_gram,
          making_charges: tx.making_charges,
          tax_gst: tx.tax_gst,
          total_amount: calculatedTotal,
          transaction_date: txDate,
          notes: tx.notes || `Purchased additional ${tx.weight_grams}g for ${holding.name}`,
        })
        .select()
        .single();

      if (txError) {
        return apiError(txError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      await supabaseAdmin
        .from("bullion_holdings")
        .update({
          weight_grams: newTotalWeight,
          quantity: 1,
          buy_price_per_gram: newAvgBuyPrice,
          total_buy_price: newTotalBuyPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", holding.id);

      return NextResponse.json(
        {
          success: true,
          message: `Successfully recorded purchase of ${tx.weight_grams}g`,
          transaction: createdTx,
        },
        { status: 201, headers: { "X-Request-Id": requestId } }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
