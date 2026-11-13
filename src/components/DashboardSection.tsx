"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  PieChart as PieChartIcon,
  Loader2,
  Layers,
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
      {/* Header */}
      <div
        className="pb-5 sm:pb-6 mb-6 sm:mb-8 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2 flex-wrap">
            <span>{greeting},</span>
            <span style={{ color: "var(--app-accent)" }}>
              {formattedName || "User"}
            </span>
            <span className="text-2xl select-none inline-block">
              {timePeriod === "evening" ? "🌙" : timePeriod === "morning" ? "☀️" : "🌤️"}
            </span>
          </h1>
          <p className="text-xs sm:text-sm opacity-70 mt-1.5 font-medium">
            Overview of your accounts, income, and spending.
          </p>
        </div>
      </div>

      <div className="max-w-7xl space-y-6">
        {/* CARD 1: Big Total Net Worth Card with Interactive Pie Chart on Right */}
        <div
          className="rounded-2xl p-4 sm:p-6 md:p-8 border transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
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
                <div className="text-2xl sm:text-4xl lg:text-5xl font-extrabold font-mono tracking-tight break-all sm:break-normal">
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
                  <Layers size={13} className="text-emerald-400" />
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
      </div>
    </main>
  );
}
