import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { apiSuccess, apiError, apiUnauthorized, apiValidationError, extractRequestId } from "@/utils/apiResponse";
import { rateLimit, checkAndSetIdempotency } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";
import { z } from "zod";

const TransactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  title: z.string().min(1, "Title is required").max(150),
  amount: z.number().positive("Amount must be strictly greater than 0"),
  category: z.string().min(1, "Category is required"),
  account_id: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  frequency: z.string().default("Monthly"), // for income
  notes: z.string().max(500).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit queries
  const rl = await rateLimit(`txn_get:${userId}`, 120, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all"; // 'all' | 'expense' | 'income'
  const month = searchParams.get("month"); // 'YYYY-MM'
  const accountId = searchParams.get("account_id");
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const offset = (page - 1) * limit;

  try {
    let expensesPromise = Promise.resolve({ data: [] as any[], count: 0, error: null as any });
    let incomePromise = Promise.resolve({ data: [] as any[], count: 0, error: null as any });

    if (type === "all" || type === "expense") {
      let expQuery = supabaseAdmin
        .from("expenses")
        .select("*, account:accounts(name, type, last_four, classification)", { count: "exact" })
        .eq("user_id", userId)
        .order("expense_date", { ascending: false });

      if (month && /^\d{4}-\d{2}$/.test(month)) {
        expQuery = expQuery.gte("expense_date", `${month}-01`).lte("expense_date", `${month}-31`);
      }
      if (accountId) expQuery = expQuery.eq("account_id", accountId);
      if (category) expQuery = expQuery.eq("category", category);
      if (search) expQuery = expQuery.ilike("title", `%${search}%`);

      expensesPromise = expQuery.range(offset, offset + limit - 1) as any;
    }

    if (type === "all" || type === "income") {
      let incQuery = supabaseAdmin
        .from("income")
        .select("*, account:accounts(name, type, last_four, classification)", { count: "exact" })
        .eq("user_id", userId)
        .order("received_date", { ascending: false });

      if (month && /^\d{4}-\d{2}$/.test(month)) {
        incQuery = incQuery.gte("received_date", `${month}-01`).lte("received_date", `${month}-31`);
      }
      if (accountId) incQuery = incQuery.eq("account_id", accountId);
      if (category) incQuery = incQuery.eq("category", category);
      if (search) incQuery = incQuery.ilike("title", `%${search}%`);

      incomePromise = incQuery.range(offset, offset + limit - 1) as any;
    }

    const [expRes, incRes] = await Promise.all([expensesPromise, incomePromise]);

    if (expRes.error) return apiError(expRes.error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    if (incRes.error) return apiError(incRes.error.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);

    const unifiedList = [
      ...(expRes.data || []).map((e) => ({
        ...e,
        entryType: "expense" as const,
        date: e.expense_date,
      })),
      ...(incRes.data || []).map((i) => ({
        ...i,
        entryType: "income" as const,
        date: i.received_date,
      })),
    ];

    unifiedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return apiSuccess(
      unifiedList.slice(0, limit),
      {
        page,
        limit,
        total: (expRes.count || 0) + (incRes.count || 0),
      },
      200,
      req
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transactions";
    logger.error("Transaction fetch error", "TransactionsAPI", err, { userId, requestId });
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
    const isFirstTime = await checkAndSetIdempotency(`txn:${userId}:${idempotencyKey}`, 86400);
    if (!isFirstTime) {
      return NextResponse.json(
        { success: false, error: "Duplicate transaction rejected (Idempotency conflict)", requestId },
        { status: 409, headers: { "X-Request-Id": requestId } }
      );
    }
  }

  // Rate limit creation
  const rl = await rateLimit(`txn_post:${userId}`, 60, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please wait a moment before logging again.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = TransactionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return apiValidationError(parseResult.error.format(), "Validation failed", req);
    }

    const data = parseResult.data;

    let rpcResponse: any;
    if (data.type === "expense") {
      const { data: result, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
        p_user_id: userId,
        p_title: data.title,
        p_amount: data.amount,
        p_category: data.category,
        p_account_id: data.account_id || null,
        p_expense_date: data.date,
        p_notes: data.notes || null,
        p_tags: data.tags || [],
      });
      if (rpcErr) return apiError(rpcErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      rpcResponse = result;
    } else {
      const { data: result, error: rpcErr } = await supabaseAdmin.rpc("fn_record_income_atomic", {
        p_user_id: userId,
        p_title: data.title,
        p_amount: data.amount,
        p_category: data.category,
        p_frequency: data.frequency || "Monthly",
        p_account_id: data.account_id || null,
        p_received_date: data.date,
        p_notes: data.notes || null,
        p_tags: data.tags || [],
      });
      if (rpcErr) return apiError(rpcErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      rpcResponse = result;
    }

    // Invalidate affected caches including analytics
    try {
      const monthPrefix = data.date.slice(0, 7);
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
        getUserCacheKey(userId, `analytics:${monthPrefix}`),
      ]);
    } catch {}

    return apiSuccess(rpcResponse, undefined, 201, req);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction";
    logger.error("Failed to record transaction", "TransactionsAPI", err, { userId, requestId });
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type"); // 'expense' | 'income'

  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id) || !type || !["expense", "income"].includes(type)) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid id / type parameters", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    let result: any;
    if (type === "expense") {
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_delete_expense_atomic", {
        p_expense_id: id,
        p_user_id: userId,
      });
      if (rpcErr) return apiError(rpcErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      result = rpcResult;
    } else {
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_delete_income_atomic", {
        p_income_id: id,
        p_user_id: userId,
      });
      if (rpcErr) return apiError(rpcErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      result = rpcResult;
    }

    try {
      await invalidateCachedData([
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
      ]);
    } catch {}

    return apiSuccess(result, undefined, 200, req);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete transaction";
    logger.error("Failed to delete transaction", "TransactionsAPI", err, { userId, requestId });
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
