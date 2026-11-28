import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiError, apiNotFound, apiSuccess } from "@/utils/apiResponse";
import { calculateZerodhaCharges } from "@/utils/fnoCalculations";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { isValidUuid } from "@/lib/backend/queryParams";
import { z } from "zod";

// Validation schemas for F&O positions
const AddFnoPositionSchema = z.object({
  symbol: z.string().min(1, "Underlying symbol is required").max(30),
  instrument_type: z.enum(["CE", "PE", "FUT"]),
  strike_price: z.number().positive().optional().nullable(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry must be YYYY-MM-DD"),
  side: z.enum(["BUY", "SELL"]),
  product: z.enum(["NRML", "MIS", "CNC"]).default("NRML"),
  lot_size: z.number().int().positive().default(25),
  lots: z.number().positive().default(1),
  avg_price: z.number().nonnegative("Entry price must be non-negative"),
  target_price: z.number().positive().optional().nullable(),
  stop_loss: z.number().positive().optional().nullable(),
  strategy_name: z.string().max(100).default("Naked Position"),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const UpdateFnoPositionSchema = z.object({
  id: z.string().uuid("Invalid position ID"),
  target_price: z.number().positive().optional().nullable(),
  stop_loss: z.number().positive().optional().nullable(),
  strategy_name: z.string().max(100).optional(),
  notes: z.string().max(500).optional().nullable(),
});

const SquareOffPositionSchema = z.object({
  id: z.string().uuid("Invalid position ID"),
  exit_price: z.number().nonnegative("Exit price must be non-negative"),
  notes: z.string().max(500).optional().nullable(),
});

// GET: Fetch all open & closed F&O positions + trade history
export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const [positionsRes, tradesRes] = await Promise.all([
      supabaseAdmin
        .from("fno_positions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("fno_trades")
        .select("*")
        .eq("user_id", userId!)
        .order("trade_date", { ascending: false })
        .limit(100),
    ]);

    if (positionsRes.error) {
      console.error("[F&O API] Error fetching positions:", positionsRes.error);
      return apiError(positionsRes.error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return apiSuccess(
      {
        positions: positionsRes.data || [],
        trades: tradesRes.data || [],
      },
      undefined,
      200,
      req
    );
  },
});

// POST: Add new F&O position (or log contract entry)
export const POST = createApiRoute({
  auth: "required",
  rateLimit: { limit: 30, windowSeconds: 60 },
  idempotent: true,
  handler: async ({ userId, req }) => {
    const body = await req.json();
    const parsed = AddFnoPositionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message || "Validation failed",
        "BAD_REQUEST",
        400,
        parsed.error.format(),
        req
      );
    }

    const data = parsed.data;
    const cleanSymbol = data.symbol.trim().toUpperCase();
    const totalQuantity = +(data.lots * data.lot_size).toFixed(2);

    if (data.instrument_type !== "FUT" && (!data.strike_price || data.strike_price <= 0)) {
      return apiError("Option contracts (CE/PE) require a valid strike price", "BAD_REQUEST", 400, undefined, req);
    }

    // 1. Calculate Zerodha entry charges
    const entryCharges = calculateZerodhaCharges(
      data.instrument_type,
      data.side,
      totalQuantity,
      data.avg_price
    );

    // 2. Insert position into fno_positions
    const { data: newPosition, error: posError } = await supabaseAdmin
      .from("fno_positions")
      .insert({
        user_id: userId!,
        symbol: cleanSymbol,
        instrument_type: data.instrument_type,
        strike_price: data.instrument_type === "FUT" ? null : data.strike_price,
        expiry_date: data.expiry_date,
        side: data.side,
        product: data.product,
        lot_size: data.lot_size,
        lots: data.lots,
        quantity: totalQuantity,
        avg_price: data.avg_price,
        ltp: data.avg_price,
        status: "OPEN",
        target_price: data.target_price || null,
        stop_loss: data.stop_loss || null,
        strategy_name: data.strategy_name || "Naked Position",
        account_id: data.account_id || null,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (posError) {
      console.error("[F&O API] Insert error:", posError);
      return apiError(posError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    // 3. Log initial entry in fno_trades
    await supabaseAdmin.from("fno_trades").insert({
      user_id: userId!,
      position_id: newPosition.id,
      symbol: cleanSymbol,
      instrument_type: data.instrument_type,
      strike_price: data.instrument_type === "FUT" ? null : data.strike_price,
      expiry_date: data.expiry_date,
      side: data.side,
      action: "ENTRY",
      quantity: totalQuantity,
      price: data.avg_price,
      brokerage: entryCharges.brokerage,
      exchange_charges: entryCharges.exchangeCharges,
      gst: entryCharges.gst,
      stt: entryCharges.stt,
      pnl: 0,
      notes: data.notes || `Initial ${data.side} entry via Zerodha Kite`,
    });

    await invalidateUserCaches(userId!, ["PORTFOLIO", "ANALYTICS"]);

    return apiSuccess(
      {
        position: newPosition,
        charges: entryCharges,
        message: `F&O contract ${cleanSymbol} ${data.instrument_type} logged successfully`,
      },
      undefined,
      201,
      req
    );
  },
});

// PUT: Square off position or update notes/targets
export const PUT = createApiRoute({
  auth: "required",
  rateLimit: { limit: 30, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const body = await req.json();

    // Check if this is a Square-Off action
    if (body.action === "SQUARE_OFF") {
      const parsedSquareOff = SquareOffPositionSchema.safeParse(body);
      if (!parsedSquareOff.success) {
        return apiError(
          parsedSquareOff.error.issues[0]?.message || "Validation failed",
          "BAD_REQUEST",
          400,
          parsedSquareOff.error.format(),
          req
        );
      }

      const { id, exit_price, notes } = parsedSquareOff.data;

      // Fetch existing position
      const { data: pos, error: fetchErr } = await supabaseAdmin
        .from("fno_positions")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId!)
        .single();

      if (fetchErr || !pos) {
        return apiError("Position not found or unauthorized", "NOT_FOUND", 404, undefined, req);
      }

      if (pos.status === "CLOSED") {
        return apiError("Position is already squared off and closed", "BAD_REQUEST", 400, undefined, req);
      }

      const exitSide = pos.side === "BUY" ? "SELL" : "BUY";
      const rawPnL =
        pos.side === "BUY"
          ? (exit_price - Number(pos.avg_price)) * Number(pos.quantity)
          : (Number(pos.avg_price) - exit_price) * Number(pos.quantity);

      const exitCharges = calculateZerodhaCharges(
        pos.instrument_type,
        exitSide,
        Number(pos.quantity),
        exit_price
      );

      const netPnL = +(rawPnL - exitCharges.totalCharges).toFixed(2);

      // Update position to CLOSED
      const { data: updatedPos, error: updateErr } = await supabaseAdmin
        .from("fno_positions")
        .update({
          status: "CLOSED",
          exit_price,
          exit_date: new Date().toISOString(),
          ltp: exit_price,
          notes: notes || pos.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId!)
        .select()
        .single();

      if (updateErr) {
        return apiError(updateErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      }

      // Record EXIT trade log
      await supabaseAdmin.from("fno_trades").insert({
        user_id: userId!,
        position_id: pos.id,
        symbol: pos.symbol,
        instrument_type: pos.instrument_type,
        strike_price: pos.strike_price,
        expiry_date: pos.expiry_date,
        side: exitSide,
        action: "EXIT",
        quantity: pos.quantity,
        price: exit_price,
        brokerage: exitCharges.brokerage,
        exchange_charges: exitCharges.exchangeCharges,
        gst: exitCharges.gst,
        stt: exitCharges.stt,
        pnl: netPnL,
        notes: notes || `Square-off exit on Zerodha Kite at ₹${exit_price}`,
      });

      await invalidateUserCaches(userId!, ["PORTFOLIO", "ANALYTICS"]);

      return apiSuccess(
        {
          position: updatedPos,
          realizedPnL: netPnL,
          charges: exitCharges,
          message: `Position squared off successfully. Realized Net P&L: ₹${netPnL >= 0 ? "+" : ""}${netPnL}`,
        },
        undefined,
        200,
        req
      );
    }

    // Otherwise, normal update of target/stop_loss/strategy
    const parsedUpdate = UpdateFnoPositionSchema.safeParse(body);
    if (!parsedUpdate.success) {
      return apiError("Invalid update payload", "BAD_REQUEST", 400, parsedUpdate.error.format(), req);
    }

    const { id, ...updateFields } = parsedUpdate.data;

    const { data: updated, error: err } = await supabaseAdmin
      .from("fno_positions")
      .update({
        ...updateFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId!)
      .select()
      .maybeSingle();

    if (err) {
      return apiError(err.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
    if (!updated) {
      return apiNotFound("Position not found or unauthorized", req);
    }

    await invalidateUserCaches(userId!, ["PORTFOLIO", "ANALYTICS"]);

    return apiSuccess({ position: updated, message: "Position updated" }, undefined, 200, req);
  },
});

// DELETE: Delete a position and associated trades
export const DELETE = createApiRoute({
  auth: "required",
  rateLimit: { limit: 30, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!isValidUuid(id)) {
      return apiError("Valid Position ID is required", "BAD_REQUEST", 400, undefined, req);
    }

    const { data: deleted, error: delErr } = await supabaseAdmin
      .from("fno_positions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId!)
      .select("id")
      .maybeSingle();

    if (delErr) {
      return apiError(delErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
    if (!deleted) {
      return apiNotFound("Position not found or unauthorized", req);
    }

    await invalidateUserCaches(userId!, ["PORTFOLIO", "ANALYTICS"]);

    return apiSuccess({ message: "Position deleted successfully" }, undefined, 200, req);
  },
});
