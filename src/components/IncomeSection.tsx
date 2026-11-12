"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  X,
  TrendingUp,
  Calendar,
  Wallet,
  ArrowUpRight,
  Pencil,
  Sparkles,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  Repeat,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import BankLogo from "@/components/BankLogo";
import EntityLogo from "@/components/EntityLogo";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import InteractiveLineChart, { LinePoint } from "@/components/charts/InteractiveLineChart";
import { saveToCache, invalidateCacheKeys, getFromLocalCache } from "@/utils/cacheClient";
import {
  getCurrentMonthYear,
  formatMonthDisplay,
  getEarliestDataMonth,
  computeNextMonth,
  computePrevMonth,
} from "@/utils/monthUtils";

interface IncomeItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  frequency: string;
  account_id?: string | null;
  received_date: string;
  notes?: string | null;
  created_at?: string;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
}

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Dividends",
  "Interest",
  "Rental",
  "Capital Gains",
  "Bonus",
  "Crypto & Web3",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  Salary: "#4bb473", // Zerodha Kite Green
  Freelance: "#8B5CF6", // Violet
  Business: "#F59E0B", // Amber
  Dividends: "#06B6D4", // Cyan
  Interest: "#3B82F6", // Royal Blue
  Rental: "#df514c", // Zerodha Kite Red
  "Capital Gains": "#EC4899", // Pink
  Bonus: "#14B8A6", // Teal
  "Crypto & Web3": "#F97316", // Orange
  Other: "#71717A", // Slate
};

const FREQUENCIES = ["Monthly", "One-time", "Weekly", "Yearly", "Quarterly"];

const QUICK_PRESETS = [
  { label: "Primary Salary", title: "Primary Tech Salary", amount: 120000, category: "Salary", frequency: "Monthly" },
  { label: "Freelance Gig", title: "Web & UI Consulting Gig", amount: 45000, category: "Freelance", frequency: "One-time" },
  { label: "Stock Dividends", title: "Quarterly Stock Dividend Yield", amount: 8500, category: "Dividends", frequency: "Quarterly" },
  { label: "Bank Interest", title: "FD & Savings Accrued Interest", amount: 3200, category: "Interest", frequency: "Quarterly" },
  { label: "House Rent", title: "Real Estate Rental Inflow", amount: 18000, category: "Rental", frequency: "Monthly" },
  { label: "Annual Bonus", title: "Performance Bonus Inflow", amount: 50000, category: "Bonus", frequency: "One-time" },
];

export default function IncomeSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const redisIncomeKey = getUserCacheKey(user?.id, CACHE_KEYS.INCOME);
  const redisAccountsKey = getUserCacheKey(user?.id, CACHE_KEYS.ACCOUNTS);
  const redisLedgerKey = getUserCacheKey(user?.id, CACHE_KEYS.LEDGER);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency)
  const initialIncomes = useMemo(() => {
    return getFromLocalCache<IncomeItem[]>(redisIncomeKey) || [];
  }, [redisIncomeKey]);

  const initialAccounts = useMemo(() => {
    return getFromLocalCache<AccountItem[]>(redisAccountsKey) || [];
  }, [redisAccountsKey]);

  const [incomes, setIncomes] = useState<IncomeItem[]>(initialIncomes);
  const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts);
  const [loading, setLoading] = useState<boolean>(initialIncomes.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeItem | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Salary");
  const [frequency, setFrequency] = useState("Monthly");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState<string>("");
  const [creditToAccount, setCreditToAccount] = useState(true);
  const [notes, setNotes] = useState("");

  // Active month in YYYY-MM format with strict boundary constraints
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => getCurrentMonthYear());
  const [isAllTime, setIsAllTime] = useState<boolean>(false);

  // Compute earliest month that actually has income data
  const earliestMonthYear = useMemo(() => {
    return getEarliestDataMonth(
      incomes.map((i) => i.received_date),
      currentMonthYear
    );
  }, [incomes, currentMonthYear]);

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

  const monthDisplayTitle = useMemo(() => {
    return formatMonthDisplay(selectedMonthYear);
  }, [selectedMonthYear]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setIsAllTime(false);
    setSelectedMonthYear((prev) => computePrevMonth(prev, earliestMonthYear));
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setIsAllTime(false);
    setSelectedMonthYear((prev) => computeNextMonth(prev, currentMonthYear));
  };

  const handleResetToCurrentMonth = () => {
    setIsAllTime(false);
    setSelectedMonthYear(currentMonthYear);
  };

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return "";
    try {
      const parts = dStr.split("-");
      if (parts.length !== 3) return dStr;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return dStr;

      const date = new Date(y, m - 1, d);
      const today = new Date();
      const isToday =
        today.getFullYear() === y &&
        today.getMonth() === m - 1 &&
        today.getDate() === d;

      const formatted = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return isToday ? `Today, ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : formatted;
    } catch {
      return dStr;
    }
  };

  // 1. Fetch Accounts for linking
  const fetchAccounts = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    if (!skipCache) {
      const cached = getFromLocalCache<any[]>(redisAccountsKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setAccounts(cached);
      }
    }

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("accounts")
        .select("id, name, type, balance, last_four")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (data) {
        const mapped = data.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: Number(a.balance) || 0,
          last_four: a.last_four,
        }));
        setAccounts(mapped);
        saveToCache(redisAccountsKey, mapped, 3600);
      }
    } catch {
      // Non-blocking
    }
  }, [user, redisAccountsKey]);

  // 2. Fetch Income records
  const fetchIncome = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    setErrorMsg(null);

    // Instant local cache check
    if (!skipCache) {
      const cached = getFromLocalCache<IncomeItem[]>(redisIncomeKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setIncomes(cached);
        setLoading(false);
      }
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .eq("user_id", user.id)
        .order("received_date", { ascending: false });

      if (error) {
        setErrorMsg("Unable to retrieve income records. Please try again.");
      } else if (data) {
        const mapped: IncomeItem[] = data.map((item) => ({
          id: item.id,
          title: item.title,
          amount: Number(item.amount) || 0,
          category: item.category,
          frequency: item.frequency,
          account_id: item.account_id,
          received_date: item.received_date,
          notes: item.notes,
          created_at: item.created_at,
        }));

        setIncomes(mapped);

        // Update Multi-Tier Cache
        saveToCache(redisIncomeKey, mapped, 3600);
      }
    } catch {
      setErrorMsg("Unable to load income records.");
    } finally {
      setLoading(false);
    }
  }, [user, redisIncomeKey]);

  useEffect(() => {
    if (!user) return;
    fetchIncome();
    fetchAccounts();

    // Realtime Supabase broadcast subscription scoped to user
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-income-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "income",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchIncome(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAccounts(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchIncome, fetchAccounts]);

  const openAddModal = () => {
    setEditingIncome(null);
    setTitle("");
    setAmount("");
    setCategory("Salary");
    setFrequency("Monthly");
    setReceivedDate(new Date().toISOString().split("T")[0]);
    setAccountId("");
    setCreditToAccount(true);
    setNotes("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: IncomeItem) => {
    setEditingIncome(item);
    setTitle(item.title);
    setAmount(item.amount.toString());
    setCategory(item.category);
    setFrequency(item.frequency);
    setReceivedDate(item.received_date);
    setAccountId(item.account_id || "");
    setCreditToAccount(false); // Default false on edit
    setNotes(item.notes || "");
    setIsModalOpen(true);
  };

  const applyPreset = (preset: (typeof QUICK_PRESETS)[0]) => {
    setTitle(preset.title);
    setAmount(preset.amount.toString());
    setCategory(preset.category);
    setFrequency(preset.frequency);
  };

  const handleSubmitIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Invalid Input", "Please enter a valid title and positive amount.", "error");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      if (editingIncome) {
        // Edit flow
        const { error } = await supabase
          .from("income")
          .update({
            title: title.trim(),
            amount: parsedAmount,
            category,
            frequency,
            account_id: accountId || null,
            received_date: receivedDate,
            notes: notes.trim() || null,
          })
          .eq("id", editingIncome.id)
          .eq("user_id", user.id);

        if (error) {
          showToast("Update Failed", error.message || "Failed to update record.", "error");
        } else {
          showToast("Income Updated", `${title.trim()} (${formatINR(parsedAmount)}) updated.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisIncomeKey,
            redisAccountsKey,
            redisLedgerKey,
            "arthax:cache:income",
            "arthax:cache:accounts",
            "arthax:cache:ledger",
          ]);
          await fetchIncome(true);
          await fetchAccounts(true);
        }
      } else {
        // Create flow
        const { error } = await supabase.from("income").insert([
          {
            user_id: user.id,
            title: title.trim(),
            amount: parsedAmount,
            category,
            frequency,
            account_id: accountId || null,
            received_date: receivedDate,
            notes: notes.trim() || null,
          },
        ]);

        if (error) {
          showToast("Record Failed", error.message || "Please check inputs.", "error");
        } else {
          // If user selected an account & checked credit balance
          if (accountId && creditToAccount) {
            const targetAcc = accounts.find((a) => a.id === accountId);
            if (targetAcc) {
              const updatedBal = targetAcc.balance + parsedAmount;
              await supabase
                .from("accounts")
                .update({ balance: updatedBal })
                .eq("id", accountId)
                .eq("user_id", user.id);
            }
          }

          showToast("Income Recorded", `${title.trim()} (${formatINR(parsedAmount)}) added.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisIncomeKey,
            redisAccountsKey,
            redisLedgerKey,
            "arthax:cache:income",
            "arthax:cache:accounts",
            "arthax:cache:ledger",
          ]);
          await fetchIncome(true);
          await fetchAccounts(true);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      showToast("Operation Failed", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIncome = async (id: string, name: string) => {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("income")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      showToast("Delete Failed", "Could not remove income record.", "error");
    } else {
      showToast("Income Removed", `${name} has been deleted.`, "info");
      await invalidateCacheKeys([
        redisIncomeKey,
        redisAccountsKey,
        redisLedgerKey,
        "arthax:cache:income",
        "arthax:cache:accounts",
        "arthax:cache:ledger",
      ]);
      await fetchIncome(true);
    }
  };

  // Filtered income based on active month
  const displayedIncomes = useMemo(() => {
    if (isAllTime) return incomes;
    return incomes.filter((i) => i.received_date && i.received_date.startsWith(selectedMonthYear));
  }, [incomes, isAllTime, selectedMonthYear]);

  // Telemetry Calculations
  const totalMonthlyIncome = useMemo(() => {
    return displayedIncomes.reduce((acc, curr) => {
      const amt = curr.amount;
      if (curr.frequency === "Monthly") return acc + amt;
      if (curr.frequency === "Weekly") return acc + amt * 4.33;
      if (curr.frequency === "Yearly") return acc + amt / 12;
      if (curr.frequency === "Quarterly") return acc + amt / 3;
      return acc + amt;
    }, 0);
  }, [displayedIncomes]);

  const totalAnnualInflow = totalMonthlyIncome * 12;

  const totalRawIncome = useMemo(() => {
    return displayedIncomes.reduce((acc, curr) => acc + curr.amount, 0);
  }, [displayedIncomes]);

  const categoryTotals = useMemo(() => {
    return displayedIncomes.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [displayedIncomes]);

  const topCategoryEntry = useMemo(() => {
    return Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  }, [categoryTotals]);

  // Donut/Pie Chart Segments
  const donutSegments: DonutSegment[] = useMemo(() => {
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        label: cat,
        value: val,
        color: CATEGORY_COLORS[cat] || "#4bb473",
      }));
  }, [categoryTotals]);

  // Line Chart: 6-Month Inflow Timeline Trend
  const lineChartData: LinePoint[] = useMemo(() => {
    const months: { key: string; label: string; fullLabel: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      const fullLabel = d.toLocaleString("default", { month: "long", year: "numeric" });
      months.push({ key, label, fullLabel, value: 0 });
    }

    incomes.forEach((item) => {
      if (item.received_date) {
        const itemKey = item.received_date.substring(0, 7);
        const target = months.find((m) => m.key === itemKey);
        if (target) {
          target.value += item.amount;
        }
      }
    });

    return months;
  }, [incomes]);

  return (
    <main
      className="flex-1 h-full p-6 sm:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Top Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Income</h1>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              {displayedIncomes.length} Streams • {isAllTime ? "All Time" : monthDisplayTitle}
            </span>
          </div>
          <p className="text-xs opacity-70 mt-1">
            Track your salaries, investments, dividends, and recurring inflows.
          </p>
        </div>

        {/* Action Buttons & Month Stepper on Top Right */}
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
              title={!canGoPrev ? "No earlier income records" : "Previous Month"}
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
            {!isCurrentMonth && !isAllTime && (
              <button
                onClick={handleResetToCurrentMonth}
                className="ml-1 px-2 py-1 text-[10px] uppercase font-bold rounded-md border cursor-pointer opacity-70 hover:opacity-100"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                Today
              </button>
            )}
          </div>

          <button
            onClick={() => setIsAllTime(!isAllTime)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
              isAllTime ? "shadow-sm font-bold" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: isAllTime ? "var(--app-fg)" : "var(--app-card)",
              color: isAllTime ? "var(--app-bg)" : "var(--app-fg)",
              borderColor: isAllTime ? "var(--app-fg)" : "var(--app-border-subtle)",
            }}
          >
            All Time
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
            style={{
              backgroundColor: "var(--app-fg)",
              color: "var(--app-bg)",
              border: "1px solid var(--app-border)",
            }}
          >
            <Plus size={15} />
            Record Income
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          className="mb-6 p-4 rounded-xl text-xs border"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card)",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* ROW 1: SEPARATE KPI CARDS (LEFT TO RIGHT) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Card 1: Estimated Monthly Inflow */}
        <div
          className="rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-xs font-mono uppercase tracking-wider">
            <span>Estimated Monthly Inflow</span>
            <ArrowUpRight size={16} className="text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono tracking-tight mt-2 text-emerald-400">
            {loading ? "..." : formatINR(totalMonthlyIncome)}
          </div>
          <p className="text-[11px] opacity-50 mt-1 font-mono">
            Projected Annual Run-Rate: {loading ? "..." : formatINR(totalAnnualInflow)}
          </p>
        </div>

        {/* Card 2: Top Inflow Source */}
        <div
          className="rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-xs font-mono uppercase tracking-wider">
            <span>Top Inflow Source</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight mt-2 truncate">
            {topCategoryEntry ? topCategoryEntry[0] : "None"}
          </div>
          <p className="text-[11px] opacity-60 mt-1 font-mono text-emerald-400">
            {topCategoryEntry ? formatINR(topCategoryEntry[1]) : "₹0.00"} (
            {topCategoryEntry && totalRawIncome > 0
              ? `${((topCategoryEntry[1] / totalRawIncome) * 100).toFixed(1)}%`
              : "0%"}
            )
          </p>
        </div>

        {/* Card 3: Active Revenue Streams */}
        <div
          className="rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-xs font-mono uppercase tracking-wider">
            <span>Active Streams</span>
            <Wallet size={16} className="opacity-70" />
          </div>
          <div className="text-3xl font-extrabold font-mono tracking-tight mt-2">
            {loading ? "..." : `${incomes.length} Streams`}
          </div>
          <p className="text-[11px] opacity-50 mt-1 font-mono">
            Gross Cumulative Inflow: {formatINR(totalRawIncome)}
          </p>
        </div>
      </div>

      {/* ROW 2: VISUAL CHARTS (LINE CHART + PIE CHART SIDE BY SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
        {/* Left Card: 6-Month Inflow Line Chart */}
        <div
          className="lg:col-span-7 rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <InteractiveLineChart
            title="Inflow Trajectory"
            subtitle="6-Month Monthly Inflow Trend"
            data={lineChartData}
            color="#4bb473"
            gradientId="incomeTrendGradient"
            formatter={formatINR}
            type="income"
            emptyMessage="No income records found in the last 6 months."
          />
        </div>

        {/* Right Card: Stream Allocation Donut / Pie Chart */}
        <div
          className="lg:col-span-5 rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
            <div className="flex items-center gap-1.5">
              <PieChartIcon size={14} className="text-[#4bb473]" />
              <h3 className="text-sm font-bold tracking-tight">Inflow Allocation</h3>
            </div>
            <span className="text-[10px] font-mono opacity-50">
              {donutSegments.length} Streams
            </span>
          </div>

          <div className="pt-4 flex items-center justify-center">
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Loader2 size={24} className="animate-spin opacity-50" />
              </div>
            ) : (
              <InteractiveDonutChart
                totalLabel="Monthly Inflow"
                totalValue={totalMonthlyIncome}
                segments={donutSegments}
                formatter={formatINR}
                centerColor="#4bb473"
                emptyMessage="No income data available."
                emptySubMessage="Record your first income to view stream allocation."
                icon={<PieChartIcon size={24} className="opacity-50 text-[#4bb473]" />}
              />
            )}
          </div>
        </div>
      </div>

      {/* INCOME STREAMS HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Income Streams
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-mono font-bold border"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
              color: "#4bb473",
            }}
          >
            {displayedIncomes.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchIncome();
              fetchAccounts();
            }}
            className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity cursor-pointer font-mono"
            title="Refresh Income Data"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
            style={{
              backgroundColor: "var(--app-fg)",
              color: "var(--app-bg)",
              borderColor: "var(--app-border)",
            }}
          >
            <Plus size={13} />
            Add Stream
          </button>
        </div>
      </div>

      {/* FINANCIAL INCOME STREAMS TRANSACTION LIST (NO CARDS) */}
      {loading ? (
        <div
          className="flex items-center justify-center p-20 rounded-2xl border"
          style={{
            borderColor: "var(--app-border-subtle)",
            backgroundColor: "var(--app-card)",
          }}
        >
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : displayedIncomes.length === 0 ? (
        <div
          className="p-16 rounded-2xl border text-center space-y-3"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card)",
          }}
        >
          <TrendingUp size={36} className="mx-auto opacity-30 text-emerald-400" />
          <h3 className="text-base font-bold">No Income Streams Logged</h3>
          <p className="text-xs opacity-60 max-w-sm mx-auto">
            {isAllTime
              ? "Track your salary, freelance earnings, or passive dividends by recording your first income stream."
              : `No income logged for ${monthDisplayTitle}.`}
          </p>
          <button
            onClick={openAddModal}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border cursor-pointer"
            style={{
              backgroundColor: "var(--app-fg)",
              color: "var(--app-bg)",
              borderColor: "var(--app-border)",
            }}
          >
            <Plus size={14} />
            Add First Income
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden shadow-sm transition-colors"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          {/* Desktop Column Header */}
          <div
            className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-mono uppercase tracking-wider opacity-60 border-b select-none font-semibold"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-bg)",
            }}
          >
            <div className="col-span-4">Source / Entity</div>
            <div className="col-span-3">Category & Cadence</div>
            <div className="col-span-3">Receiving Account & Date</div>
            <div className="col-span-2 text-right">Inflow Amount</div>
          </div>

          {/* Transaction Rows */}
          <div className="divide-y" style={{ borderColor: "var(--app-border-subtle)" }}>
            {displayedIncomes.map((item) => {
              const catColor = CATEGORY_COLORS[item.category] || "#4bb473";
              const account = accounts.find((a) => a.id === item.account_id);

              return (
                <div
                  key={item.id}
                  className="transition-colors hover:bg-[var(--app-card-hover)] group"
                >
                  {/* Desktop Grid Row (md and up) */}
                  <div className="hidden md:grid grid-cols-12 items-center gap-4 py-3.5 px-5">
                    {/* Col 1: Logo + Title + Subtitle */}
                    <div className="col-span-4 flex items-center gap-3.5 min-w-0 pr-2">
                      <EntityLogo name={item.title} category={item.category} size={42} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => openEditModal(item)}
                            className="font-bold text-sm tracking-tight truncate hover:text-emerald-400 transition-colors cursor-pointer"
                            title={item.title}
                          >
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-50 truncate mt-0.5 font-sans">
                          {item.notes || (item.category ? `${item.category} Inflow` : "Direct Credit")}
                        </p>
                      </div>
                    </div>

                    {/* Col 2: Category Pill + Frequency Tag */}
                    <div className="col-span-3 flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
                        style={{
                          backgroundColor: `${catColor}15`,
                          borderColor: `${catColor}35`,
                          color: catColor,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                        {item.category}
                      </span>
                      {item.frequency && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border opacity-80"
                          style={{
                            borderColor: "var(--app-border-subtle)",
                            backgroundColor: "var(--app-bg)",
                          }}
                        >
                          <Repeat size={10} className="opacity-60" />
                          {item.frequency}
                        </span>
                      )}
                    </div>

                    {/* Col 3: Receiving Account + Formatted Date */}
                    <div className="col-span-3 flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {account ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px]"
                            style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)" }}
                          >
                            <BankLogo name={account.name} size={18} />
                            <span className="truncate max-w-[130px]">{account.name}</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] opacity-75"
                            style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)" }}
                          >
                            <Wallet size={12} className="opacity-60 text-emerald-400" />
                            <span>Cash in Hand</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono opacity-50">
                        <Calendar size={11} className="opacity-70" />
                        <span>{formatDisplayDate(item.received_date)}</span>
                      </div>
                    </div>

                    {/* Col 4: Amount + Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-3.5">
                      <div className="text-right">
                        <div className="text-base font-bold font-mono tracking-tight text-emerald-400">
                          +{formatINR(item.amount)}
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider opacity-40">
                          Credited
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit Stream"
                          className="w-7 h-7 rounded-md flex items-center justify-center border hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 transition-all opacity-70 hover:opacity-100 cursor-pointer"
                          style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteIncome(item.id, item.title)}
                          title="Delete Record"
                          className="w-7 h-7 rounded-md flex items-center justify-center border hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-all opacity-70 hover:opacity-100 cursor-pointer"
                          style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Row Layout (< md) */}
                  <div className="md:hidden p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <EntityLogo name={item.title} category={item.category} size={38} />
                        <div className="min-w-0">
                          <h4
                            onClick={() => openEditModal(item)}
                            className="font-bold text-sm tracking-tight truncate cursor-pointer"
                          >
                            {item.title}
                          </h4>
                          <p className="text-[10px] opacity-50 truncate mt-0.5">
                            {item.notes || (item.category ? `${item.category} Inflow` : "Direct Credit")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold font-mono text-emerald-400">
                          +{formatINR(item.amount)}
                        </div>
                        <span className="text-[9px] uppercase font-mono opacity-40">Credited</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: "var(--app-border-subtle)" }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={{
                            backgroundColor: `${catColor}15`,
                            borderColor: `${catColor}35`,
                            color: catColor,
                          }}
                        >
                          {item.category}
                        </span>
                        <span className="text-[10px] font-mono opacity-60 flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDisplayDate(item.received_date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1 rounded border opacity-70 hover:opacity-100"
                          style={{ borderColor: "var(--app-border-subtle)" }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteIncome(item.id, item.title)}
                          className="p-1 rounded border opacity-70 hover:opacity-100 text-rose-400"
                          style={{ borderColor: "var(--app-border-subtle)" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* POPUP MODAL: Add / Edit Income */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between pb-4 border-b"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg border flex items-center justify-center"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  <TrendingUp size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">
                    {editingIncome ? "Edit Income Stream" : "Record Income Stream"}
                  </h3>
                  <p className="text-xs opacity-60">
                    {editingIncome ? "Update existing earnings stream." : "Log a new earnings inflow channel."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:opacity-75 transition-opacity cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets (Only for New Income) */}
            {!editingIncome && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider opacity-60">
                  <Sparkles size={11} className="text-emerald-400" />
                  <span>Quick Presets</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border transition-all hover:scale-105 cursor-pointer opacity-80 hover:opacity-100"
                      style={{
                        borderColor: "var(--app-border-subtle)",
                        backgroundColor: "var(--app-bg)",
                      }}
                    >
                      {preset.label} (₹{preset.amount.toLocaleString("en-IN")})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitIncome} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Income Source / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary Tech Salary, Client Consulting, Dividend Yield"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors cursor-pointer"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  >
                    {INCOME_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors cursor-pointer"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {freq}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Amount (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-mono opacity-60">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full rounded-lg pl-8 pr-3.5 py-2.5 text-sm font-mono border focus:outline-none transition-colors"
                      style={{
                        backgroundColor: "var(--app-bg)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-fg)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Received Date
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm font-mono border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  />
                </div>
              </div>

              {/* Deposited Into Account */}
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Deposited Into Account (Optional)
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors cursor-pointer"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                >
                  <option value="">None / Unlinked (Direct Cash)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — {acc.type} ({formatINR(acc.balance)})
                    </option>
                  ))}
                </select>

                {!editingIncome && accountId && (
                  <label className="flex items-center gap-2 mt-2 text-xs opacity-80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={creditToAccount}
                      onChange={(e) => setCreditToAccount(e.target.checked)}
                      className="rounded accent-emerald-500 cursor-pointer"
                    />
                    <span>Automatically add to {accounts.find((a) => a.id === accountId)?.name} balance</span>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Notes or Memo (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Credited via NEFT / Payroll direct deposit"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                />
              </div>

              <div
                className="flex items-center justify-end gap-3 pt-4 border-t"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border transition-opacity cursor-pointer opacity-80 hover:opacity-100"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--app-fg)",
                    color: "var(--app-bg)",
                  }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  {editingIncome ? "Update Income" : "Save Income"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}