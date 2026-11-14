import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { apiSuccess, apiError, apiUnauthorized, apiValidationError, extractRequestId } from "@/utils/apiResponse";
import { rateLimit, checkAndSetIdempotency } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";
import { z } from "zod";

const CreateTransferSchema = z.object({
  from_account_id: z.string().uuid("Invalid source account ID"),
  to_account_id: z.string().uuid("Invalid destination account ID"),
  amount: z.number().positive("Transfer amount must be strictly greater than 0"),
  transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`transfers_get:${userId}`, 100, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
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
      return apiError(error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    return apiSuccess(
      data || [],
      {
        page,
        limit,
        total: count || 0,
      },
      200,
      req
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transfers";
    logger.error("Failed to fetch transfers", "TransfersAPI", err, { userId, requestId });
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

export async function POST(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Idempotency support
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const isFirst = await checkAndSetIdempotency(`transfer:${userId}:${idempotencyKey}`, 86400);
    if (!isFirst) {
      return NextResponse.json(
        { success: false, error: "Duplicate transfer request rejected", requestId },
        { status: 409, headers: { "X-Request-Id": requestId } }
      );
    }
  }

  const rl = await rateLimit(`transfers_post:${userId}`, 30, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please wait a moment before transferring.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = CreateTransferSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return apiValidationError(parseResult.error.format(), "Validation failed", req);
    }

    const { from_account_id, to_account_id, amount, transfer_date, notes } = parseResult.data;

    if (from_account_id === to_account_id) {
      return NextResponse.json(
        { success: false, error: "Source and destination accounts must be distinct.", requestId },
        { status: 400, headers: { "X-Request-Id": requestId } }
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
      return apiError(rpcError.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }

    // Invalidate affected caches
    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, `analytics:${transfer_date.slice(0, 7)}`),
      ]);
    } catch {}

    logger.info(`Transfer recorded: ${amount} from ${from_account_id} to ${to_account_id}`, "TransfersAPI", { userId });

    return apiSuccess(result, undefined, 201, req);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record transfer";
    logger.error("Failed to record transfer", "TransfersAPI", err, { userId, requestId });
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
