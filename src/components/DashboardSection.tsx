"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  PieChart as PieChartIcon,
  Loader2,
  Layers,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Target,
  Award,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import { getFromLocalCache, saveToCache } from "@/utils/cacheClient";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  classification?: "asset" | "liability";
}

function getInitialTimeGreeting(): { text: string; period: "morning" | "afternoon" | "evening" } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", period: "morning" };
  if (hour < 17) return { text: "Good afternoon", period: "afternoon" };
  return { text: "Good evening", period: "evening" };
}

function formatDisplayName(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => {
      // Keep initials uppercase e.g. "R", "K."
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
  const [currencyMode, setCurrencyMode] = useState<"INR" | "USD">("INR");
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
  const [loading, setLoading] = useState<boolean>(!initialCache);

  const displayName = profile?.name || name;

  const formattedName = useMemo(() => {
    return formatDisplayName(displayName);
  }, [displayName]);

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

      // Parallel concurrent burst: accounts
      const accountsRes = await supabase
        .from("accounts")
        .select("id, name, type, balance, classification")
        .eq("user_id", user.id);

      // 1. Resolve user display name from existing profile context
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
          classification: item.classification || (
            (item.type?.toLowerCase().includes("credit") || item.name?.toLowerCase().includes("credit") || item.type?.toLowerCase().includes("loan"))
              ? "liability"
              : "asset"
          ),
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

  // Vibrant high-contrast modern fintech color palette
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

  return (
    <main
      className="flex-1 h-full p-3.5 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Header (Matching Reference Design) */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Financial Overview
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-normal">
            Your money at a glance. Your next move within reach.
          </p>
        </div>

        {/* Currency Switcher Pill [ ₹ INR | $ USD ] */}
        <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs font-semibold select-none self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCurrencyMode("INR")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              currencyMode === "INR"
                ? "bg-white/[0.12] text-white shadow-sm border border-white/10 font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ₹ INR
          </button>
          <button
            type="button"
            onClick={() => setCurrencyMode("USD")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              currencyMode === "USD"
                ? "bg-white/[0.12] text-white shadow-sm border border-white/10 font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            $ USD
          </button>
        </div>
      </div>

      <div className="max-w-7xl space-y-6">
        {/* HERO CARD: Total Net Worth Card (Reference Design) */}
        <div
          className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 border relative overflow-hidden transition-all shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          {/* Vertical Accent Pill Indicator on Left Border */}
          <span className="absolute left-0 top-7 bottom-7 w-1 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.6)]" />

          <div className="space-y-4">
            {/* Top Label & Recorded Balances Indicator */}
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <span>Total Net Worth</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span className="text-zinc-500">Your Recorded Balances</span>
            </div>

            {/* Massive Metric Amount */}
            <div className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-mono text-white">
              {loading ? "..." : formatINR(netWorth)}
            </div>

            {/* Sub-Badges Pill Row */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <span className="w-2 h-2 rounded-xs bg-emerald-400" />
                100% Liquid Reserves
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <Award size={13} className="text-amber-400" />
                Realized Gain: +₹2,828.56
              </span>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS BUTTONS BAR (Reference Design) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.("accounts")}
            className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold text-white flex items-center justify-center gap-2 py-3 px-3 cursor-pointer shadow-sm active:scale-98"
          >
            <Plus size={15} className="opacity-80" />
            <span>Add Account</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("expenses")}
            className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold text-white flex items-center justify-center gap-2 py-3 px-3 cursor-pointer shadow-sm active:scale-98"
          >
            <ArrowUpRight size={15} className="opacity-80 text-rose-400" />
            <span>Add Expense</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("income")}
            className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold text-white flex items-center justify-center gap-2 py-3 px-3 cursor-pointer shadow-sm active:scale-98"
          >
            <ArrowDownLeft size={15} className="opacity-80 text-emerald-400" />
            <span>Add Income</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("accounts")}
            className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold text-white flex items-center justify-center gap-2 py-3 px-3 cursor-pointer shadow-sm active:scale-98"
          >
            <ArrowLeftRight size={15} className="opacity-80 text-sky-400" />
            <span>Transfer Money</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("budgets")}
            className="col-span-2 sm:col-span-1 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold text-white flex items-center justify-center gap-2 py-3 px-3 cursor-pointer shadow-sm active:scale-98"
          >
            <Target size={15} className="opacity-80 text-amber-400" />
            <span>Add Goal</span>
          </button>
        </div>

        {/* ASSET ALLOCATION DONUT BREAKDOWN */}
        <div
          className="rounded-2xl p-5 sm:p-7 border transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-44 w-full">
              <Loader2 size={24} className="animate-spin opacity-50" />
            </div>
          ) : (
            <InteractiveDonutChart
              title="Portfolio Asset Allocation"
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
    </main>
  );
}
