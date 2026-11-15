import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, apiSuccess, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { z } from "zod";

const AddHoldingSchema = z.object({
  symbol: z.string().min(1, "Stock symbol is required").max(30),
  exchange: z.enum(["NSE", "BSE"]).default("NSE"),
  company_name: z.string().min(1, "Company name is required").max(200),
  sector: z.string().default("Other"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  avg_buy_price: z.number().nonnegative("Buy price must be non-negative"),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  target_price: z.number().positive().optional().nullable(),
  stop_loss: z.number().positive().optional().nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const UpdateHoldingSchema = z.object({
  id: z.string().uuid("Invalid holding ID"),
  company_name: z.string().min(1).max(200).optional(),
  sector: z.string().optional(),
  quantity: z.number().min(0).optional(),
  avg_buy_price: z.number().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
  target_price: z.number().positive().optional().nullable(),
  stop_loss: z.number().positive().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
});

// GET: Fetch all holdings and transactions for the authenticated user
export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const [holdingsRes, transactionsRes] = await Promise.all([
      supabaseAdmin
        .from("stock_holdings")
        .select("*")
        .eq("user_id", userId)
        .order("symbol", { ascending: true }),
      supabaseAdmin
        .from("stock_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("transaction_date", { ascending: false })
        .limit(100),
    ]);

    if (holdingsRes.error) {
      console.error("[Stocks API] Error fetching holdings:", holdingsRes.error);
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
    const msg = err instanceof Error ? err.message : "Failed to fetch stock holdings";
    console.error("[Stocks API] Unexpected error:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// POST: Add a new holding or average into an existing holding
export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`stocks_post:${userId}`, 60, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const body = await req.json();
    const parsed = AddHoldingSchema.safeParse(body);

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
      symbol,
      exchange,
      company_name,
      sector,
      quantity,
      avg_buy_price,
      account_id,
      notes,
      target_price,
      stop_loss,
      transaction_date,
    } = parsed.data;

    const cleanSymbol = symbol.trim().toUpperCase().replace(/\.(NS|BO)$/, "");

    // Check if user already holds this stock on this exchange
    const { data: existingHolding, error: fetchErr } = await supabaseAdmin
      .from("stock_holdings")
      .select("*")
      .eq("user_id", userId)
      .eq("symbol", cleanSymbol)
      .eq("exchange", exchange)
      .maybeSingle();

    if (fetchErr) {
      console.error("[Stocks API] Error checking existing holding:", fetchErr);
      return apiError(fetchErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    let holdingId: string;
    let finalQty: number;
    let finalAvgPrice: number;

    if (existingHolding) {
      // Calculate weighted average price
      const existingQty = Number(existingHolding.quantity) || 0;
      const existingAvg = Number(existingHolding.avg_buy_price) || 0;
      const newTotalQty = existingQty + quantity;

      if (newTotalQty > 0) {
        finalAvgPrice = +((existingQty * existingAvg + quantity * avg_buy_price) / newTotalQty).toFixed(2);
      } else {
        finalAvgPrice = avg_buy_price;
      }
      finalQty = newTotalQty;

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("stock_holdings")
        .update({
          quantity: finalQty,
          avg_buy_price: finalAvgPrice,
          company_name: company_name || existingHolding.company_name,
          sector: sector || existingHolding.sector,
          notes: notes !== undefined ? notes : existingHolding.notes,
          target_price: target_price !== undefined ? target_price : existingHolding.target_price,
          stop_loss: stop_loss !== undefined ? stop_loss : existingHolding.stop_loss,
          account_id: account_id || existingHolding.account_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingHolding.id)
        .select()
        .single();

      if (updateErr) {
        console.error("[Stocks API] Update error:", updateErr);
        return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = existingHolding.id;
    } else {
      // Create new holding
      finalQty = quantity;
      finalAvgPrice = avg_buy_price;

      const { data: created, error: createErr } = await supabaseAdmin
        .from("stock_holdings")
        .insert({
          user_id: userId,
          symbol: cleanSymbol,
          exchange,
          company_name,
          sector: sector || "Other",
          quantity: finalQty,
          avg_buy_price: finalAvgPrice,
          account_id: account_id || null,
          notes: notes || null,
          target_price: target_price || null,
          stop_loss: stop_loss || null,
        })
        .select()
        .single();

      if (createErr) {
        console.error("[Stocks API] Create error:", createErr);
        return apiError(createErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = created.id;
    }

    // Record BUY transaction in stock_transactions ledger
    await supabaseAdmin.from("stock_transactions").insert({
      user_id: userId,
      holding_id: holdingId,
      symbol: cleanSymbol,
      exchange,
      type: "BUY",
      quantity,
      price: avg_buy_price,
      transaction_date: transaction_date || new Date().toISOString().split("T")[0],
      notes: notes || `Manual purchase of ${quantity} shares at ₹${avg_buy_price}`,
    });

    return apiSuccess(
      {
        holdingId,
        symbol: cleanSymbol,
        exchange,
        quantity: finalQty,
        avg_buy_price: finalAvgPrice,
        message: existingHolding
          ? `Added to existing holding. New average: ₹${finalAvgPrice}`
          : `Holding created successfully for ${cleanSymbol}`,
      },
      undefined,
      200,
      req
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record stock holding";
    console.error("[Stocks API] Exception:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// PUT: Update holding details (notes, targets, manual edit)
export async function PUT(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const body = await req.json();
    const parsed = UpdateHoldingSchema.safeParse(body);

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

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("stock_holdings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateErr) {
      console.error("[Stocks API] Update error:", updateErr);
      return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return apiSuccess(updated, undefined, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update holding";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// DELETE: Delete a holding
export async function DELETE(req: NextRequest) {
  const requestId = extractRequestId(req);
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
    // Foreign key with ON DELETE CASCADE will clean up stock_transactions automatically
    const { error: delErr } = await supabaseAdmin
      .from("stock_holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (delErr) {
      console.error("[Stocks API] Delete error:", delErr);
      return apiError(delErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return apiSuccess({ deletedId: id }, undefined, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete holding";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
