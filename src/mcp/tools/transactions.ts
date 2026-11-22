/**
 * Transaction Query Tool for arthaX MCP Server
 * Queries expenses, income, and transfers across user accounts with flexible filters.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export interface TransactionFilters {
  type?: "all" | "expense" | "income" | "transfer";
  accountId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export async function handleQueryTransactions(
  db: SupabaseClient<Database>,
  userId: string,
  filters: TransactionFilters = {}
) {
  const targetType = filters.type || "all";
  const limit = Math.min(100, Math.max(1, filters.limit || 20));

  const results: any[] = [];

  if (targetType === "all" || targetType === "expense") {
    let q = db
      .from("expenses")
      .select("id, title, amount, category, expense_date, notes, account_id, created_at")
      .eq("user_id", userId);

    if (filters.accountId) q = q.eq("account_id", filters.accountId);
    if (filters.category) q = q.eq("category", filters.category);
    if (filters.startDate) q = q.gte("expense_date", filters.startDate);
    if (filters.endDate) q = q.lte("expense_date", filters.endDate);

    const { data: expenses, error } = await q.order("expense_date", { ascending: false }).limit(limit);
    if (error) throw new Error(`Failed to query expenses: ${error.message}`);

    for (const exp of expenses || []) {
      results.push({
        id: exp.id,
        type: "EXPENSE",
        title: exp.title,
        amount: Number(exp.amount),
        category: exp.category,
        date: exp.expense_date,
        notes: exp.notes,
        accountId: exp.account_id,
        createdAt: exp.created_at,
      });
    }
  }

  if (targetType === "all" || targetType === "income") {
    let q = db
      .from("income")
      .select("id, title, amount, category, received_date, notes, account_id, created_at")
      .eq("user_id", userId);

    if (filters.accountId) q = q.eq("account_id", filters.accountId);
    if (filters.category) q = q.eq("category", filters.category);
    if (filters.startDate) q = q.gte("received_date", filters.startDate);
    if (filters.endDate) q = q.lte("received_date", filters.endDate);

    const { data: incomes, error } = await q.order("received_date", { ascending: false }).limit(limit);
    if (error) throw new Error(`Failed to query income: ${error.message}`);

    for (const inc of incomes || []) {
      results.push({
        id: inc.id,
        type: "INCOME",
        title: inc.title,
        amount: Number(inc.amount),
        category: inc.category,
        date: inc.received_date,
        notes: inc.notes,
        accountId: inc.account_id,
        createdAt: inc.created_at,
      });
    }
  }

  if ((targetType === "all" || targetType === "transfer") && !filters.category) {
    let q = db
      .from("transfers")
      .select("id, from_account_id, to_account_id, amount, transfer_date, notes, created_at")
      .eq("user_id", userId);

    if (filters.accountId) {
      q = q.or(`from_account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`);
    }
    if (filters.startDate) q = q.gte("transfer_date", filters.startDate);
    if (filters.endDate) q = q.lte("transfer_date", filters.endDate);

    const { data: transfers, error } = await q.order("transfer_date", { ascending: false }).limit(limit);
    if (error) throw new Error(`Failed to query transfers: ${error.message}`);

    for (const t of transfers || []) {
      results.push({
        id: t.id,
        type: "TRANSFER",
        title: `Transfer to ${t.to_account_id}`,
        amount: Number(t.amount),
        category: "Transfer",
        date: t.transfer_date,
        notes: t.notes,
        fromAccountId: t.from_account_id,
        toAccountId: t.to_account_id,
        createdAt: t.created_at,
      });
    }
  }

  // Sort consolidated by date desc and slice to limit
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const sliced = results.slice(0, limit);

  return {
    transactions: sliced,
    count: sliced.length,
    filters: {
      type: targetType,
      limit,
      category: filters.category,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
  };
}
