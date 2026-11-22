/**
 * Budget Status Tool for arthaX MCP Server
 * Compares defined budget limits with actual category expenditures.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export async function handleGetBudgets(
  db: SupabaseClient<Database>,
  userId: string,
  month?: string
) {
  const currentMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
  const startDate = `${currentMonth}-01`;
  const endDate = `${currentMonth}-31`;

  const [budgetsRes, expensesRes] = await Promise.all([
    db.from("budgets").select("*").eq("user_id", userId),
    db
      .from("expenses")
      .select("id, category, amount, expense_date")
      .eq("user_id", userId)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate),
  ]);

  if (budgetsRes.error) throw new Error(`Failed to fetch budgets: ${budgetsRes.error.message}`);
  if (expensesRes.error) throw new Error(`Failed to fetch expenses: ${expensesRes.error.message}`);

  const expensesByCategory: Record<string, number> = {};
  for (const exp of expensesRes.data || []) {
    const cat = exp.category || "Uncategorized";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(exp.amount);
  }

  const budgets = (budgetsRes.data || []).map((b: any) => {
    const limit = Number(b.monthly_limit || b.amount || 0);
    const spent = expensesByCategory[b.category] || 0;
    const remaining = limit - spent;
    const percentageUsed = limit > 0 ? (spent / limit) * 100 : 0;

    return {
      id: b.id,
      category: b.category,
      limit,
      spent,
      remaining,
      percentageUsed: Number(percentageUsed.toFixed(1)),
      isOverBudget: spent > limit,
    };
  });

  const totalBudgetLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  return {
    month: currentMonth,
    budgets,
    summary: {
      totalBudgetLimit,
      totalBudgetSpent,
      totalRemaining: totalBudgetLimit - totalBudgetSpent,
      overallPercentageUsed: totalBudgetLimit > 0 ? Number(((totalBudgetSpent / totalBudgetLimit) * 100).toFixed(1)) : 0,
    },
  };
}
