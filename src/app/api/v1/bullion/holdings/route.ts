import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import {
  roundMoney,
  addMoney,
  mulMoney,
} from "@/utils/money";
import { z } from "zod";
import { getStandardPurityPercentage, MetalType, BullionItemType } from "@/utils/bullionCalculations";

const AddBullionSchema = z.object({
  metal: z.enum(["GOLD", "SILVER"]),
  name: z.string().min(1, "Asset name is required").max(200),
  item_type: z.enum(["COIN", "BAR", "JEWELRY", "SOVEREIGN", "BULLION", "UTENSIL", "OTHER"]).default("COIN"),
  purity: z.string().min(1, "Purity is required").max(20),
  purity_percentage: z.number().min(0.1).max(100).optional(),
  weight_grams: z.number().positive("Weight must be greater than 0"),
  quantity: z.number().positive("Quantity must be greater than 0").default(1),
  buy_price_per_gram: z.number().min(0, "Buy price per gram cannot be negative"),
  making_charges: z.number().min(0).default(0),
  tax_gst: z.number().min(0).default(0),
  total_buy_price: z.number().min(0).optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  storage_location: z.string().min(1).default("Home Safe"),
  cert_id: z.string().max(100).optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const UpdateBullionSchema = z.object({
  id: z.string().uuid("Invalid asset ID"),
  metal: z.enum(["GOLD", "SILVER"]).optional(),
  name: z.string().min(1).max(200).optional(),
  item_type: z.enum(["COIN", "BAR", "JEWELRY", "SOVEREIGN", "BULLION", "UTENSIL", "OTHER"]).optional(),
  purity: z.string().min(1).max(20).optional(),
  purity_percentage: z.number().min(0.1).max(100).optional(),
  weight_grams: z.number().positive().optional(),
  quantity: z.number().positive().optional(),
  buy_price_per_gram: z.number().min(0).optional(),
  making_charges: z.number().min(0).optional(),
  tax_gst: z.number().min(0).optional(),
  total_buy_price: z.number().min(0).optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  storage_location: z.string().min(1).optional(),
  cert_id: z.string().max(100).optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// GET: Fetch all bullion holdings and recent transactions
export const GET = createApiRoute({
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const [holdingsRes, transactionsRes] = await Promise.all([
      supabaseAdmin
        .from("bullion_holdings")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("bullion_transactions")
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

// POST: Add new bullion holding and record initial buy transaction
export const POST = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  idempotent: true,
  schema: AddBullionSchema,
  handler: async ({ userId, body, req }) => {
    const item = body;
    const metal = item.metal as MetalType;
    const purityPercentage =
      item.purity_percentage ?? getStandardPurityPercentage(metal, item.purity);

    const totalWeight = mulMoney(item.weight_grams, item.quantity);
    const calculatedTotalBuy =
      item.total_buy_price !== undefined
        ? roundMoney(item.total_buy_price)
        : roundMoney(
            addMoney(
              addMoney(mulMoney(totalWeight, item.buy_price_per_gram), item.making_charges),
              item.tax_gst
            )
          );

    const purchaseDate = item.purchase_date || new Date().toISOString().split("T")[0];

    // 1. Insert into bullion_holdings
    const { data: holdingData, error: holdingError } = await supabaseAdmin
      .from("bullion_holdings")
      .insert({
        user_id: userId!,
        metal,
        name: item.name.trim(),
        item_type: item.item_type as BullionItemType,
        purity: item.purity.trim().toUpperCase(),
        purity_percentage: purityPercentage,
        weight_grams: item.weight_grams,
        quantity: item.quantity,
        buy_price_per_gram: item.buy_price_per_gram,
        making_charges: item.making_charges,
        tax_gst: item.tax_gst,
        total_buy_price: calculatedTotalBuy,
        storage_location: item.storage_location.trim(),
        cert_id: item.cert_id?.trim() || null,
        account_id: item.account_id || null,
        notes: item.notes?.trim() || null,
      })
      .select()
      .single();

    if (holdingError) {
      return apiError(holdingError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    // 2. Automatically record in bullion_transactions ledger
    await supabaseAdmin.from("bullion_transactions").insert({
      user_id: userId!,
      holding_id: holdingData.id,
      transaction_type: "BUY",
      metal,
      weight_grams: item.weight_grams * item.quantity,
      price_per_gram: item.buy_price_per_gram,
      total_amount: calculatedTotalBuy,
      making_charges: item.making_charges,
      tax_gst: item.tax_gst,
      payment_account_id: item.account_id || null,
      storage_location: item.storage_location.trim(),
      transaction_date: purchaseDate,
      notes: item.notes ? `Initial asset purchase: ${item.notes}` : "Initial asset purchase",
    });

    await invalidateUserCaches(userId, ["BULLION", "PORTFOLIO", "ANALYTICS"]);

    return {
      message: "Bullion asset recorded successfully",
      holding: holdingData,
    };
  },
});

// PUT: Update an existing bullion holding
export const PUT = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  schema: UpdateBullionSchema,
  handler: async ({ userId, body, req }) => {
    const { id, ...updates } = body;

    const { data: existing, error: findError } = await supabaseAdmin
      .from("bullion_holdings")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId!)
      .single();

    if (findError || !existing) {
      return apiError("Holding not found or access denied", "NOT_FOUND", 404, undefined, req);
    }

    const metal = (updates.metal || existing.metal) as MetalType;
    let purityPercentage = updates.purity_percentage ?? existing.purity_percentage;
    if (updates.purity && !updates.purity_percentage) {
      purityPercentage = getStandardPurityPercentage(metal, updates.purity);
    }

    const weight = updates.weight_grams ?? existing.weight_grams;
    const qty = updates.quantity ?? existing.quantity;
    const pricePerGram = updates.buy_price_per_gram ?? existing.buy_price_per_gram;
    const makingCharges = updates.making_charges ?? existing.making_charges;
    const taxGst = updates.tax_gst ?? existing.tax_gst;

    const totalBuyPrice =
      updates.total_buy_price !== undefined
        ? roundMoney(updates.total_buy_price)
        : roundMoney(
            addMoney(
              addMoney(mulMoney(mulMoney(weight, qty), pricePerGram), makingCharges),
              taxGst
            )
          );

    const { data: updatedHolding, error: updateError } = await supabaseAdmin
      .from("bullion_holdings")
      .update({
        ...updates,
        purity_percentage: purityPercentage,
        total_buy_price: totalBuyPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId!)
      .select()
      .single();

    if (updateError) {
      return apiError(updateError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["BULLION", "PORTFOLIO", "ANALYTICS"]);

    return {
      message: "Holding updated successfully",
      holding: updatedHolding,
    };
  },
});

// DELETE: Delete a bullion holding
export const DELETE = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const id = query.get("id");

    if (!id) {
      return apiError("Holding ID is required", "BAD_REQUEST", 400, undefined, req);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("bullion_holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId!);

    if (deleteError) {
      return apiError(deleteError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    await invalidateUserCaches(userId, ["BULLION", "PORTFOLIO", "ANALYTICS"]);

    return { message: "Bullion asset deleted successfully" };
  },
});
