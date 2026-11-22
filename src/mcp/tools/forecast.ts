/**
 * Cash Flow & Runway Forecast Tool for arthaX MCP Server
 * Projects liquid cash balances and runway months based on recent burn rate and recurring commitments.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export async function handleGetForecast(
  db: SupabaseClient<Database>,
  userId: string,
  monthsAhead: number = 3
) {
  const boundedMonths = Math.max(1, Math.min(12, monthsAhead));

  // 1. Get liquid assets
  const accountsRes = await db
    .from("accounts")
    .select("id, balance, classification")
    .eq("user_id", userId)
    .is("archived_at", null);

  if (accountsRes.error) throw new Error(`Failed to fetch accounts: ${accountsRes.error.message}`);

  const liquidCash = (accountsRes.data || [])
    .filter((a) => a.classification === "asset")
    .reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0);

  // 2. Fetch last 60 days expenses to estimate monthly burn rate
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expensesRes = await db
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .gte("date", sixtyDaysAgo);

  const pastExpensesTotal = (expensesRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0);
  const estimatedMonthlyBurn = pastExpensesTotal > 0 ? (pastExpensesTotal / 2) : 25000; // fallback to 25k if no historical data

  // 3. Fetch active recurring rules
  const recurringRes = await db
    .from("recurring_rules")
    .select("type, amount, is_active")
    .eq("user_id", userId);

  let monthlyRecurringExpenses = 0;
  let monthlyRecurringIncome = 0;

  for (const rule of recurringRes.data || []) {
    if (rule.is_active) {
      if (rule.type === "EXPENSE") {
        monthlyRecurringExpenses += Number(rule.amount);
      } else if (rule.type === "INCOME") {
        monthlyRecurringIncome += Number(rule.amount);
      }
    }
  }

  const effectiveMonthlyBurn = Math.max(
    1000,
    estimatedMonthlyBurn + monthlyRecurringExpenses - monthlyRecurringIncome
  );

  const runwayMonths = effectiveMonthlyBurn > 0 ? Number((liquidCash / effectiveMonthlyBurn).toFixed(1)) : 999;

  const monthlyProjections = [];
  let projectedBalance = liquidCash;
  for (let m = 1; m <= boundedMonths; m++) {
    projectedBalance = projectedBalance - effectiveMonthlyBurn;
    monthlyProjections.push({
      monthOffset: m,
      projectedBalance: Math.round(projectedBalance),
      projectedBurn: Math.round(effectiveMonthlyBurn),
    });
  }

  return {
    currentLiquidCash: Math.round(liquidCash),
    estimatedMonthlyBurn: Math.round(effectiveMonthlyBurn),
    monthlyRecurringExpenses: Math.round(monthlyRecurringExpenses),
    monthlyRecurringIncome: Math.round(monthlyRecurringIncome),
    runwayMonths,
    projections: monthlyProjections,
  };
}
