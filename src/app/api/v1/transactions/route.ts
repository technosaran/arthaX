import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiSuccess, apiError } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
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

function getMonthBounds(monthStr: string): { start: string; nextMonthStart: string } {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthNumStr, 10);
  const start = `${monthStr}-01`;
  const nextMonthStart = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, nextMonthStart };
}

export const GET = createApiRoute({
  rateLimit: { limit: 120, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const type = query.get("type") || "all"; // 'all' | 'expense' | 'income'
    const month = query.get("month"); // 'YYYY-MM'
    const accountId = query.get("account_id");
    const category = query.get("category");
    const search = query.get("search");
    const limit = Math.min(parseInt(query.get("limit") || "50", 10), 100);
    const page = Math.max(parseInt(query.get("page") || "1", 10), 1);
    const offset = (page - 1) * limit;

    type SupabaseListResult = { data: Record<string, unknown>[] | null; count: number | null; error: { message: string } | null };
    let expensesPromise: Promise<SupabaseListResult> = Promise.resolve({ data: [], count: 0, error: null });
    let incomePromise: Promise<SupabaseListResult> = Promise.resolve({ data: [], count: 0, error: null });

    if (type === "all" || type === "expense") {
      let expQuery = supabaseAdmin
        .from("expenses")
        .select("*, account:accounts(name, type, last_four, classification)", { count: "exact" })
        .eq("user_id", userId!)
        .order("expense_date", { ascending: false });

      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const { start, nextMonthStart } = getMonthBounds(month);
        expQuery = expQuery.gte("expense_date", start).lt("expense_date", nextMonthStart);
      }
      if (accountId) expQuery = expQuery.eq("account_id", accountId);
      if (category) expQuery = expQuery.eq("category", category);
      if (search) expQuery = expQuery.ilike("title", `%${search}%`);

      const queryStart = type === "all" ? 0 : offset;
      const queryEnd = type === "all" ? offset + limit - 1 : offset + limit - 1;
      expensesPromise = expQuery.range(queryStart, queryEnd) as unknown as Promise<SupabaseListResult>;
    }

    if (type === "all" || type === "income") {
      let incQuery = supabaseAdmin
        .from("income")
        .select("*, account:accounts(name, type, last_four, classification)", { count: "exact" })
        .eq("user_id", userId!)
        .order("received_date", { ascending: false });

      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const { start, nextMonthStart } = getMonthBounds(month);
        incQuery = incQuery.gte("received_date", start).lt("received_date", nextMonthStart);
      }
      if (accountId) incQuery = incQuery.eq("account_id", accountId);
      if (category) incQuery = incQuery.eq("category", category);
      if (search) incQuery = incQuery.ilike("title", `%${search}%`);

      const queryStart = type === "all" ? 0 : offset;
      const queryEnd = type === "all" ? offset + limit - 1 : offset + limit - 1;
      incomePromise = incQuery.range(queryStart, queryEnd) as unknown as Promise<SupabaseListResult>;
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

    unifiedList.sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime());

    const paginatedItems = type === "all" ? unifiedList.slice(offset, offset + limit) : unifiedList;

    return apiSuccess(
      paginatedItems,
      {
        page,
        limit,
        total: (expRes.count || 0) + (incRes.count || 0),
      },
      200,
      req
    );
  },
});

export const POST = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  idempotent: true,
  schema: TransactionSchema,
  handler: async ({ userId, body, req }) => {
    const data = body;
    let rpcResponse: unknown;

    if (data.type === "expense") {
      const { data: result, error: rpcErr } = await supabaseAdmin.rpc("fn_record_expense_atomic", {
        p_user_id: userId!,
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
        p_user_id: userId!,
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

    const monthPrefix = data.date.slice(0, 7);
    await invalidateUserCaches(
      userId,
      ["EXPENSES", "INCOME", "ACCOUNTS", "PORTFOLIO", "LEDGER", "BUDGETS", "ANALYTICS"],
      { monthPrefix }
    );

    return apiSuccess(rpcResponse, undefined, 201, req);
  },
});

export const DELETE = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, query, req }) => {
    const id = query.get("id");
    const type = query.get("type"); // 'expense' | 'income'

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id) || !type || !["expense", "income"].includes(type)) {
      return apiError("Missing or invalid id / type parameters", "BAD_REQUEST", 400, undefined, req);
    }

    let result: unknown;
    if (type === "expense") {
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_delete_expense_atomic", {
        p_expense_id: id,
        p_user_id: userId!,
      });
      if (rpcErr) return apiError(rpcErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      result = rpcResult;
    } else {
      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("fn_delete_income_atomic", {
        p_income_id: id,
        p_user_id: userId!,
      });
      if (rpcErr) return apiError(rpcErr.message, "INTERNAL_SERVER_ERROR", 500, undefined, req);
      result = rpcResult;
    }

    await invalidateUserCaches(userId, [
      "EXPENSES",
      "INCOME",
      "ACCOUNTS",
      "PORTFOLIO",
      "LEDGER",
      "BUDGETS",
      "ANALYTICS",
    ]);

    return result;
  },
});
