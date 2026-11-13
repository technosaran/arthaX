import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { z } from "zod";

const CreateTransferSchema = z.object({
  from_account_id: z.string().uuid("Invalid source account ID"),
  to_account_id: z.string().uuid("Invalid destination account ID"),
  amount: z.number().positive("Transfer amount must be strictly greater than 0"),
  transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authError || "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("transfers")
      .select("*, from_account:accounts!from_account_id(name, type, last_four), to_account:accounts!to_account_id(name, type, last_four)", { count: "exact" })
      .eq("user_id", userId)
      .order("transfer_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query = query.gte("transfer_date", `${month}-01`).lte("transfer_date", `${month}-31`);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transfers";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authError || "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await req.json();
    const parseResult = CreateTransferSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { from_account_id, to_account_id, amount, transfer_date, notes } = parseResult.data;

    if (from_account_id === to_account_id) {
      return NextResponse.json(
        { success: false, error: "Source and destination accounts must be distinct." },
        { status: 400 }
      );
    }

    // Execute atomic stored procedure with row-locking on both accounts
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("fn_record_transfer_atomic", {
      p_user_id: userId,
      p_from_account_id: from_account_id,
      p_to_account_id: to_account_id,
      p_amount: amount,
      p_transfer_date: transfer_date,
      p_notes: notes || null,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
    }

    // Invalidate affected caches
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
      ]);
    } catch {
      // Non-blocking cache warning
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to execute transfer";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authError || "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const transferId = searchParams.get("id");

  if (!transferId || !/^[0-9a-fA-F-]{36}$/.test(transferId)) {
    return NextResponse.json({ success: false, error: "Missing or invalid transfer ID" }, { status: 400 });
  }

  try {
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("fn_delete_transfer_atomic", {
      p_transfer_id: transferId,
      p_user_id: userId,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
    }

    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
      ]);
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reverse transfer";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
