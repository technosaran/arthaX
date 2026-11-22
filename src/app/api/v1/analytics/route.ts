import { supabaseAdmin } from "@/utils/supabase/admin";
import { getCachedData, setCachedData, getUserCacheKey } from "@/utils/redis";
import { getCurrentMonthYear, formatMonthDisplay } from "@/utils/monthUtils";
import { apiSuccess, apiError } from "@/utils/apiResponse";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { logger } from "@/utils/logger";
import {
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  sumMoney,
  roundMoney,
  percentMoney,
} from "@/utils/money";

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

export const GET = createApiRoute({
  rateLimit: { limit: 90, windowSeconds: 60, keyPrefix: "analytics" },
  handler: async ({ userId, query, req }) => {
    const targetMonth = query.get("month") || getCurrentMonthYear(); // YYYY-MM
    const bypassCache = query.get("refresh") === "true";

    const cacheKey = getUserCacheKey(userId!, `analytics:${targetMonth}`);

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
          .eq("user_id", userId!),
        supabaseAdmin
          .from("expenses")
          .select("id, amount, category, expense_date, title, notes")
          .eq("user_id", userId!)
          .gte("expense_date", monthStart)
          .lte("expense_date", monthEnd),
        supabaseAdmin
          .from("income")
          .select("id, amount, category, received_date")
          .eq("user_id", userId!)
          .gte("received_date", monthStart)
          .lte("received_date", monthEnd),
        supabaseAdmin
          .from("budgets")
          .select("category, amount")
          .eq("user_id", userId!),
        supabaseAdmin
          .from("stock_holdings")
          .select("quantity, avg_buy_price, current_price")
          .eq("user_id", userId!),
        supabaseAdmin
          .from("mutual_fund_holdings")
          .select("units, current_nav, avg_nav, invested_amount")
          .eq("user_id", userId!),
        supabaseAdmin
          .from("bond_holdings")
          .select("quantity, avg_buy_price, invested_amount, current_price, face_value")
          .eq("user_id", userId!),
        supabaseAdmin
          .from("bullion_holdings")
          .select("metal, weight_grams, total_buy_price, current_rate_per_gram")
          .eq("user_id", userId!),
        supabaseAdmin
          .from("crypto_holdings")
          .select("asset, total_value_usd")
          .eq("user_id", userId!),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (incomeRes.error) throw incomeRes.error;
      if (budgetsRes.error) throw budgetsRes.error;

      // 1. Portfolio calculations using Decimal-precision arithmetic
      const rawAccounts = accountsRes.data || [];
      let liquidAssets = 0;
      let totalLiabilities = 0;

      const mappedAccounts = rawAccounts.map((a) => {
        const bal = roundMoney(a.balance);
        const isLiab = a.classification === "liability" || /credit|loan/i.test(a.type);
        if (isLiab) {
          totalLiabilities = addMoney(totalLiabilities, Math.abs(bal));
        } else {
          liquidAssets = addMoney(liquidAssets, bal);
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

      // Investments valuation (Accurate Real-Time Market Valuation with Decimal precision)
      let stocksValuation = 0;
      if (stocksRes?.data) {
        stocksValuation = sumMoney(
          stocksRes.data.map((s) =>
            mulMoney(s.quantity, s.current_price || s.avg_buy_price || 0)
          )
        );
      }

      let mfValuation = 0;
      if (mfRes?.data) {
        mfValuation = sumMoney(
          mfRes.data.map((m) => {
            const nav = m.current_nav || m.avg_nav || 0;
            const val = mulMoney(m.units, nav);
            return val > 0 ? val : (m.invested_amount || 0);
          })
        );
      }

      let bondsValuation = 0;
      if (bondsRes?.data) {
        bondsValuation = sumMoney(
          bondsRes.data.map((b) => {
            const p = b.current_price || b.avg_buy_price || b.face_value || 1000;
            const val = mulMoney(b.quantity, p);
            return val > 0 ? val : (b.invested_amount || 0);
          })
        );
      }

      let bullionValuation = 0;
      if (bullionRes?.data) {
        bullionValuation = sumMoney(
          bullionRes.data.map((bul) => {
            const marketVal = mulMoney(bul.weight_grams, bul.current_rate_per_gram || 0);
            return marketVal > 0 ? marketVal : (bul.total_buy_price || 0);
          })
        );
      }

      let cryptoValuation = 0;
      if (cryptoRes?.data) {
        const cryptoUsdTotal = sumMoney(cryptoRes.data.map((c) => c.total_value_usd || 0));
        cryptoValuation = mulMoney(cryptoUsdTotal, 84.5);
      }

      const investmentsTotal = sumMoney([
        stocksValuation,
        mfValuation,
        bondsValuation,
        bullionValuation,
        cryptoValuation,
      ]);

      const totalAssets = addMoney(liquidAssets, investmentsTotal);
      const netWorth = subMoney(totalAssets, totalLiabilities);

      // Persist daily net worth snapshot asynchronously in background
      const todayStr = new Date().toISOString().split("T")[0];
      try {
        await supabaseAdmin
          .from("net_worth_snapshots")
          .upsert(
            {
              user_id: userId!,
              snapshot_date: todayStr,
              total_assets: totalAssets,
              total_liabilities: totalLiabilities,
              net_worth: netWorth,
              currency: "INR",
              breakdown: {
                liquid_cash: liquidAssets,
                stocks: stocksValuation,
                mutual_funds: mfValuation,
                bonds: bondsValuation,
                bullion: bullionValuation,
                crypto: cryptoValuation,
                liabilities: totalLiabilities,
              },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,snapshot_date" }
          );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn("Failed to persist net worth snapshot", "AnalyticsAPI", { error: errMsg });
      }

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

      const totalExpense = sumMoney(rawExpenses.map((e) => e.amount));
      const totalIncome = sumMoney(rawIncome.map((i) => i.amount));
      const netSavings = subMoney(totalIncome, totalExpense);
      const savingsRatePercent = percentMoney(netSavings, totalIncome);

      // 3. Spending velocity
      const dailyAverageSpend = currentDay > 0 ? divMoney(totalExpense, currentDay) : 0;
      const projectedMonthEndExpense = roundMoney(mulMoney(dailyAverageSpend, lastDayNum));

      // 4. Category breakdown
      const categoryTotals: Record<string, { amount: number; count: number }> = {};
      for (const exp of rawExpenses) {
        const cat = exp.category || "General";
        const amt = roundMoney(exp.amount);
        if (!categoryTotals[cat]) {
          categoryTotals[cat] = { amount: 0, count: 0 };
        }
        categoryTotals[cat].amount = addMoney(categoryTotals[cat].amount, amt);
        categoryTotals[cat].count += 1;
      }

      const categoryBreakdown = Object.entries(categoryTotals)
        .map(([cat, info]) => ({
          category: cat,
          amount: info.amount,
          count: info.count,
          percentage: percentMoney(info.amount, totalExpense),
        }))
        .sort((a, b) => b.amount - a.amount);

      // 5. Budget status
      const rawBudgets = budgetsRes.data || [];
      const budgetStatus = rawBudgets.map((b) => {
        const budgeted = roundMoney(b.amount);
        const spent = categoryTotals[b.category]?.amount || 0;
        const remaining = subMoney(budgeted, spent);
        const percent = percentMoney(spent, budgeted);
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
      logger.error("Analytics computation failed", "AnalyticsAPI", err, { userId, requestId: req.headers.get("x-request-id") });
      return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
  },
});
