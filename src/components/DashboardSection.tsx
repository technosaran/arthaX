"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ShieldCheck, PieChart as PieChartIcon, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  getCurrentMonthYear,
  formatMonthDisplay,
  getEarliestDataMonth,
  computeNextMonth,
  computePrevMonth,
} from "@/utils/monthUtils";

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export default function DashboardSection() {
  const { user, profile } = useAuth();
  const [greeting, setGreeting] = useState("");
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const [netWorth, setNetWorth] = useState<number>(0);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active month in YYYY-MM format with strict boundary constraints
  const currentMonthYear = React.useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => getCurrentMonthYear());
  const [earliestMonthYear, setEarliestMonthYear] = useState<string>(() => getCurrentMonthYear());

  // Clamp selectedMonthYear so it cannot be in the future or before earliest data
  useEffect(() => {
    if (selectedMonthYear > currentMonthYear) {
      setSelectedMonthYear(currentMonthYear);
    } else if (earliestMonthYear && selectedMonthYear < earliestMonthYear) {
      setSelectedMonthYear(earliestMonthYear);
    }
  }, [selectedMonthYear, currentMonthYear, earliestMonthYear]);

  const canGoPrev = selectedMonthYear > earliestMonthYear;
  const canGoNext = selectedMonthYear < currentMonthYear;
  const isCurrentMonth = selectedMonthYear === currentMonthYear;

  const monthDisplayTitle = React.useMemo(() => {
    return formatMonthDisplay(selectedMonthYear);
  }, [selectedMonthYear]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setSelectedMonthYear((prev) => computePrevMonth(prev, earliestMonthYear));
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setSelectedMonthYear((prev) => computeNextMonth(prev, currentMonthYear));
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonthYear(currentMonthYear);
  };

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

      // 1. Fetch greeting name
      const { data: userData } = await supabase
        .from("user_settings")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      if (userData?.name) {
        setName(userData.name);
      } else if (profile?.name) {
        setName(profile.name);
      } else {
        setName(user.user_metadata?.full_name || user.email?.split("@")[0] || "User");
      }

      // 2. Fetch all accounts with type and balance
      const { data: accountsData } = await supabase
        .from("accounts")
        .select("id, name, type, balance")
        .eq("user_id", user.id);

      if (accountsData && accountsData.length > 0) {
        const mapped: AccountItem[] = accountsData.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          balance: Number(item.balance) || 0,
        }));
        setAccounts(mapped);
        const total = mapped.reduce((acc, curr) => acc + curr.balance, 0);
        setNetWorth(total);
      } else {
        setAccounts([]);
        setNetWorth(0);
      }

      // 3. Discover earliest activity month across accounts, income, and expenses
      const [accEarliest, incEarliest, expEarliest] = await Promise.all([
        supabase.from("accounts").select("created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("income").select("received_date").eq("user_id", user.id).order("received_date", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("expenses").select("expense_date").eq("user_id", user.id).order("expense_date", { ascending: true }).limit(1).maybeSingle(),
      ]);

      const candidateMonths = [
        accEarliest.data?.created_at,
        incEarliest.data?.received_date,
        expEarliest.data?.expense_date,
      ];
      setEarliestMonthYear(getEarliestDataMonth(candidateMonths, currentMonthYear));
    } catch (err) {
      console.warn("Error fetching dashboard telemetry:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile, currentMonthYear]);

  useEffect(() => {
    // Determine greeting & emoji
    const currentHour = new Date().getHours();
    let timeGreeting = "Good morning";
    let timeEmoji = "☀️";

    if (currentHour >= 12 && currentHour < 17) {
      timeGreeting = "Good afternoon";
      timeEmoji = "🌤️";
    } else if (currentHour >= 17) {
      timeGreeting = "Good evening";
      timeEmoji = "🌙";
    }

    setGreeting(timeGreeting);
    setEmoji(timeEmoji);

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

  // Vibrant high-contrast fintech color palette
  const chartPalette = [
    "#10B981", // Emerald Green (Cash / Savings)
    "#3B82F6", // Royal Blue (HDFC / Banking)
    "#8B5CF6", // Purple / Violet (Fixed Deposits)
    "#06B6D4", // Neon Cyan (Investments / Demat)
    "#F59E0B", // Bright Amber / Gold
    "#EC4899", // Vivid Pink
    "#F43F5E", // Coral Rose
    "#14B8A6", // Teal
  ];

  // Group portfolio assets by type for the colorful allocation chart
  const typeMap = accounts.reduce((acc, curr) => {
    const key = curr.type || curr.name || "Other";
    acc[key] = (acc[key] || 0) + curr.balance;
    return acc;
  }, {} as Record<string, number>);

  const chartSegments = Object.entries(typeMap)
    .filter(([_, bal]) => bal > 0)
    .map(([catType, catBalance], index) => {
      const percentage = netWorth > 0 ? (catBalance / netWorth) * 100 : 0;
      return {
        type: catType,
        balance: catBalance,
        percentage,
        color: chartPalette[index % chartPalette.length],
      };
    });

  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  return (
    <main
      className="flex-1 h-screen p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Header */}
      <div
        className="pb-6 mb-8 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <span>{greeting}{name ? `, ${name}` : ""}</span>
              <span className="text-2xl select-none">{emoji}</span>
            </h1>
            <p className="text-xs opacity-70 mt-1.5 font-medium">
              Real-time portfolio telemetry, liquid liquidity & capital analytics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Stepper */}
            <div
              className="flex items-center rounded-xl border p-0.5 text-xs font-mono"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              <button
                onClick={handlePrevMonth}
                disabled={!canGoPrev}
                title={!canGoPrev ? "No earlier portfolio records" : "Previous Month"}
                className={`p-1.5 rounded-lg transition-all ${
                  !canGoPrev
                    ? "opacity-25 cursor-not-allowed"
                    : "opacity-70 hover:opacity-100 cursor-pointer"
                }`}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 font-semibold min-w-[110px] text-center">
                {monthDisplayTitle}
              </span>
              <button
                onClick={handleNextMonth}
                disabled={!canGoNext}
                title={!canGoNext ? "Future months are not yet available" : "Next Month"}
                className={`p-1.5 rounded-lg transition-all ${
                  !canGoNext
                    ? "opacity-25 cursor-not-allowed"
                    : "opacity-70 hover:opacity-100 cursor-pointer"
                }`}
              >
                <ChevronRight size={14} />
              </button>
              {!isCurrentMonth && (
                <button
                  onClick={handleResetToCurrentMonth}
                  className="ml-1 px-2 py-1 text-[10px] uppercase font-bold rounded-md border cursor-pointer opacity-70 hover:opacity-100"
                  style={{ borderColor: "var(--app-border-subtle)" }}
                >
                  Today
                </button>
              )}
            </div>

            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
                color: "var(--app-fg)",
              }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-400" />
              Live Telemetry
            </span>
          </div>
        </div>
      </div>

      {/* Big Total Net Worth Card with Pie Chart on Right */}
      <div
        className="rounded-2xl p-6 sm:p-8 border max-w-7xl transition-colors shadow-sm"
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
                Live portfolio valuation across connected accounts and liquid assets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-[11px] font-mono opacity-80"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <ShieldCheck size={13} className="text-emerald-400" />
                {accounts.length} {accounts.length === 1 ? "Connected Account" : "Connected Accounts"}
              </span>
              {chartSegments.length > 0 && (
                <span
                  className="px-3 py-1 rounded-md border text-[11px] font-mono opacity-80"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  {chartSegments.length} {chartSegments.length === 1 ? "Asset Class" : "Asset Classes"}
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Asset Allocation Donut Chart & Legend */}
          <div
            className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-8 justify-end border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-8"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Loader2 size={24} className="animate-spin opacity-50" />
              </div>
            ) : accounts.length === 0 || netWorth <= 0 || chartSegments.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs opacity-60 w-full">
                <PieChartIcon size={28} className="opacity-40 mb-2" />
                <p>No allocation data available.</p>
                <p className="text-[11px] mt-1">
                  Add accounts or cash in hand to see your portfolio breakdown.
                </p>
              </div>
            ) : (
              <>
                {/* Colorful SVG Donut Chart */}
                <div className="flex justify-center items-center relative flex-shrink-0">
                  <svg
                    width="160"
                    height="160"
                    viewBox="0 0 120 120"
                    className="transform -rotate-90"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="none"
                      stroke="var(--app-border-subtle)"
                      strokeWidth="14"
                    />
                    {(() => {
                      let cumulativeOffset = 0;
                      return chartSegments.map((segment, idx) => {
                        const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
                        const offset = cumulativeOffset;
                        cumulativeOffset += (segment.percentage / 100) * circumference;

                        return (
                          <circle
                            key={idx}
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="14"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={-offset}
                            className="transition-all duration-500 ease-out"
                          />
                        );
                      });
                    })()}
                  </svg>

                  {/* Donut Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
                    <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">
                      Total Assets
                    </span>
                    <span className="text-[12px] font-bold font-mono tracking-tight">
                      {formatINR(netWorth)}
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2.5 w-full sm:max-w-xs">
                  <div
                    className="flex items-center justify-between pb-1.5 border-b"
                    style={{ borderColor: "var(--app-border-subtle)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <PieChartIcon size={13} className="opacity-70" />
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                        Asset Allocation
                      </span>
                    </div>
                    <span className="text-[10px] font-mono opacity-50">
                      {chartSegments.length} {chartSegments.length === 1 ? "Class" : "Classes"}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {chartSegments.map((segment, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: segment.color }}
                          />
                          <span className="truncate opacity-80 text-[11px] font-medium">
                            {segment.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono flex-shrink-0 text-[11px]">
                          <span className="font-bold">
                            {segment.percentage.toFixed(1)}%
                          </span>
                          <span className="opacity-50 text-[10px]">
                            ({formatINR(segment.balance)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
