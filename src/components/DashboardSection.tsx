"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  PieChart as PieChartIcon,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sun,
  SunMedium,
  Moon,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getFromLocalCache, saveToCache } from "@/utils/cacheClient";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import InteractiveLineChart, { LinePoint } from "@/components/charts/InteractiveLineChart";

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface MonthHistoryItem {
  key: string;
  label: string;
  fullLabel: string;
  income: number;
  expenses: number;
  net: number;
}

function getInitialTimeGreeting(): { text: string; period: "morning" | "afternoon" | "evening" } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", period: "morning" };
  if (hour < 17) return { text: "Good afternoon", period: "afternoon" };
  return { text: "Good evening", period: "evening" };
}

export default function DashboardSection() {
  const { user, profile } = useAuth();
  const [greeting, setGreeting] = useState(() => getInitialTimeGreeting().text);
  const [timePeriod, setTimePeriod] = useState<"morning" | "afternoon" | "evening">(() => getInitialTimeGreeting().period);

  const redisPortfolioKey = getUserCacheKey(user?.id, CACHE_KEYS.PORTFOLIO);

  // Instant Tier 1 & 2 Local Cache load (0ms latency)
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
  const [monthlyHistory, setMonthlyHistory] = useState<MonthHistoryItem[]>([]);
  const [trajectoryMode, setTrajectoryMode] = useState<"net" | "income" | "expenses">("net");
  const [loading, setLoading] = useState<boolean>(!initialCache);

  const displayName = profile?.name || name;

  const initials = useMemo(() => {
    const source = displayName || user?.user_metadata?.full_name || user?.email || "";
    if (!source) return "U";
    const parts = source.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.substring(0, 2).toUpperCase();
  }, [displayName, user]);

  // Synchronize greeting name whenever profile arrives or updates
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    }
  }, [profile?.name]);

  // Format currency into Indian Numbering System (e.g. ₹1,48,92,450.00)
  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createClient();

      // Parallel concurrent burst: telemetry queries run simultaneously
      const [userDataRes, accountsRes, expensesRes, incomeRes] = await Promise.all([
        supabase.from("user_settings").select("name").eq("id", user.id).maybeSingle(),
        supabase.from("accounts").select("id, name, type, balance").eq("user_id", user.id),
        supabase.from("expenses").select("amount, expense_date").eq("user_id", user.id),
        supabase.from("income").select("amount, received_date").eq("user_id", user.id),
      ]);

      // 1. Resolve user display name
      const resolvedName =
        userDataRes.data?.name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "User";
      setName(resolvedName);

      // 2. Resolve accounts and net worth
      let mapped: AccountItem[] = [];
      let total = 0;
      if (accountsRes.data && accountsRes.data.length > 0) {
        mapped = accountsRes.data.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          balance: Number(item.balance) || 0,
        }));
        total = mapped.reduce((acc, curr) => acc + curr.balance, 0);
      }
      setAccounts(mapped);
      setNetWorth(total);

      // 3. Compute 6-Month Trajectory History
      const months: MonthHistoryItem[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("default", { month: "short" });
        const fullLabel = d.toLocaleString("default", { month: "long", year: "numeric" });
        months.push({ key, label, fullLabel, income: 0, expenses: 0, net: 0 });
      }

      if (incomeRes.data) {
        incomeRes.data.forEach((inc: any) => {
          if (inc.received_date) {
            const incKey = inc.received_date.substring(0, 7);
            const target = months.find((m) => m.key === incKey);
            if (target) {
              target.income += Number(inc.amount) || 0;
            }
          }
        });
      }

      if (expensesRes.data) {
        expensesRes.data.forEach((exp: any) => {
          if (exp.expense_date) {
            const expKey = exp.expense_date.substring(0, 7);
            const target = months.find((m) => m.key === expKey);
            if (target) {
              target.expenses += Number(exp.amount) || 0;
            }
          }
        });
      }

      // Compute Net Cash Flow per month
      months.forEach((m) => {
        m.net = Math.max(0, m.income - m.expenses);
      });

      setMonthlyHistory(months);

      // 4. Update multi-tier cache
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
  }, [user, redisPortfolioKey]);

  useEffect(() => {
    // Determine greeting & time period symbol
    const currentHour = new Date().getHours();
    let timeGreeting = "Good morning";
    let period: "morning" | "afternoon" | "evening" = "morning";

    if (currentHour >= 12 && currentHour < 17) {
      timeGreeting = "Good afternoon";
      period = "afternoon";
    } else if (currentHour >= 17) {
      timeGreeting = "Good evening";
      period = "evening";
    }

    setGreeting(timeGreeting);
    setTimePeriod(period);

    if (!user) return;

    fetchDashboardData();

    // Cross-device Realtime synchronization for Dashboard (isolated to this user)
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
      supabase.removeChannel(channel);
    };
  }, [user, fetchDashboardData]);

  // Vibrant high-contrast fintech color palette (Zerodha Kite Green & Red standard)
  const chartPalette = [
    "#4bb473", // Zerodha Kite Green (Cash / Savings)
    "#3B82F6", // Royal Blue (HDFC / Banking)
    "#8B5CF6", // Purple / Violet (Fixed Deposits)
    "#06B6D4", // Neon Cyan (Investments / Demat)
    "#F59E0B", // Bright Amber / Gold
    "#EC4899", // Vivid Pink
    "#df514c", // Zerodha Kite Red
    "#14B8A6", // Teal
  ];

  // Group portfolio assets by type for the colorful allocation chart
  const typeMap = accounts.reduce((acc, curr) => {
    const key = curr.type || curr.name || "Other";
    acc[key] = (acc[key] || 0) + curr.balance;
    return acc;
  }, {} as Record<string, number>);

  const donutSegments: DonutSegment[] = Object.entries(typeMap)
    .filter(([_, bal]) => bal > 0)
    .map(([catType, catBalance], index) => ({
      label: catType,
      value: catBalance,
      color: chartPalette[index % chartPalette.length],
    }));

  // Line chart data points based on selected trajectory mode
  const linePoints: LinePoint[] = useMemo(() => {
    return monthlyHistory.map((m) => ({
      key: m.key,
      label: m.label,
      fullLabel: m.fullLabel,
      value:
        trajectoryMode === "net"
          ? m.net
          : trajectoryMode === "income"
          ? m.income
          : m.expenses,
    }));
  }, [monthlyHistory, trajectoryMode]);

  const total6MonthInflow = monthlyHistory.reduce((acc, curr) => acc + curr.income, 0);
  const total6MonthOutflow = monthlyHistory.reduce((acc, curr) => acc + curr.expenses, 0);
  const total6MonthSavings = Math.max(0, total6MonthInflow - total6MonthOutflow);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Header */}
      <div
        className="pb-6 mb-8 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-[2.5rem] font-extrabold tracking-tight flex items-center gap-3">
              <span>{greeting}{displayName ? `, ${displayName}` : ""}</span>
              <span
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border select-none flex-shrink-0 shadow-sm"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                }}
                title={timePeriod === "morning" ? "Morning" : timePeriod === "afternoon" ? "Afternoon" : "Evening"}
              >
                {timePeriod === "morning" && <Sun size={22} className="text-amber-400" />}
                {timePeriod === "afternoon" && <SunMedium size={22} className="text-amber-400" />}
                {timePeriod === "evening" && <Moon size={22} className="text-indigo-400" />}
              </span>
            </h1>
            <p className="text-xs sm:text-sm opacity-70 mt-2 font-medium">
              Overview of your accounts, income, and spending.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl space-y-6">
        {/* CARD 1: Big Total Net Worth Card with Interactive Pie Chart on Right */}
        <div
          className="rounded-2xl p-6 sm:p-8 border transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Total Net Worth Summary */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold opacity-70">
                  Total Net Worth
                </span>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded border font-mono"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                    color: "var(--app-fg)",
                  }}
                >
                  INR (₹)
                </span>
              </div>

              <div>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono tracking-tight">
                  {loading ? "..." : formatINR(netWorth)}
                </div>
                <p className="text-xs opacity-60 mt-1.5">
                  Total balance across all your connected accounts and cash.
                </p>
              </div>

              {/* Holdings Count Pill */}
              <div className="flex items-center gap-2 pt-2">
                <div
                  className="px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  <Layers size={13} className="text-[#4bb473]" />
                  <span className="font-bold">{accounts.length}</span>
                  <span className="opacity-60">{accounts.length === 1 ? "Account" : "Accounts"}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Asset Allocation Donut Chart & Interactive Legend */}
            <div
              className="lg:col-span-7 flex items-center justify-end border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-8"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-44 w-full">
                  <Loader2 size={24} className="animate-spin opacity-50" />
                </div>
              ) : (
                <InteractiveDonutChart
                  title="Asset Allocation"
                  totalLabel="Total Assets"
                  totalValue={netWorth}
                  segments={donutSegments}
                  formatter={formatINR}
                  emptyMessage="No allocation data available."
                  emptySubMessage="Add accounts or cash in hand to see your portfolio breakdown."
                  icon={<PieChartIcon size={24} className="opacity-50 text-[var(--app-accent)]" />}
                />
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: Interactive 6-Month Cash Flow & Capital Trajectory Line Chart */}
        <div
          className="rounded-2xl p-6 sm:p-8 border transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          {/* Top Bar with Trajectory Mode Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
            <div>
              <h3 className="text-base font-bold tracking-tight">6-Month Capital Trajectory</h3>
              <p className="text-xs opacity-60 font-mono mt-0.5">
                Monthly Inflow, Outflow & Savings Trend
              </p>
            </div>

            {/* Mode Switcher Segmented Control */}
            <div
              className="flex items-center p-1 rounded-xl border self-start sm:self-auto"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <button
                onClick={() => setTrajectoryMode("net")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  trajectoryMode === "net"
                    ? "shadow-sm"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: trajectoryMode === "net" ? "var(--app-card)" : "transparent",
                  color: trajectoryMode === "net" ? "#4bb473" : "inherit",
                }}
              >
                Net Savings
              </button>
              <button
                onClick={() => setTrajectoryMode("income")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  trajectoryMode === "income"
                    ? "shadow-sm"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: trajectoryMode === "income" ? "var(--app-card)" : "transparent",
                  color: trajectoryMode === "income" ? "#4bb473" : "inherit",
                }}
              >
                Inflow
              </button>
              <button
                onClick={() => setTrajectoryMode("expenses")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  trajectoryMode === "expenses"
                    ? "shadow-sm"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: trajectoryMode === "expenses" ? "var(--app-card)" : "transparent",
                  color: trajectoryMode === "expenses" ? "#df514c" : "inherit",
                }}
              >
                Outflow
              </button>
            </div>
          </div>

          {/* Quick 6-Month Summary Statistics Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div
              className="p-3.5 rounded-xl border flex items-center justify-between"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">6-Mo Gross Inflow</span>
                <div className="text-base font-extrabold font-mono text-[#4bb473] mt-0.5">
                  {formatINR(total6MonthInflow)}
                </div>
              </div>
              <ArrowUpRight size={18} className="text-[#4bb473] opacity-80" />
            </div>

            <div
              className="p-3.5 rounded-xl border flex items-center justify-between"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">6-Mo Gross Outflow</span>
                <div className="text-base font-extrabold font-mono text-[#df514c] mt-0.5">
                  {formatINR(total6MonthOutflow)}
                </div>
              </div>
              <ArrowDownRight size={18} className="text-[#df514c] opacity-80" />
            </div>

            <div
              className="p-3.5 rounded-xl border flex items-center justify-between"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">6-Mo Net Retained</span>
                <div className="text-base font-extrabold font-mono text-[#4bb473] mt-0.5">
                  {formatINR(total6MonthSavings)}
                </div>
              </div>
              <TrendingUp size={18} className="text-[#4bb473] opacity-80" />
            </div>
          </div>

          {/* Interactive Line Chart Component */}
          {loading ? (
            <div className="flex items-center justify-center h-48 w-full">
              <Loader2 size={24} className="animate-spin opacity-50" />
            </div>
          ) : (
            <InteractiveLineChart
              data={linePoints}
              color={trajectoryMode === "expenses" ? "#df514c" : "#4bb473"}
              gradientId="dashboardTrajectoryGradient"
              formatter={formatINR}
              type={trajectoryMode === "expenses" ? "expense" : "income"}
              emptyMessage="No financial transaction records recorded in the past 6 months."
            />
          )}
        </div>
      </div>
    </main>
  );
}
