import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { getCachedData, setCachedData, getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getCurrentMonthYear, getLocalDateString, formatMonthDisplay } from "@/utils/monthUtils";
import { apiSuccess, apiError, apiUnauthorized, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";

export interface AnalyticsSummary {
  portfolio: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    accountsCount: number;
  };
  monthlyCashFlow: {
    month: string;
    monthName: string;
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRatePercent: number;
  };
  velocity: {
    daysInMonth: number;
    dayOfMonth: number;
    dailyAverageSpend: number;
    projectedMonthEndExpense: number;
  };
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }>;
  budgetStatus: Array<{
    category: string;
    budgeted: number;
    spent: number;
    remaining: number;
    percent: number;
    isOverBudget: boolean;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    classification: "asset" | "liability";
    balance: number;
    last_four: string | null;
  }>;
}

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  // Rate limit: 90 requests/minute per user
  const rl = await rateLimit(`analytics:${userId}`, 90, 60);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please try again shortly.", requestId },
      { status: 429, headers: { "X-Request-Id": requestId } }
    );
  }

  const { searchParams } = new URL(req.url);
  const targetMonth = searchParams.get("month") || getCurrentMonthYear(); // YYYY-MM
  const bypassCache = searchParams.get("refresh") === "true";

  const cacheKey = getUserCacheKey(userId, `analytics:${targetMonth}`);

  // 1. Check Redis Cache
  if (!bypassCache) {
    try {
      const cached = await getCachedData<AnalyticsSummary>(cacheKey);
      if (cached) {
        return apiSuccess(cached, { cached: true, month: targetMonth }, 200, req);
      }
    } catch {}
  }

  try {
    const todayStr = getLocalDateString(new Date(), "Asia/Kolkata");
    const monthStart = `${targetMonth}-01`;
    // Compute last day of target month
    const [yearNum, monthNum] = targetMonth.split("-").map(Number);
    const lastDayNum = new Date(yearNum, monthNum, 0).getDate();
    const monthEnd = `${targetMonth}-${String(lastDayNum).padStart(2, "0")}`;

    const now = new Date();
    const isCurrentMonth = targetMonth === getCurrentMonthYear();
    const currentDay = isCurrentMonth ? now.getDate() : lastDayNum;

    // Parallel fetch: Accounts, Monthly Expenses, Monthly Income, Budgets
    const [accountsRes, expensesRes, incomeRes, budgetsRes] = await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select("id, name, type, classification, balance, last_four")
        .eq("user_id", userId),
      supabaseAdmin
        .from("expenses")
        .select("id, amount, category, expense_date")
        .eq("user_id", userId)
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd),
      supabaseAdmin
        .from("income")
        .select("id, amount, category, received_date")
        .eq("user_id", userId)
        .gte("received_date", monthStart)
        .lte("received_date", monthEnd),
      supabaseAdmin
        .from("budgets")
        .select("category, amount")
        .eq("user_id", userId),
    ]);

    if (accountsRes.error) throw accountsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (incomeRes.error) throw incomeRes.error;
    if (budgetsRes.error) throw budgetsRes.error;

    // 1. Portfolio calculations
    const rawAccounts = accountsRes.data || [];
    let totalAssets = 0;
    let totalLiabilities = 0;

    const mappedAccounts = rawAccounts.map((a) => {
      const bal = Number(a.balance) || 0;
      const isLiab = a.classification === "liability" || /credit|loan/i.test(a.type);
      if (isLiab) {
        totalLiabilities += Math.abs(bal);
      } else {
        totalAssets += bal;
      }
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        classification: (isLiab ? "liability" : "asset") as "asset" | "liability",
        balance: bal,
        last_four: a.last_four || null,
      };
    });

    const netWorth = totalAssets - totalLiabilities;

    // 2. Cash flow calculations
    const rawExpenses = expensesRes.data || [];
    const rawIncome = incomeRes.data || [];

    const totalExpense = rawExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalIncome = rawIncome.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRatePercent = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

    // 3. Spending velocity
    const dailyAverageSpend = currentDay > 0 ? Math.round((totalExpense / currentDay) * 100) / 100 : 0;
    const projectedMonthEndExpense = Math.round(dailyAverageSpend * lastDayNum);

    // 4. Category breakdown
    const categoryTotals: Record<string, { amount: number; count: number }> = {};
    for (const exp of rawExpenses) {
      const cat = exp.category || "General";
      const amt = Number(exp.amount) || 0;
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { amount: 0, count: 0 };
      }
      categoryTotals[cat].amount += amt;
      categoryTotals[cat].count += 1;
    }

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([cat, info]) => ({
        category: cat,
        amount: info.amount,
        count: info.count,
        percentage: totalExpense > 0 ? Math.round((info.amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 5. Budget status
    const rawBudgets = budgetsRes.data || [];
    const budgetStatus = rawBudgets.map((b) => {
      const budgeted = Number(b.amount) || 0;
      const spent = categoryTotals[b.category]?.amount || 0;
      const remaining = budgeted - spent;
      const percent = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
      return {
        category: b.category,
        budgeted,
        spent,
        remaining,
        percent,
        isOverBudget: remaining < 0,
      };
    });

    const summary: AnalyticsSummary = {
      portfolio: {
        totalAssets,
        totalLiabilities,
        netWorth,
        accountsCount: mappedAccounts.length,
      },
      monthlyCashFlow: {
        month: targetMonth,
        monthName: formatMonthDisplay(targetMonth),
        totalIncome,
        totalExpense,
        netSavings,
        savingsRatePercent,
      },
      velocity: {
        daysInMonth: lastDayNum,
        dayOfMonth: currentDay,
        dailyAverageSpend,
        projectedMonthEndExpense,
      },
      categoryBreakdown,
      budgetStatus,
      accounts: mappedAccounts,
    };

    // Cache summary for 10 minutes (600 seconds)
    await setCachedData(cacheKey, summary, 600);

    return apiSuccess(summary, { cached: false, month: targetMonth }, 200, req);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to calculate analytics";
    logger.error("Analytics computation failed", "AnalyticsAPI", err, { userId, requestId });
    return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
  }
}
