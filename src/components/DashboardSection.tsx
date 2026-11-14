"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  PieChart as PieChartIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Target,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Landmark,
  ArrowRight,
  PiggyBank,
  Clock,
  Sparkles,
  Activity,
  ShieldCheck,
  CreditCard,
  Wallet,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getFromLocalCache, saveToCache } from "@/utils/cacheClient";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import EntityLogo from "@/components/EntityLogo";
import BankLogo from "@/components/BankLogo";
import { getTimeGreeting } from "@/utils/greeting";
import { isFamilyTransfer } from "@/utils/expenseFilter";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
  classification?: "asset" | "liability";
}

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  account_id?: string | null;
  expense_date: string;
  notes?: string | null;
  tags?: string[];
  created_at?: string;
}

interface IncomeItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  account_id?: string | null;
  received_date: string;
  created_at?: string;
}

interface TransferItem {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  notes?: string | null;
  created_at?: string;
}

interface ActivityItem {
  id: string;
  type: "income" | "expense" | "transfer";
  title: string;
  amount: number;
  category?: string;
  date: string;
  accountName?: string;
  notes?: string | null;
}

function formatDisplayName(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 2 && !/[aeiou]/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

interface DashboardSectionProps {
  onNavigate?: (tab: string) => void;
}

export default function DashboardSection({ onNavigate }: DashboardSectionProps = {}) {
  const { user, profile } = useAuth();
  const [greeting, setGreeting] = useState(() => getTimeGreeting().text);
  const [greetingEmoji, setGreetingEmoji] = useState(() => getTimeGreeting().emoji);

  const redisPortfolioKey = getUserCacheKey(user?.id, CACHE_KEYS.PORTFOLIO);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency)
  const initialCache = useMemo(() => {
    return getFromLocalCache<{
      name: string;
      netWorth: number;
      accounts: AccountItem[];
    }>(redisPortfolioKey);
  }, [redisPortfolioKey]);

  const [name, setName] = useState<string>(profile?.name || initialCache?.name || "");
  const [netWorth, setNetWorth] = useState<number>(initialCache?.netWorth || 0);
  const [accounts, setAccounts] = useState<AccountItem[]>(initialCache?.accounts || []);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState<boolean>(!initialCache);

  const displayName = profile?.name || name;

  const formattedName = useMemo(() => {
    return formatDisplayName(displayName);
  }, [displayName]);

  // Synchronize greeting name whenever profile arrives or updates
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    }
  }, [profile?.name]);

  // Currency Formatter (INR)
  const formatCurrency = useCallback((val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createClient();

      // Parallel concurrent burst: accounts, expenses, income, transfers
      const [accountsRes, expensesRes, incomeRes, transfersRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, type, balance, last_four, classification")
          .eq("user_id", user.id),
        supabase
          .from("expenses")
          .select("id, title, amount, category, account_id, expense_date, notes, tags, created_at")
          .eq("user_id", user.id)
          .order("expense_date", { ascending: false })
          .limit(100),
        supabase
          .from("income")
          .select("id, title, amount, category, account_id, received_date, created_at")
          .eq("user_id", user.id)
          .order("received_date", { ascending: false })
          .limit(100),
        supabase
          .from("transfers")
          .select("id, from_account_id, to_account_id, amount, transfer_date, notes, created_at")
          .eq("user_id", user.id)
          .order("transfer_date", { ascending: false })
          .limit(25),
      ]);

      // 1. Resolve user display name
      const resolvedName =
        profile?.name ||
        name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "User";
      setName(resolvedName);

      // 2. Resolve accounts and accurate net worth (Assets - Liabilities)
      let mapped: AccountItem[] = [];
      let total = 0;
      if (accountsRes.data && accountsRes.data.length > 0) {
        mapped = accountsRes.data.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          balance: Number(item.balance) || 0,
          last_four: item.last_four,
          classification:
            item.classification ||
            (item.type?.toLowerCase().includes("credit") ||
            item.name?.toLowerCase().includes("credit") ||
            item.type?.toLowerCase().includes("loan")
              ? "liability"
              : "asset"),
        }));

        const totalAssets = mapped
          .filter((a) => a.classification !== "liability")
          .reduce((acc, curr) => acc + curr.balance, 0);

        const totalLiabilities = mapped
          .filter((a) => a.classification === "liability")
          .reduce((acc, curr) => acc + curr.balance, 0);

        total = totalAssets - totalLiabilities;
      }

      setAccounts(mapped);
      setNetWorth(total);
      if (expensesRes.data) {
        setExpenses((expensesRes.data as ExpenseItem[]).filter((e) => !isFamilyTransfer(e)));
      }
      if (incomeRes.data) setIncomes(incomeRes.data as IncomeItem[]);
      if (transfersRes.data) setTransfers(transfersRes.data as TransferItem[]);

      // 3. Update multi-tier cache
      saveToCache(redisPortfolioKey, {
        name: resolvedName,
        netWorth: total,
        accounts: mapped,
      });
    } catch (err) {
      console.warn("Error fetching dashboard telemetry:", err);
    } finally {
      setLoading(false);
    }
  }, [user, redisPortfolioKey, profile?.name, name]);

  useEffect(() => {
    const updateTimeGreeting = () => {
      const info = getTimeGreeting();
      setGreeting(info.text);
      setGreetingEmoji(info.emoji);
    };

    updateTimeGreeting();
    const greetingInterval = setInterval(updateTimeGreeting, 60000);

    if (!user) {
      return () => clearInterval(greetingInterval);
    }

    fetchDashboardData();

    // Cross-device Realtime synchronization for Dashboard
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "income", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.name) {
            setName(payload.new.name);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(greetingInterval);
      supabase.removeChannel(channel);
    };
  }, [user, fetchDashboardData]);

  // Current Month Calculations
  const currentMonthPrefix = useMemo(() => {
    return new Date().toISOString().slice(0, 7); // e.g. "2026-11"
  }, []);

  const currentMonthIncomes = useMemo(() => {
    return incomes.filter((i) => i.received_date?.startsWith(currentMonthPrefix));
  }, [incomes, currentMonthPrefix]);

  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((e) => e.expense_date?.startsWith(currentMonthPrefix));
  }, [expenses, currentMonthPrefix]);

  const totalMonthIncome = useMemo(() => {
    return currentMonthIncomes.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [currentMonthIncomes]);

  const totalMonthExpense = useMemo(() => {
    return currentMonthExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [currentMonthExpenses]);

  const netSavings = useMemo(() => {
    return totalMonthIncome - totalMonthExpense;
  }, [totalMonthIncome, totalMonthExpense]);

  const savingsRate = useMemo(() => {
    if (totalMonthIncome <= 0) return 0;
    const rate = (netSavings / totalMonthIncome) * 100;
    return Math.max(0, Math.min(100, Math.round(rate)));
  }, [netSavings, totalMonthIncome]);

  // Days elapsed in current month for daily burn rate calculation
  const dayOfMonth = useMemo(() => {
    return Math.max(1, new Date().getDate());
  }, []);

  const dailyBurnRate = useMemo(() => {
    return totalMonthExpense / dayOfMonth;
  }, [totalMonthExpense, dayOfMonth]);

  // Asset Totals
  const totalAssets = useMemo(() => {
    return accounts
      .filter((a) => a.classification !== "liability")
      .reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
  }, [accounts]);

  const totalLiabilities = useMemo(() => {
    return accounts
      .filter((a) => a.classification === "liability")
      .reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
  }, [accounts]);

  const liquidPct = useMemo(() => {
    if (totalAssets <= 0) return 100;
    const liquid = accounts
      .filter(
        (a) =>
          a.classification !== "liability" &&
          (a.type?.toLowerCase().includes("cash") ||
            a.type?.toLowerCase().includes("saving") ||
            a.type?.toLowerCase().includes("bank") ||
            a.name?.toLowerCase().includes("cash"))
      )
      .reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
    return Math.min(100, Math.round((liquid / totalAssets) * 100));
  }, [accounts, totalAssets]);

  // Modern Fintech Color Palette for Chart
  const chartPalette = [
    "#10B981", // Emerald (Cash / Savings)
    "#3B82F6", // Royal Blue (HDFC / Banking)
    "#8B5CF6", // Purple / Violet (Fixed Deposits)
    "#06B6D4", // Neon Cyan (Investments / Demat)
    "#F59E0B", // Bright Amber / Gold
    "#EC4899", // Vivid Pink
    "#F43F5E", // Vibrant Rose / Red
    "#14B8A6", // Teal
  ];

  // Group portfolio assets by type for Donut Chart
  const typeMap = useMemo(() => {
    return accounts
      .filter((a) => a.classification !== "liability")
      .reduce((acc, curr) => {
        const key = curr.type || curr.name || "Other";
        acc[key] = (acc[key] || 0) + curr.balance;
        return acc;
      }, {} as Record<string, number>);
  }, [accounts]);

  const donutSegments: DonutSegment[] = useMemo(() => {
    return Object.entries(typeMap)
      .filter(([_, bal]) => bal > 0)
      .map(([catType, catBalance], index) => ({
        label: catType,
        value: catBalance,
        color: chartPalette[index % chartPalette.length],
      }));
  }, [typeMap, chartPalette]);

  // Top Expense Categories this Month
  const topExpenseCategories = useMemo(() => {
    const catMap = currentMonthExpenses.reduce((acc, curr) => {
      const cat = curr.category || "Other";
      acc[cat] = (acc[cat] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amount], index) => ({
        category: cat,
        amount,
        percentage: totalMonthExpense > 0 ? Math.round((amount / totalMonthExpense) * 100) : 0,
        color: chartPalette[index % chartPalette.length],
      }));
  }, [currentMonthExpenses, totalMonthExpense, chartPalette]);

  // Combined Recent Activity (Latest 5 items)
  const recentActivities: ActivityItem[] = useMemo(() => {
    const accountLookup = new Map(accounts.map((a) => [a.id, a.name]));

    const expList: ActivityItem[] = expenses.slice(0, 10).map((e) => ({
      id: e.id,
      type: "expense",
      title: e.title,
      amount: e.amount,
      category: e.category,
      date: e.expense_date,
      accountName: e.account_id ? accountLookup.get(e.account_id) : undefined,
    }));

    const incList: ActivityItem[] = incomes.slice(0, 10).map((i) => ({
      id: i.id,
      type: "income",
      title: i.title,
      amount: i.amount,
      category: i.category,
      date: i.received_date,
      accountName: i.account_id ? accountLookup.get(i.account_id) : undefined,
    }));

    const trfList: ActivityItem[] = transfers.slice(0, 5).map((t) => {
      const fromName = accountLookup.get(t.from_account_id) || "Source";
      const toName = accountLookup.get(t.to_account_id) || "Destination";
      return {
        id: t.id,
        type: "transfer",
        title: `Transfer: ${fromName} → ${toName}`,
        amount: t.amount,
        category: "Transfer",
        date: t.transfer_date,
        notes: t.notes,
      };
    });

    return [...expList, ...incList, ...trfList]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [expenses, incomes, transfers, accounts]);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Header Bar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8 border-b border-[var(--app-border)]"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <h1
              suppressHydrationWarning
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--app-fg)] flex items-center gap-2 flex-wrap"
            >
              <span>
                {greeting}
                {formattedName && formattedName.toLowerCase() !== "user" ? `,` : ""}
              </span>
              {formattedName && formattedName.toLowerCase() !== "user" && (
                <span className="text-[var(--app-accent)]">
                  {formattedName.split(" ")[0]}
                </span>
              )}
              <span
                className="text-2xl sm:text-3xl select-none inline-block transition-transform hover:scale-110"
                role="img"
                aria-label={greeting}
              >
                {greetingEmoji}
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[var(--app-muted)] font-normal">
            Sovereign ledger overview, net worth telemetry, and real-time cash flow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" dot={true}>
            Realtime Telemetry Active
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl space-y-6 sm:space-y-8">
        {/* HERO CARD: Total Net Worth Card + Integrated Portfolio Asset Allocation */}
        <div
          className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 border relative overflow-hidden transition-all shadow-md group hover:border-[var(--app-border-hover)]"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          {/* Luminous Accent Pill Indicator on Left Border */}
          <span className="absolute left-0 top-7 bottom-7 w-1.5 bg-[var(--app-accent)] rounded-r-full shadow-[0_0_12px_var(--app-accent)]" />

          {/* Ambient Glow Gradient */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center relative z-10">
            {/* Left Column: Total Net Worth Summary */}
            <div className="lg:col-span-5 space-y-5">
              {/* Top Label & Recorded Balances Indicator */}
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--app-muted)]">
                <span className="font-semibold text-[var(--app-fg)]">Total Net Worth</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                <span className="text-[var(--app-muted)]">Assets − Liabilities</span>
              </div>

              {/* Massive Metric Amount */}
              <div className="space-y-1">
                <div className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-mono text-[var(--app-fg)] tabular-nums">
                  {loading ? (
                    <Skeleton className="h-14 w-64 rounded-xl" />
                  ) : (
                    formatCurrency(netWorth)
                  )}
                </div>
              </div>

              {/* Asset & Liability Quick Badges */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div
                  className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors"
                  style={{ backgroundColor: "var(--app-card-subtle)" }}
                >
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold">
                    Total Assets
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 mt-0.5 tabular-nums">
                    {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatCurrency(totalAssets)}
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors"
                  style={{ backgroundColor: "var(--app-card-subtle)" }}
                >
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold">
                    Total Liabilities
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-rose-400 mt-0.5 tabular-nums">
                    {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatCurrency(totalLiabilities)}
                  </div>
                </div>
              </div>

              {/* Sub-Badges Pill Row */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Badge variant="success" dot={true}>
                  {liquidPct}% Liquid Assets
                </Badge>
                {totalLiabilities > 0 && totalAssets > 0 && (
                  <Badge variant="danger">
                    {Math.round((totalLiabilities / totalAssets) * 100)}% Debt-to-Asset Ratio
                  </Badge>
                )}
              </div>
            </div>

            {/* Right Column: Asset Allocation Donut Chart & Color Legend */}
            <div
              className="lg:col-span-7 flex items-center justify-end border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-8 border-[var(--app-border-subtle)]"
            >
              {loading ? (
                <div className="flex items-center justify-center h-48 w-full">
                  <Skeleton className="w-40 h-40 rounded-full" />
                </div>
              ) : (
                <InteractiveDonutChart
                  title="Portfolio Asset Allocation"
                  totalLabel="Total Assets"
                  totalValue={totalAssets > 0 ? totalAssets : netWorth}
                  segments={donutSegments}
                  formatter={formatCurrency}
                  emptyMessage="No asset allocation data available."
                  emptySubMessage="Add bank accounts or cash in hand to see your portfolio breakdown."
                  icon={<PieChartIcon size={24} className="opacity-50 text-[var(--app-accent)]" />}
                />
              )}
            </div>
          </div>
        </div>

        {/* MONTHLY FINANCIAL PULSE (3 Key High-Impact Metrics) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {/* 1. Monthly Inflow */}
            <StatCard
              title="This Month's Inflow"
              value={formatCurrency(totalMonthIncome)}
              icon={<TrendingUp size={16} />}
              iconColor="emerald"
              trend={{
                direction: "up",
                value: `${currentMonthIncomes.length} Inflows`,
                label: "recorded this cycle",
              }}
              onClick={() => onNavigate?.("income")}
            />

            {/* 2. Monthly Outflow */}
            <StatCard
              title="This Month's Spend"
              value={formatCurrency(totalMonthExpense)}
              icon={<TrendingDown size={16} />}
              iconColor="rose"
              trend={{
                direction: "down",
                value: `~${formatCurrency(dailyBurnRate)}/day`,
                label: "daily burn rate",
              }}
              onClick={() => onNavigate?.("expenses")}
            />

            {/* 3. Net Savings Rate */}
            <StatCard
              title="Net Savings & Rate"
              value={
                <span className={netSavings >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {netSavings >= 0 ? "+" : ""}
                  {formatCurrency(netSavings)}
                </span>
              }
              icon={<PiggyBank size={16} />}
              iconColor="sky"
              subtitle={
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[var(--app-muted)]">Savings Rate</span>
                  <span className="font-mono text-emerald-400">{savingsRate}%</span>
                </div>
              }
              progress={{
                value: savingsRate,
                color: "#10b981",
              }}
              onClick={() => onNavigate?.("budgets")}
            />
          </div>
        )}

        {/* QUICK ACTIONS COMMAND BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.("accounts")}
            className="rounded-xl border border-[var(--app-border)] p-3.5 transition-all text-xs font-semibold text-[var(--app-fg)] flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] fintech-focus"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <Plus size={15} className="text-[var(--app-accent)]" />
            <span>Add Account</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("expenses")}
            className="rounded-xl border border-[var(--app-border)] p-3.5 transition-all text-xs font-semibold text-[var(--app-fg)] flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] fintech-focus"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <ArrowUpRight size={15} className="text-rose-400" />
            <span>Add Expense</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("income")}
            className="rounded-xl border border-[var(--app-border)] p-3.5 transition-all text-xs font-semibold text-[var(--app-fg)] flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] fintech-focus"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <ArrowDownLeft size={15} className="text-emerald-400" />
            <span>Add Income</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("accounts")}
            className="rounded-xl border border-[var(--app-border)] p-3.5 transition-all text-xs font-semibold text-[var(--app-fg)] flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] fintech-focus"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <ArrowLeftRight size={15} className="text-sky-400" />
            <span>Transfer Funds</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("budgets")}
            className="col-span-2 sm:col-span-1 rounded-xl border border-[var(--app-border)] p-3.5 transition-all text-xs font-semibold text-[var(--app-fg)] flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] fintech-focus"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <Target size={15} className="text-amber-400" />
            <span>Category Budgets</span>
          </button>
        </div>

        {/* TWO COLUMN ANALYTICS & INSIGHTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left Column: Top Spending Categories Breakdown */}
          <div
            className="lg:col-span-6 rounded-2xl p-5 sm:p-7 border border-[var(--app-border)] transition-all shadow-xs"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">
                  Top Spending Categories
                </h3>
                <p className="text-xs text-[var(--app-muted)] mt-0.5">
                  Monthly distribution of outflows
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("expenses")}
                className="text-xs font-semibold text-[var(--app-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {loading ? (
              <div className="space-y-4 pt-2">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
                <Skeleton className="h-4 w-4/6 rounded-md" />
              </div>
            ) : topExpenseCategories.length === 0 ? (
              <EmptyState
                compact={true}
                icon={<Target size={24} />}
                title="No expenses recorded this month"
                description="Log your everyday expenses in the Expenses tab to view dynamic category analytics."
                action={
                  <Button
                    size="xs"
                    variant="subtle"
                    icon={<Plus size={13} />}
                    onClick={() => onNavigate?.("expenses")}
                  >
                    Log an Expense
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {topExpenseCategories.map((item) => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-[var(--app-fg)] truncate">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono">
                        <span className="text-[var(--app-muted)]">{item.percentage}%</span>
                        <span className="font-bold text-[var(--app-fg)]">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Connected Accounts & Liquidity Strip */}
          <div
            className="lg:col-span-6 rounded-2xl p-5 sm:p-7 border border-[var(--app-border)] transition-all shadow-xs"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">
                  Connected Accounts
                </h3>
                <p className="text-xs text-[var(--app-muted)] mt-0.5">
                  {accounts.length} active {accounts.length === 1 ? "holding" : "holdings"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("accounts")}
                className="text-xs font-semibold text-[var(--app-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Accounts</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3 pt-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : accounts.length === 0 ? (
              <EmptyState
                compact={true}
                icon={<Landmark size={24} />}
                title="No accounts linked yet"
                description="Connect your bank accounts, credit cards, or cash holdings to activate portfolio tracking."
                action={
                  <Button
                    size="xs"
                    variant="subtle"
                    icon={<Plus size={13} />}
                    onClick={() => onNavigate?.("accounts")}
                  >
                    Add First Account
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {accounts.slice(0, 4).map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => onNavigate?.("accounts")}
                    className="flex items-center justify-between p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] transition-all cursor-pointer hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BankLogo name={acc.name} size={34} className="flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-[var(--app-fg)] truncate">
                          {acc.name}
                        </div>
                        <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-1.5">
                          <span>{acc.type}</span>
                          {acc.last_four && (
                            <>
                              <span>•</span>
                              <span className="font-mono">•••• {acc.last_four}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div
                        className={`font-mono font-bold text-xs sm:text-sm tabular-nums ${
                          acc.classification === "liability" ? "text-rose-400" : "text-[var(--app-fg)]"
                        }`}
                      >
                        {formatCurrency(acc.balance)}
                      </div>
                      <span
                        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                          acc.classification === "liability"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {acc.classification === "liability" ? "Liability" : "Asset"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT FINANCIAL ACTIVITY FEED */}
        <div
          className="rounded-2xl p-5 sm:p-7 border border-[var(--app-border)] transition-all shadow-xs"
          style={{ backgroundColor: "var(--app-card)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">
                Recent Financial Activity
              </h3>
              <p className="text-xs text-[var(--app-muted)] mt-0.5">
                Latest transactions across your active holdings
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("ledger")}
              className="flex items-center gap-1.5 text-xs font-bold text-[var(--app-accent)] hover:underline cursor-pointer"
            >
              <span>View All Transactions</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : recentActivities.length === 0 ? (
            <EmptyState
              compact={true}
              icon={<Clock size={24} />}
              title="No recent transactions recorded"
              description="Transactions you log in Expenses, Income, or Transfers will appear here in real time."
              action={
                <Button
                  size="xs"
                  variant="subtle"
                  icon={<Plus size={13} />}
                  onClick={() => onNavigate?.("expenses")}
                >
                  Record a Transaction
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--app-border-subtle)]">
              {recentActivities.map((act) => {
                const isIncome = act.type === "income";
                const isExpense = act.type === "expense";

                return (
                  <div
                    key={`${act.type}-${act.id}`}
                    className="py-3 sm:py-3.5 flex items-center justify-between gap-3 group transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        {isExpense ? (
                          <EntityLogo name={act.title} category={act.category} size={36} />
                        ) : isIncome ? (
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <TrendingUp size={16} />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center flex-shrink-0">
                            <ArrowLeftRight size={16} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[var(--app-fg)] truncate">
                          {act.title}
                        </div>
                        <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-2 mt-0.5">
                          {act.category && (
                            <span className="px-2 py-0.5 rounded-md border text-[10px] font-mono border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                              {act.category}
                            </span>
                          )}
                          <span>
                            {new Date(act.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          {act.accountName && (
                            <>
                              <span>•</span>
                              <span className="truncate">{act.accountName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div
                        className={`font-mono font-bold text-xs sm:text-sm tabular-nums ${
                          isIncome
                            ? "text-emerald-400"
                            : isExpense
                            ? "text-rose-400"
                            : "text-sky-400"
                        }`}
                      >
                        {isIncome ? "+" : isExpense ? "−" : ""}
                        {formatCurrency(act.amount)}
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--app-muted)]">
                        {act.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
