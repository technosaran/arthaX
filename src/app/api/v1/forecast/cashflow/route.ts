import { NextRequest, NextResponse } from "next/server";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiSuccess, apiError } from "@/utils/apiResponse";
import { validateMonetaryAmount, fromCents, toCentsStrict } from "@/utils/money";

export const GET = createApiRoute({
  auth: "required",
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, req }) => {
    try {
      // 1. Fetch liquid accounts (Cash, Savings, Checking)
      const { data: accounts, error: accErr } = await supabaseAdmin
        .from("accounts")
        .select("id, name, type, classification, balance, is_active")
        .eq("user_id", userId!)
        .eq("is_active", true);

      if (accErr) {
        return apiError(`Failed to load accounts: ${accErr.message}`, "DATABASE_ERROR", 500, undefined, req);
      }

      // Filter liquid cash assets
      const liquidAccounts = (accounts || []).filter((a) => {
        const t = (a.type || "").toLowerCase();
        const c = (a.classification || "").toLowerCase();
        return c === "asset" && (t.includes("saving") || t.includes("cash") || t.includes("checking") || t.includes("liquid"));
      });

      const totalLiquidCash = liquidAccounts.reduce((sum, a) => sum + Math.max(0, Number(a.balance || 0)), 0);
      const totalDebtLiabilities = (accounts || [])
        .filter((a) => (a.classification || "").toLowerCase() === "liability")
        .reduce((sum, a) => sum + Math.max(0, Number(a.balance || 0)), 0);

      // 2. Query historical 90-day expenses and income for deterministic baseline
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateFloor = ninetyDaysAgo.toISOString().split("T")[0];

      const [expensesRes, incomeRes, recurringRes] = await Promise.all([
        supabaseAdmin
          .from("expenses")
          .select("amount, category, expense_date")
          .eq("user_id", userId!)
          .gte("expense_date", dateFloor),
        supabaseAdmin
          .from("income")
          .select("amount, category, received_date")
          .eq("user_id", userId!)
          .gte("received_date", dateFloor),
        supabaseAdmin
          .from("recurring_rules")
          .select("*")
          .eq("user_id", userId!)
          .eq("is_active", true),
      ]);

      const totalExpenses90d = (expensesRes.data || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const totalIncome90d = (incomeRes.data || []).reduce((sum, i) => sum + Number(i.amount || 0), 0);

      // Monthly baseline (90 days / 3 months = 30 days per month)
      const monthlyHistoricalBurn = Math.max(0, Math.round((totalExpenses90d / 3) * 100) / 100);
      const monthlyHistoricalIncome = Math.max(0, Math.round((totalIncome90d / 3) * 100) / 100);

      // Monthly committed recurring obligations
      const recurringRules = recurringRes.data || [];
      const monthlyCommittedExpenses = recurringRules
        .filter((r) => r.type === "EXPENSE")
        .reduce((sum, r) => {
          const amt = Number(r.amount || 0);
          if (r.frequency === "DAILY") return sum + amt * 30;
          if (r.frequency === "WEEKLY") return sum + amt * 4.33;
          if (r.frequency === "YEARLY") return sum + amt / 12;
          return sum + amt; // MONTHLY
        }, 0);

      // Baseline monthly net savings rate (strictly based on actual records, no fabricated numbers)
      const hasHistoricalIncome = monthlyHistoricalIncome > 0;
      const hasHistoricalExpenses = monthlyHistoricalBurn > 0 || monthlyCommittedExpenses > 0;

      const baseMonthlyIncome = hasHistoricalIncome ? monthlyHistoricalIncome : 0;
      const baseMonthlyExpenses = hasHistoricalExpenses ? Math.max(monthlyHistoricalBurn, monthlyCommittedExpenses) : 0;
      const baseMonthlyNet = baseMonthlyIncome - baseMonthlyExpenses;

      // Emergency Fund Runway (Months of survival with zero income)
      const emergencyRunwayMonths = baseMonthlyExpenses > 0
        ? Math.round((totalLiquidCash / baseMonthlyExpenses) * 10) / 10
        : (totalLiquidCash > 0 ? 999 : 0);

      let runwayStatus: "CRITICAL" | "CAUTION" | "HEALTHY" | "EXCELLENT" | "INSUFFICIENT_DATA" = "HEALTHY";
      if (!hasHistoricalExpenses && totalLiquidCash === 0) {
        runwayStatus = "INSUFFICIENT_DATA";
      } else if (emergencyRunwayMonths < 3.0) {
        runwayStatus = "CRITICAL";
      } else if (emergencyRunwayMonths < 6.0) {
        runwayStatus = "CAUTION";
      } else if (emergencyRunwayMonths >= 12.0) {
        runwayStatus = "EXCELLENT";
      }

      // 3. Deterministic Scenarios Generation across horizons (30d, 60d, 90d, 180d, 365d)
      const horizonsDays = [30, 60, 90, 180, 365];

      const projections = horizonsDays.map((days) => {
        const months = days / 30.416;

        // Base case: constant trend
        const baseBalance = Math.round((totalLiquidCash + baseMonthlyNet * months) * 100) / 100;

        // Best case: +10% income, -15% discretionary spending
        const bestIncome = baseMonthlyIncome * 1.10;
        const bestExpenses = baseMonthlyExpenses * 0.85;
        const bestNet = bestIncome - bestExpenses;
        const bestBalance = Math.round((totalLiquidCash + bestNet * months) * 100) / 100;

        // Worst case: -15% income shock, +20% unexpected expense inflation
        const worstIncome = baseMonthlyIncome * 0.85;
        const worstExpenses = baseMonthlyExpenses * 1.20;
        const worstNet = worstIncome - worstExpenses;
        const worstBalance = Math.round((totalLiquidCash + worstNet * months) * 100) / 100;

        return {
          days,
          months: Math.round(months * 10) / 10,
          horizon_label: `${days} Days (${Math.round(months)} Mo)`,
          base_case_balance: baseBalance,
          best_case_balance: bestBalance,
          worst_case_balance: worstBalance,
          projected_net_change: Math.round(baseMonthlyNet * months * 100) / 100,
        };
      });

      return apiSuccess(
        {
          timestamp: new Date().toISOString(),
          current_liquidity: {
            total_liquid_cash: Math.round(totalLiquidCash * 100) / 100,
            liquid_accounts_count: liquidAccounts.length,
            total_liabilities: Math.round(totalDebtLiabilities * 100) / 100,
            net_liquid_reserve: Math.round((totalLiquidCash - totalDebtLiabilities) * 100) / 100,
          },
          monthly_cashflow_baseline: {
            expected_monthly_income: Math.round(baseMonthlyIncome * 100) / 100,
            expected_monthly_burn: Math.round(baseMonthlyExpenses * 100) / 100,
            committed_recurring_burn: Math.round(monthlyCommittedExpenses * 100) / 100,
            monthly_net_savings: Math.round(baseMonthlyNet * 100) / 100,
            savings_rate_percentage: baseMonthlyIncome > 0
              ? Math.round((baseMonthlyNet / baseMonthlyIncome) * 1000) / 10
              : 0,
          },
          emergency_runway: {
            months: emergencyRunwayMonths,
            status: runwayStatus,
            recommended_minimum_months: 6.0,
            recommended_liquid_target: Math.round(baseMonthlyExpenses * 6 * 100) / 100,
            deficit_surplus: Math.round((totalLiquidCash - baseMonthlyExpenses * 6) * 100) / 100,
          },
          projections,
          assumptions: [
            "Projections assume recurring commitments remain active at current frequency.",
            "Historical 90-day expense patterns form the baseline monthly spending estimate.",
            "Best-case scenario models +10% income increase with -15% spending optimization.",
            "Worst-case scenario models -15% income disruption with +20% inflation/unplanned medical expenses.",
            "Projections are deterministic estimations based on current balances and not guaranteed financial outcomes.",
          ],
        },
        undefined,
        200,
        req
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to calculate cash-flow forecast";
      return apiError(msg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
  },
});
