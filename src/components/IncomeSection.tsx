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
  Search,
  AlertCircle,
  Landmark,
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
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";

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
  Salary: "#10B981", // Modern Vibrant Emerald
  Freelance: "#8B5CF6", // Violet
  Business: "#F59E0B", // Amber
  Dividends: "#06B6D4", // Cyan
  Interest: "#3B82F6", // Royal Blue
  Rental: "#F43F5E", // Modern Coral / Rose
  "Capital Gains": "#EC4899", // Pink
  Bonus: "#14B8A6", // Teal
  "Crypto & Web3": "#F97316", // Orange
  Other: "#71717A", // Slate
};

const FREQUENCIES = ["Monthly", "One-time", "Weekly", "Yearly", "Quarterly"];

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

  // Month navigation states
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthYear);
  const [isAllTime, setIsAllTime] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeItem | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Salary");
  const [frequency, setFrequency] = useState("Monthly");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState<string>("");
  const [creditToAccount, setCreditToAccount] = useState<boolean>(true);
  const [notes, setNotes] = useState("");

  // Earliest data month
  const earliestMonthYear = useMemo(() => {
    const dates = incomes.map((i) => i.received_date).filter(Boolean);
    return getEarliestDataMonth(dates);
  }, [incomes]);

  const canGoPrev = useMemo(() => {
    if (isAllTime) return false;
    return selectedMonthYear > earliestMonthYear;
  }, [selectedMonthYear, earliestMonthYear, isAllTime]);

  const canGoNext = useMemo(() => {
    if (isAllTime) return false;
    return selectedMonthYear < currentMonthYear;
  }, [selectedMonthYear, currentMonthYear, isAllTime]);

  const isCurrentMonth = selectedMonthYear === currentMonthYear;

  const monthDisplayTitle = useMemo(() => {
    if (isAllTime) return "All Time Cumulative";
    return formatMonthDisplay(selectedMonthYear);
  }, [selectedMonthYear, isAllTime]);

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
      const cached = getFromLocalCache<AccountItem[]>(redisAccountsKey);
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
    setCreditToAccount(false);
    setNotes(item.notes || "");
    setIsModalOpen(true);
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
        const { error } = await supabase.from("income").update({
          title: title.trim(),
          amount: parsedAmount,
          category,
          frequency,
          account_id: accountId || null,
          received_date: receivedDate,
          notes: notes.trim() || null,
        }).eq("id", editingIncome.id).eq("user_id", user.id);

        if (error) {
          showToast("Update Failed", error.message || "Failed to update record.", "error");
        } else {
          showToast("Income Updated", `${title.trim()} (${formatINR(parsedAmount)}) updated.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisIncomeKey,
            redisAccountsKey,
            redisLedgerKey,
          ]);
          await fetchIncome(true);
          await fetchAccounts(true);
        }
      } else {
        const targetAccountId = (accountId && creditToAccount) ? accountId : null;
        const { error } = await supabase.rpc("fn_record_income_atomic", {
          p_user_id: user.id,
          p_title: title.trim(),
          p_amount: parsedAmount,
          p_category: category,
          p_frequency: frequency,
          p_account_id: targetAccountId,
          p_received_date: receivedDate,
          p_notes: notes.trim() || null,
          p_tags: [],
        });

        if (error) {
          showToast("Record Failed", error.message || "Please check inputs.", "error");
        } else {
          showToast("Income Recorded", `${title.trim()} (${formatINR(parsedAmount)}) added.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisIncomeKey,
            redisAccountsKey,
            redisLedgerKey,
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
    const { error } = await supabase.rpc("fn_delete_income_atomic", {
      p_income_id: id,
      p_user_id: user.id,
    });

    if (error) {
      showToast("Delete Failed", error.message || "Could not remove income record.", "error");
    } else {
      showToast("Income Removed", `${name} deleted and balance reversed.`, "info");
      await invalidateCacheKeys([
        redisIncomeKey,
        redisAccountsKey,
        redisLedgerKey,
      ]);
      await fetchIncome(true);
      await fetchAccounts(true);
    }
  };

  // Filtered income based on active month
  const displayedIncomes = useMemo(() => {
    return incomes.filter((i) => {
      if (!isAllTime) {
        if (!i.received_date || !i.received_date.startsWith(selectedMonthYear)) {
          return false;
        }
      }

      if (categoryFilter !== "all" && i.category !== categoryFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = i.title.toLowerCase().includes(q);
        const matchesNotes = i.notes?.toLowerCase().includes(q);
        const matchesCat = i.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesCat) return false;
      }

      return true;
    });
  }, [incomes, isAllTime, selectedMonthYear, categoryFilter, searchTerm]);

  // Telemetry Calculations
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

  const averageIncome = useMemo(() => {
    if (displayedIncomes.length === 0) return 0;
    return totalRawIncome / displayedIncomes.length;
  }, [displayedIncomes, totalRawIncome]);

  const maxIncome = useMemo(() => {
    if (displayedIncomes.length === 0) return 0;
    return Math.max(...displayedIncomes.map((i) => i.amount));
  }, [displayedIncomes]);

  // Donut/Pie Chart Segments
  const donutSegments: DonutSegment[] = useMemo(() => {
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        label: cat,
        value: val,
        color: CATEGORY_COLORS[cat] || "#10B981",
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
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Universal Page Header */}
      <PageHeader
        title="Income & Inflows"
        description="Salaries, freelance payouts, dividends, business revenue, and recurring streams."
        badge={
          <Badge variant="success">
            {displayedIncomes.length} Inflows • {isAllTime ? "All Time" : monthDisplayTitle}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Stepper */}
            <div
              className="flex items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-0.5 text-xs font-mono shadow-xs"
            >
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={!canGoPrev}
                title={!canGoPrev ? "No earlier income records" : "Previous Month"}
                className={`p-1.5 rounded-lg transition-all ${
                  !canGoPrev
                    ? "opacity-25 cursor-not-allowed"
                    : "opacity-70 hover:opacity-100 hover:bg-[var(--app-card-hover)] cursor-pointer"
                }`}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 font-semibold min-w-[110px] text-center text-[var(--app-fg)]">
                {monthDisplayTitle}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={!canGoNext}
                title={!canGoNext ? "Future months are not yet available" : "Next Month"}
                className={`p-1.5 rounded-lg transition-all ${
                  !canGoNext
                    ? "opacity-25 cursor-not-allowed"
                    : "opacity-70 hover:opacity-100 hover:bg-[var(--app-card-hover)] cursor-pointer"
                }`}
              >
                <ChevronRight size={14} />
              </button>
              {!isCurrentMonth && !isAllTime && (
                <button
                  type="button"
                  onClick={handleResetToCurrentMonth}
                  className="ml-1 px-2 py-0.5 text-[10px] uppercase font-bold rounded-md border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] text-[var(--app-accent)] hover:bg-[var(--app-card-hover)] cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            <Button
              size="sm"
              variant={isAllTime ? "primary" : "secondary"}
              onClick={() => setIsAllTime(!isAllTime)}
            >
              All Time
            </Button>

            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={15} />}
              onClick={openAddModal}
            >
              Add Income
            </Button>
          </div>
        }
      />

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl text-xs border border-rose-500/30 bg-rose-500/10 text-rose-400 flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ROW 1: 4 KPI METRIC CARDS */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          {/* Card 1: Total Logged Inflow */}
          <StatCard
            title="Total Inflow Logged"
            value={<span className="text-emerald-400">{formatINR(totalRawIncome)}</span>}
            icon={<ArrowUpRight size={16} />}
            iconColor="emerald"
            subtitle={`Aggregated across ${displayedIncomes.length} inflow streams`}
          />

          {/* Card 2: Primary Income Stream */}
          <StatCard
            title="Primary Stream"
            value={
              <span className="truncate block text-lg sm:text-2xl font-bold">
                {topCategoryEntry ? topCategoryEntry[0] : "None"}
              </span>
            }
            icon={<TrendingUp size={16} />}
            iconColor="sky"
            subtitle={
              topCategoryEntry
                ? `${formatINR(topCategoryEntry[1])} • ${
                    totalRawIncome > 0
                      ? ((topCategoryEntry[1] / totalRawIncome) * 100).toFixed(1)
                      : 0
                  }% of total`
                : "No categorized income"
            }
          />

          {/* Card 3: Income Streams Volume & Averages */}
          <StatCard
            title="Inflow Frequency"
            value={`${displayedIncomes.length} Deposits`}
            icon={<Wallet size={16} />}
            iconColor="neutral"
            subtitle={`Avg: ${formatINR(averageIncome)} • Peak: ${formatINR(maxIncome)}`}
          />

          {/* Card 4: Run-Rate */}
          <StatCard
            title="Annualized Inflow Pace"
            value={formatINR(totalRawIncome * (isAllTime ? 1 : 12))}
            icon={<Sparkles size={16} />}
            iconColor="emerald"
            subtitle={
              isAllTime
                ? "Cumulative gross receipts recorded"
                : `Annualized based on ${monthDisplayTitle}`
            }
          />
        </div>
      )}

      {/* ROW 2: VISUAL CHARTS (LINE CHART + PIE CHART SIDE BY SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
        {/* Left Card: 6-Month Inflow Line Chart */}
        <div
          className="lg:col-span-7 rounded-2xl p-6 border border-[var(--app-border)] bg-[var(--app-card)] shadow-xs flex flex-col justify-between"
        >
          <InteractiveLineChart
            title="Inflow Trajectory"
            subtitle="6-Month Inflow Trajectory Trend"
            data={lineChartData}
            color="#10b981"
            gradientId="incomeTrendGradient"
            formatter={formatINR}
            type="income"
            emptyMessage="No income records found in the last 6 months."
          />
        </div>

        {/* Right Card: Inflow Source Allocation Donut Chart */}
        <div
          className="lg:col-span-5 rounded-2xl p-6 border border-[var(--app-border)] bg-[var(--app-card)] shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border-subtle)]">
            <div className="flex items-center gap-1.5">
              <PieChartIcon size={14} className="text-emerald-400" />
              <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">Source Allocation</h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--app-muted)]">
              {donutSegments.length} Sources
            </span>
          </div>

          <div className="pt-4 flex items-center justify-center">
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Skeleton className="w-36 h-36 rounded-full" />
              </div>
            ) : (
              <InteractiveDonutChart
                totalLabel="Total Inflows"
                totalValue={totalRawIncome}
                segments={donutSegments}
                formatter={formatINR}
                centerColor="#10b981"
                emptyMessage="No income data available."
                emptySubMessage="Log your first income source to view stream allocation."
                icon={<PieChartIcon size={24} className="opacity-50 text-emerald-400" />}
              />
            )}
          </div>
        </div>
      </div>

      {/* SEARCH & CATEGORY FILTER TOOLBAR */}
      <div
        className="p-3 sm:p-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs"
      >
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--app-muted)]" />
            <input
              type="text"
              placeholder="Search income by title or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-[var(--app-muted)] hover:text-[var(--app-fg)] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] focus:outline-none cursor-pointer font-medium w-full sm:w-auto"
          >
            <option value="all">All Sources</option>
            {INCOME_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* INCOME TRANSACTION LIST */}
      {loading ? (
        <CardSkeleton rows={8} />
      ) : displayedIncomes.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={32} className="text-emerald-400" />}
          title="No Income Records Logged"
          description={
            isAllTime
              ? "Start tracking your inflows by recording your salary or deposit."
              : `No deposits or revenue recorded for ${monthDisplayTitle}.`
          }
          action={
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={openAddModal}
            >
              Add Income
            </Button>
          }
        />
      ) : (
        <div
          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] overflow-hidden shadow-xs transition-colors"
        >
          {/* Desktop Column Header */}
          <div
            className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] select-none font-semibold"
          >
            <div className="col-span-4">Source / Payer</div>
            <div className="col-span-3">Category & Cadence</div>
            <div className="col-span-3">Destination Account & Date</div>
            <div className="col-span-2 text-right">Inflow Amount</div>
          </div>

          {/* Transaction Rows */}
          <div className="divide-y divide-[var(--app-border-subtle)]">
            {displayedIncomes.map((item) => {
              const catColor = CATEGORY_COLORS[item.category] || "#10B981";
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
                      <EntityLogo name={item.title} category={item.category} size={40} />
                      <div className="min-w-0">
                        <span
                          onClick={() => openEditModal(item)}
                          className="font-bold text-sm tracking-tight truncate hover:text-emerald-400 transition-colors cursor-pointer block text-[var(--app-fg)]"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                        <p className="text-[11px] text-[var(--app-muted)] truncate mt-0.5">
                          {item.notes || `${item.category} Inflow`}
                        </p>
                      </div>
                    </div>

                    {/* Col 2: Category Pill & Frequency */}
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
                      <span className="text-[10px] font-mono text-[var(--app-muted)] px-2 py-0.5 rounded-md border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                        {item.frequency || "Monthly"}
                      </span>
                    </div>

                    {/* Col 3: Destination Account + Formatted Date */}
                    <div className="col-span-3 flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {account ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]"
                          >
                            <BankLogo name={account.name} size={16} />
                            <span className="truncate max-w-[130px]">{account.name}</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] text-[var(--app-muted)] border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]"
                          >
                            <Wallet size={12} className="text-emerald-400" />
                            <span>Cash / Direct</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--app-muted)]">
                        <Calendar size={11} className="opacity-70" />
                        <span>{formatDisplayDate(item.received_date)}</span>
                      </div>
                    </div>

                    {/* Col 4: Amount + Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-3.5">
                      <div className="text-right">
                        <div className="text-base font-bold font-mono tracking-tight text-emerald-400 tabular-nums">
                          +{formatINR(item.amount)}
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] opacity-60">
                          Credited
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit Income"
                          className="w-7 h-7 rounded-lg flex items-center justify-center border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 transition-all cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIncome(item.id, item.title)}
                          title="Delete Record"
                          className="w-7 h-7 rounded-lg flex items-center justify-center border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer"
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
                            className="font-bold text-sm tracking-tight truncate cursor-pointer text-[var(--app-fg)]"
                          >
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-[var(--app-muted)] truncate mt-0.5">
                            {item.notes || `${item.category} Inflow`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
                          +{formatINR(item.amount)}
                        </div>
                        <span className="text-[9px] uppercase font-mono text-[var(--app-muted)]">Credited</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--app-border-subtle)] text-xs">
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
                        <span className="text-[10px] font-mono text-[var(--app-muted)] flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDisplayDate(item.received_date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIncome(item.id, item.title)}
                          className="p-1 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] text-rose-400"
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
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIncome ? "Edit Inflow Record" : "Record New Income"}
        description="Record incoming deposits, dividends, or salary. Optionally credit directly to an account."
        size="lg"
      >
        <form onSubmit={handleSubmitIncome} className="space-y-4">
          <Input
            label="Income Title or Source"
            placeholder="e.g. Monthly Salary, Freelance Milestone, Google Ads"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            leftIcon={<TrendingUp size={15} />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Amount (₹ INR)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              leftIcon={<span className="font-mono text-xs font-bold">₹</span>}
            />

            <Input
              label="Received Date"
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Source Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={INCOME_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            />

            <Select
              label="Frequency Cadence"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              options={FREQUENCIES.map((freq) => ({ value: freq, label: freq }))}
            />
          </div>

          <Select
            label="Deposit Into (Account / Wallet)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">None / Physical Cash</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({formatINR(acc.balance)})
              </option>
            ))}
          </Select>

          <Input
            label="Notes / Description (Optional)"
            placeholder="e.g. Q3 Performance Bonus / Client invoice #104"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {!editingIncome && accountId && (
            <label className="flex items-center gap-2 pt-1 text-xs text-[var(--app-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={creditToAccount}
                onChange={(e) => setCreditToAccount(e.target.checked)}
                className="rounded accent-emerald-500 cursor-pointer"
              />
              <span>Deposit into {accounts.find((a) => a.id === accountId)?.name} balance</span>
            </label>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
            >
              {editingIncome ? "Update Inflow" : "Record Income"}
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
