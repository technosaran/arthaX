"use client";


import { useMemo, useState, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { format, parseISO, subMonths } from "date-fns";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useNetWorth } from "@/hooks/use-net-worth";
import { getChartColour } from "@/lib/chart-colours";
import DashboardDesktop from "./components/DashboardDesktop";
import OnboardingWizard from "@/components/onboarding-wizard";
import { useUser } from "@/context/user-context";
import LoadingSkeleton from "./loading";

type TrendMapEntry = {
  name: string;
  income: number;
  expense: number;
};

type TrendEntry = {
  date: string;
  amount: number;
  category: string;
  type: string;
};

export default function DashboardClient() {
  const { user_id } = useUser();
  const { data: financeData, isLoading } = useFinanceData();
  
  const { 
    profile,
    accounts = [], 
    transactions = [], 
    ledgerLogs: recentLogs = [], 
    investments = [], 
    mutualFunds = [], 
    alternativeAssets = [],
    bonds = [],
    incomes = [], 
    expenses = [], 
    goals = []
  } = financeData || {};


  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    if (!user_id) return;
    
    const storageKey = `onboarding_completed_${user_id}`;
    const completed = localStorage.getItem(storageKey);
    const hasData = accounts.length > 0 || incomes.length > 0 || expenses.length > 0;
    
    if (!completed && !hasData && !isLoading) {
      // Small delay to let the page load first
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [accounts.length, incomes.length, expenses.length, isLoading, user_id]);

  const handleOnboardingComplete = () => {
    if (user_id) {
      localStorage.setItem(`onboarding_completed_${user_id}`, "true");
    }
    setShowOnboarding(false);
  };

  const netWorthData = useNetWorth();

  const stats = useMemo(() => {
    const {
      netWorth,
      netWorthINR,
      netWorthUSD,
      cashBalance,
      cashBalanceINR,
      cashBalanceUSD,
      stockBalance,
      stockBalanceINR,
      stockBalanceUSD,
      forexBalance,
      forexBalanceINR,
      forexBalanceUSD,
      mfBalance,
      mfBalanceINR,
      mfBalanceUSD,
      bondBalance,
      bondBalanceINR,
      bondBalanceUSD,
      altBalance,
      altBalanceINR,
      altBalanceUSD,
      debtBalance,
      debtBalanceINR,
      debtBalanceUSD,
      liquidBalance,
      liquidBalanceINR,
      liquidBalanceUSD,
      totalAssets,
      totalAssetsINR,
      totalAssetsUSD,
      cryptoBalance,
      cryptoBalanceINR,
      cryptoBalanceUSD,
    } = netWorthData;

    const stockCount = investments.filter((inv) => Number(inv.quantity) > 0).length;
    const mfCount = mutualFunds.filter((mf) => Number(mf.units) > 0).length;

    
    const now = new Date();
    const currentMonthNum = now.getMonth();
    const currentYearNum = now.getFullYear();
    
    let monthlySpend = 0;
    let monthlyIncome = 0;
    const expenseTrend: TrendEntry[] = [];
    const catMap: Record<string, number> = {};
    
    // Trend Map Initialization (Last 24 Months)
    const trendMap: Record<string, TrendMapEntry> = {};
    for (let i = 23; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = format(d, "MMM yy");
      trendMap[m] = { name: m, income: 0, expense: 0 };
    }

    // Single pass over transactions
    // Only count actual expenses (source_type "expense" or null) — skip investment purchases
    const EXPENSE_SOURCE_TYPES = new Set(["expense", null, undefined, ""]);

    const sortedForLoop = [...transactions].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return b.date.localeCompare(a.date);
    });

    for (let i = 0; i < sortedForLoop.length; i++) {
      const t = sortedForLoop[i];
      if (!t.date) continue;
      
      const tDate = parseISO(t.date);
      const tAmount = Number(t.amount);
      const tType = t.type;
      const isRealExpense = tType === "expense" && EXPENSE_SOURCE_TYPES.has(t.source_type);
      
      // Monthly Stats & Category Map - Timezone-robust direct comparison
      if (tDate.getMonth() === currentMonthNum && tDate.getFullYear() === currentYearNum) {
        if (tType === "income") monthlyIncome += tAmount;
        if (isRealExpense) {
          monthlySpend += tAmount;
          const cat = t.category || "Others";
          catMap[cat] = (catMap[cat] || 0) + tAmount;
        }
      }

      // Expense Trend (Last 15)
      if (isRealExpense && expenseTrend.length < 15) {
        expenseTrend.push({
          date: t.date,
          amount: tAmount,
          category: t.category || "Others",
          type: tType,
        });
      }

      // 6-Month Trend
      const m = format(tDate, "MMM yy");
      if (trendMap[m]) {
        if (tType === "income") trendMap[m].income += tAmount;
        if (isRealExpense) trendMap[m].expense += tAmount;
      }
    }

    // Calculate historical curves walking backward
    const monthsKeys = Object.keys(trendMap);
    let runningNetWorth = typeof netWorthINR === "number" ? netWorthINR : 0;
    let runningInvestments = (stockBalanceINR || 0) + (mfBalanceINR || 0) + (bondBalanceINR || 0);

    for (let i = monthsKeys.length - 1; i >= 0; i--) {
      const key = monthsKeys[i];
      const entry = trendMap[key] as any;
      const netMonthlyChange = entry.income - entry.expense;
      const investmentDelta = Math.max(0, entry.income * 0.3 - entry.expense * 0.1);

      entry.netWorth = Math.max(0, runningNetWorth);
      entry.investments = Math.max(0, runningInvestments);

      runningNetWorth -= netMonthlyChange;
      runningInvestments -= investmentDelta;
    }

    const pieData = Object.entries(catMap).map(([name, value], index) => {
      const resolvedColor = getChartColour(index);
      return { name, value, fill: resolvedColor, color: resolvedColor, percentage: "0" };
    }).sort((a,b) => b.value - a.value);

    let totalDayPnLINR = 0;
    let totalDayPnLUSD = 0;

    investments.forEach((inv) => {
      const quantity = Number(inv.quantity || 0);
      const currentPrice = Number(inv.current_price || inv.buy_price || 0);
      const prevClose = Number(inv.previous_close || 0);
      const dayChangePerUnit = inv.day_change !== null && inv.day_change !== undefined
        ? Number(inv.day_change)
        : (prevClose > 0 ? currentPrice - prevClose : currentPrice - Number(inv.buy_price || 0));
      const rawPnL = dayChangePerUnit * quantity;
      const isUSD = inv.currency === "USD";
      totalDayPnLINR += isUSD ? rawPnL * 85.0 : rawPnL;
      totalDayPnLUSD += isUSD ? rawPnL : rawPnL / 85.0;
    });

    mutualFunds.forEach((mf) => {
      const units = Number(mf.units || 0);
      const currentNav = Number(mf.current_nav || mf.avg_nav || 0);
      const prevNav = Number(mf.previous_nav || 0);
      const dayChangePerUnit = mf.day_change !== null && mf.day_change !== undefined
        ? Number(mf.day_change)
        : (prevNav > 0 ? currentNav - prevNav : currentNav - Number(mf.avg_nav || 0));
      const rawPnL = dayChangePerUnit * units;
      const isUSD = (mf as any).currency === "USD";
      totalDayPnLINR += isUSD ? rawPnL * 85.0 : rawPnL;
      totalDayPnLUSD += isUSD ? rawPnL : rawPnL / 85.0;
    });

    const isBaseUSD = profile?.base_currency === "USD";
    const totalDayPnL = isBaseUSD ? totalDayPnLUSD : totalDayPnLINR;
    const prevDayNetWorth = netWorth - totalDayPnL;
    const totalDayPnLPercent = prevDayNetWorth > 0 ? (totalDayPnL / prevDayNetWorth) * 100 : 0;

    // Calculate All-Time Total Investment Growth & ROI across all assets
    let totalInvestedINR = 0;
    let totalGrowthINR = 0;

    investments.forEach((inv) => {
      const quantity = Number(inv.quantity || 0);
      const buyPrice = Number(inv.buy_price || 0);
      const currentPrice = Number(inv.current_price || buyPrice);
      const isUSD = inv.currency === "USD";
      const fx = isUSD ? 85.0 : 1.0;

      const invested = quantity * buyPrice * fx;
      const current = quantity * currentPrice * fx;
      const unrealizedPnL = current - invested;
      const realizedPnL = Number((inv as any).realized_pnl || 0) * fx;

      totalInvestedINR += invested;
      totalGrowthINR += (unrealizedPnL + realizedPnL);
    });

    mutualFunds.forEach((mf) => {
      const units = Number(mf.units || 0);
      const avgNav = Number(mf.avg_nav || 0);
      const currentNav = Number(mf.current_nav || avgNav);
      const isUSD = (mf as any).currency === "USD";
      const fx = isUSD ? 85.0 : 1.0;

      const invested = units * avgNav * fx;
      const current = units * currentNav * fx;
      const unrealizedPnL = current - invested;
      const realizedPnL = Number(mf.realized_pnl || 0) * fx;

      totalInvestedINR += invested;
      totalGrowthINR += (unrealizedPnL + realizedPnL);
    });

    (alternativeAssets || []).forEach((alt: any) => {
      const purchase = Number(alt.purchase_price || 0);
      const current = Number(alt.current_value || purchase);
      totalInvestedINR += purchase;
      totalGrowthINR += (current - purchase);
    });

    (bonds || []).forEach((b: any) => {
      const purchase = Number(b.purchase_price || 0);
      const qty = Number(b.quantity || 1);
      const current = Number(b.current_price || purchase) * qty;
      const invested = purchase * qty;
      totalInvestedINR += invested;
      totalGrowthINR += (current - invested);
    });

    const totalGrowthUSD = totalGrowthINR / 85.0;
    const totalGrowthPercent = totalInvestedINR > 0 ? (totalGrowthINR / totalInvestedINR) * 100 : 0;


    return { 
      totalBalance: netWorth,
      netWorth,
      netWorthINR,
      netWorthUSD,
      totalDayPnL,
      totalDayPnLINR,
      totalDayPnLUSD,
      totalDayPnLPercent,
      totalGrowthINR,
      totalGrowthUSD,
      totalGrowthPercent,
      liquidBalance,
      liquidBalanceINR,
      liquidBalanceUSD,
      altBalance,
      altBalanceINR,
      altBalanceUSD,
      bondBalance,
      bondBalanceINR,
      bondBalanceUSD,
      debtBalance,
      debtBalanceINR,
      debtBalanceUSD,
      totalAssets,
      totalAssetsINR,
      totalAssetsUSD,
      cashBalance,
      cashBalanceINR,
      cashBalanceUSD,
      stockBalance,
      stockBalanceINR,
      stockBalanceUSD,
      forexBalance,
      forexBalanceINR,
      forexBalanceUSD,
      cryptoBalance,
      cryptoBalanceINR,
      cryptoBalanceUSD,
      monthlySpend, 
      monthlyIncome, 
      expenseTrend: expenseTrend.reverse(), 
      pieData, 
      stockCount, 
      mfCount, 
      mfBalance,
      mfBalanceINR,
      mfBalanceUSD,
      trendData: Object.values(trendMap) 
    };
  }, [transactions, netWorthData, investments, mutualFunds, alternativeAssets, bonds, profile]);



  const isMounted = useHasMounted();

  if (!isMounted) return null; // Prevent hydration mismatch

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      <DashboardDesktop stats={stats} recentLogs={recentLogs} goals={goals} accounts={accounts} isLoading={isLoading} />
    </>
  );
}
