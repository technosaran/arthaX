import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { getCachedData, setCachedData, getUserCacheKey } from "@/utils/redis";
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
    const monthStart = `${targetMonth}-01`;
    // Compute last day of target month
    const [yearNum, monthNum] = targetMonth.split("-").map(Number);
    const lastDayNum = new Date(yearNum, monthNum, 0).getDate();
    const monthEnd = `${targetMonth}-${String(lastDayNum).padStart(2, "0")}`;

    const now = new Date();
    const isCurrentMonth = targetMonth === getCurrentMonthYear();
    const currentDay = isCurrentMonth ? now.getDate() : lastDayNum;

    // Parallel fetch: Accounts, Monthly Expenses, Monthly Income, Budgets, and Investments
    const [
      accountsRes,
      expensesRes,
      incomeRes,
      budgetsRes,
      stocksRes,
      mfRes,
      bondsRes,
      bullionRes,
      cryptoRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select("id, name, type, classification, balance, last_four")
        .eq("user_id", userId),
      supabaseAdmin
        .from("expenses")
        .select("id, amount, category, expense_date, title, notes")
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
      supabaseAdmin
        .from("stock_holdings")
        .select("quantity, avg_buy_price, current_price")
        .eq("user_id", userId),
      supabaseAdmin
        .from("mutual_fund_holdings")
        .select("units, current_nav, avg_nav, invested_amount")
        .eq("user_id", userId),
      supabaseAdmin
        .from("bond_holdings")
        .select("quantity, avg_buy_price, invested_amount, current_price, face_value")
        .eq("user_id", userId),
      supabaseAdmin
        .from("bullion_holdings")
        .select("metal, weight_grams, total_buy_price, current_rate_per_gram")
        .eq("user_id", userId),
      supabaseAdmin
        .from("crypto_holdings")
        .select("asset, total_value_usd")
        .eq("user_id", userId),
    ]);

    if (accountsRes.error) throw accountsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (incomeRes.error) throw incomeRes.error;
    if (budgetsRes.error) throw budgetsRes.error;

    // 1. Portfolio calculations
    const rawAccounts = accountsRes.data || [];
    let liquidAssets = 0;
    let totalLiabilities = 0;

    const mappedAccounts = rawAccounts.map((a) => {
      const bal = Number(a.balance) || 0;
      const isLiab = a.classification === "liability" || /credit|loan/i.test(a.type);
      if (isLiab) {
        totalLiabilities += Math.abs(bal);
      } else {
        liquidAssets += bal;
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

    // Investments valuation (Accurate Real-Time Market Valuation)
    let investmentsTotal = 0;
    if (stocksRes?.data) {
      investmentsTotal += stocksRes.data.reduce(
        (sum, s) => sum + (Number(s.quantity) || 0) * (Number(s.current_price) || Number(s.avg_buy_price) || 0),
        0
      );
    }
    if (mfRes?.data) {
      investmentsTotal += mfRes.data.reduce((sum, m) => {
        const currentNav = Number(m.current_nav) || Number(m.avg_nav) || 0;
        const currentVal = (Number(m.units) || 0) * currentNav;
        return sum + (currentVal > 0 ? currentVal : (Number(m.invested_amount) || 0));
      }, 0);
    }
    if (bondsRes?.data) {
      investmentsTotal += bondsRes.data.reduce((sum, b) => {
        const p = Number(b.current_price) || Number(b.avg_buy_price) || Number(b.face_value) || 1000;
        const val = (Number(b.quantity) || 0) * p;
        return sum + (val > 0 ? val : (Number(b.invested_amount) || 0));
      }, 0);
    }
    if (bullionRes?.data) {
      investmentsTotal += bullionRes.data.reduce((sum, bul) => {
        const marketRate = Number(bul.current_rate_per_gram) || 0;
        const marketVal = (Number(bul.weight_grams) || 0) * marketRate;
        return sum + (marketVal > 0 ? marketVal : (Number(bul.total_buy_price) || 0));
      }, 0);
    }
    if (cryptoRes?.data) {
      const cryptoUsd = cryptoRes.data.reduce(
        (sum, c) => sum + (Number(c.total_value_usd) || 0),
        0
      );
      investmentsTotal += cryptoUsd * 84.5;
    }

    const totalAssets = liquidAssets + investmentsTotal;
    const netWorth = totalAssets - totalLiabilities;

    // 2. Cash flow calculations (excluding internal transfers / family transfers from spending)
    const isTransferOrFamily = (e: any): boolean => {
      const cat = (e.category || "").toLowerCase();
      const title = (e.title || "").toLowerCase();
      const notes = (e.notes || "").toLowerCase();
      if (cat.includes("family") && (title.includes("sent") || notes.includes("family transfer"))) {
        return true;
      }
      if (cat === "transfer" || title.startsWith("transfer to") || title.startsWith("transfer from")) {
        return true;
      }
      return false;
    };

    const rawExpenses = (expensesRes.data || []).filter((e) => !isTransferOrFamily(e));
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
