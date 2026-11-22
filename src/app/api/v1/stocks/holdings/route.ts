import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import {
  roundMoney,
  addMoney,
  mulMoney,
  divMoney,
} from "@/utils/money";
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
export const GET = createApiRoute({
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const [holdingsRes, transactionsRes] = await Promise.all([
      supabaseAdmin
        .from("stock_holdings")
        .select("*")
        .eq("user_id", userId!)
        .order("symbol", { ascending: true }),
      supabaseAdmin
        .from("stock_transactions")
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

// POST: Add a new holding or average into an existing holding
export const POST = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  idempotent: true,
  schema: AddHoldingSchema,
  handler: async ({ userId, body, req }) => {
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
    } = body;

    const cleanSymbol = symbol.trim().toUpperCase().replace(/\.(NS|BO)$/, "");

    // Check if user already holds this stock on this exchange
    const { data: existingHolding, error: fetchErr } = await supabaseAdmin
      .from("stock_holdings")
      .select("*")
      .eq("user_id", userId!)
      .eq("symbol", cleanSymbol)
      .eq("exchange", exchange)
      .maybeSingle();

    if (fetchErr) {
      return apiError(fetchErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    let holdingId: string;
    let finalQty: number;
    let finalAvgPrice: number;

    if (existingHolding) {
      const existingQty = Number(existingHolding.quantity) || 0;
      const existingAvg = Number(existingHolding.avg_buy_price) || 0;
      const newTotalQty = existingQty + quantity;

      if (newTotalQty > 0) {
        finalAvgPrice = roundMoney(
          divMoney(
            addMoney(mulMoney(existingQty, existingAvg), mulMoney(quantity, avg_buy_price)),
            newTotalQty
          )
        );
      } else {
        finalAvgPrice = avg_buy_price;
      }
      finalQty = newTotalQty;

      const { error: updateErr } = await supabaseAdmin
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
        return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = existingHolding.id;
    } else {
      finalQty = quantity;
      finalAvgPrice = avg_buy_price;

      const { data: created, error: createErr } = await supabaseAdmin
        .from("stock_holdings")
        .insert({
          user_id: userId!,
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
        return apiError(createErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      holdingId = created.id;
    }

    // Record BUY transaction in stock_transactions ledger
    await supabaseAdmin.from("stock_transactions").insert({
      user_id: userId!,
      holding_id: holdingId,
      symbol: cleanSymbol,
      exchange,
      type: "BUY",
      quantity,
      price: avg_buy_price,
      transaction_date: transaction_date || new Date().toISOString().split("T")[0],
      notes: notes || `Manual purchase of ${quantity} shares at ₹${avg_buy_price}`,
    });

    // Invalidate caches across stocks, portfolio, and analytics
    await invalidateUserCaches(userId, ["STOCKS", "PORTFOLIO", "ANALYTICS"]);

    return {
      holdingId,
      symbol: cleanSymbol,
      exchange,
      quantity: finalQty,
      avg_buy_price: finalAvgPrice,
      message: existingHolding
        ? `Added to existing holding. New average: ₹${finalAvgPrice}`
        : `Holding created successfully for ${cleanSymbol}`,
    };
  },
});

// PUT: Update holding details (notes, targets, manual edit)
export const PUT = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  schema: UpdateHoldingSchema,
  handler: async ({ userId, body, req }) => {
    const { id, ...updates } = body;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("stock_holdings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId!)
      .select()
      .single();

    if (updateErr) {
      return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["STOCKS", "PORTFOLIO", "ANALYTICS"]);

    return updated;
  },
});

// DELETE: Delete a holding
export const DELETE = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const id = query.get("id");

    if (!id) {
      return apiError("Holding ID is required", "BAD_REQUEST", 400, undefined, req);
    }

    const { error: delErr } = await supabaseAdmin
      .from("stock_holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId!);

    if (delErr) {
      return apiError(delErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["STOCKS", "PORTFOLIO", "ANALYTICS"]);

    return { deletedId: id };
  },
});
