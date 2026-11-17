import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiUnauthorized, apiError, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
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
export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit: 120 req/min
  const rl = await rateLimit(`bullion:get:${userId}`, 120, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please try again shortly." },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const [holdingsRes, transactionsRes] = await Promise.all([
      supabaseAdmin
        .from("bullion_holdings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("bullion_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("transaction_date", { ascending: false })
        .limit(100),
    ]);

    if (holdingsRes.error) {
      console.error("[Bullion Holdings GET Error]:", holdingsRes.error);
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
    const msg = err instanceof Error ? err.message : "Failed to fetch bullion portfolio";
    console.error("[Bullion Holdings GET Unexpected]:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// POST: Add new bullion holding and record initial buy transaction
export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const body = await req.json();
    const parsed = AddBullionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid input data",
          issues: parsed.error.issues,
        },
        { status: 400, headers: { "X-Request-Id": requestId } }
      );
    }

    const item = parsed.data;
    const metal = item.metal as MetalType;
    const purityPercentage =
      item.purity_percentage ?? getStandardPurityPercentage(metal, item.purity);

    const totalWeight = item.weight_grams * item.quantity;
    const calculatedTotalBuy =
      item.total_buy_price !== undefined
        ? item.total_buy_price
        : +(totalWeight * item.buy_price_per_gram + item.making_charges + item.tax_gst).toFixed(2);

    const purchaseDate = item.purchase_date || new Date().toISOString().split("T")[0];

    // 1. Insert into bullion_holdings
    const { data: holdingData, error: holdingError } = await supabaseAdmin
      .from("bullion_holdings")
      .insert({
        user_id: userId,
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
        purchase_date: purchaseDate,
        storage_location: item.storage_location.trim(),
        cert_id: item.cert_id?.trim() || null,
        account_id: item.account_id || null,
        notes: item.notes?.trim() || null,
      })
      .select()
      .single();

    if (holdingError || !holdingData) {
      console.error("[Bullion Insert Error]:", holdingError);
      return apiError(holdingError?.message || "Failed to create bullion holding", "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    // 2. Automatically log corresponding BUY transaction
    await supabaseAdmin.from("bullion_transactions").insert({
      user_id: userId,
      holding_id: holdingData.id,
      metal,
      type: "BUY",
      weight_grams: totalWeight,
      price_per_gram: item.buy_price_per_gram,
      making_charges: item.making_charges,
      tax_gst: item.tax_gst,
      total_amount: calculatedTotalBuy,
      transaction_date: purchaseDate,
      notes: `Initial purchase recorded for ${item.name}`,
    });

    return NextResponse.json(
      {
        success: true,
        message: `${metal === "GOLD" ? "Gold" : "Silver"} asset added successfully`,
        holding: holdingData,
      },
      { status: 201, headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add bullion asset";
    console.error("[Bullion POST Unexpected]:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// PUT: Update an existing bullion holding
export async function PUT(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  try {
    const body = await req.json();
    const parsed = UpdateBullionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid update data",
          issues: parsed.error.issues,
        },
        { status: 400, headers: { "X-Request-Id": requestId } }
      );
    }

    const { id, ...updates } = parsed.data;

    // Verify ownership
    const { data: existing, error: findError } = await supabaseAdmin
      .from("bullion_holdings")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (findError || !existing) {
      return apiError("Holding not found or access denied", "NOT_FOUND", 404, undefined, req);
    }

    // Recalculate purity percentage if purity changed
    const metal = (updates.metal || existing.metal) as MetalType;
    let purityPercentage = updates.purity_percentage ?? existing.purity_percentage;
    if (updates.purity && !updates.purity_percentage) {
      purityPercentage = getStandardPurityPercentage(metal, updates.purity);
    }

    // Recalculate total buy price if weight or price changed
    const weight = updates.weight_grams ?? existing.weight_grams;
    const qty = updates.quantity ?? existing.quantity;
    const pricePerGram = updates.buy_price_per_gram ?? existing.buy_price_per_gram;
    const makingCharges = updates.making_charges ?? existing.making_charges;
    const taxGst = updates.tax_gst ?? existing.tax_gst;

    const totalBuyPrice =
      updates.total_buy_price !== undefined
        ? updates.total_buy_price
        : +(weight * qty * pricePerGram + makingCharges + taxGst).toFixed(2);

    const { data: updatedHolding, error: updateError } = await supabaseAdmin
      .from("bullion_holdings")
      .update({
        ...updates,
        purity_percentage: purityPercentage,
        total_buy_price: totalBuyPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("[Bullion Update Error]:", updateError);
      return apiError(updateError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Holding updated successfully",
        holding: updatedHolding,
      },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update holding";
    console.error("[Bullion PUT Unexpected]:", err);
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

// DELETE: Delete a bullion holding
export async function DELETE(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);

  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Holding ID is required" },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const { error: deleteError } = await supabaseAdmin
      .from("bullion_holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("[Bullion DELETE Error]:", deleteError);
      return apiError(deleteError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return NextResponse.json(
      { success: true, message: "Bullion asset deleted successfully" },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete holding";
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
