import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { invalidateCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
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
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authError || "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all"; // 'all' | 'expense' | 'income'
  const month = searchParams.get("month");       // 'YYYY-MM'
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

    if (expRes.error) return NextResponse.json({ success: false, error: expRes.error.message }, { status: 500 });
    if (incRes.error) return NextResponse.json({ success: false, error: incRes.error.message }, { status: 500 });

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

    return NextResponse.json({
      success: true,
      data: unifiedList.slice(0, limit),
      meta: {
        page,
        limit,
        total: (expRes.count || 0) + (incRes.count || 0),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transactions";
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
    const parseResult = TransactionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.format() },
        { status: 422 }
      );
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
      if (rpcErr) return NextResponse.json({ success: false, error: rpcErr.message }, { status: 500 });
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
      if (rpcErr) return NextResponse.json({ success: false, error: rpcErr.message }, { status: 500 });
      rpcResponse = result;
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

    return NextResponse.json({ success: true, data: rpcResponse }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json({ success: false, error: authError || "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type"); // 'expense' | 'income'

  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id) || !type || !["expense", "income"].includes(type)) {
    return NextResponse.json({ success: false, error: "Missing or invalid id / type parameters" }, { status: 400 });
  }

  try {
    let result: any;
    if (type === "expense") {
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_delete_expense_atomic", {
        p_expense_id: id,
        p_user_id: userId,
      });
      if (rpcErr) return NextResponse.json({ success: false, error: rpcErr.message }, { status: 500 });
      result = rpcResult;
    } else {
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_delete_income_atomic", {
        p_income_id: id,
        p_user_id: userId,
      });
      if (rpcErr) return NextResponse.json({ success: false, error: rpcErr.message }, { status: 500 });
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

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete transaction";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
