"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  X,
  TrendingDown,
  Calendar,
  CreditCard,
  Wallet,
  ArrowDownRight,
  Pencil,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Search,
  Filter,
  AlertCircle,
  TrendingUp,
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
import { isFamilyTransfer } from "@/utils/expenseFilter";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";

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

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
}

const EXPENSE_CATEGORIES = [
  "Housing & Rent",
  "Groceries & Essentials",
  "Food & Dining",
  "Utilities & Bills",
  "Transport & Fuel",
  "Vehicle & Servicing",
  "Shopping & Lifestyle",
  "Electronics & Gadgets",
  "Health & Medical",
  "Fitness & Sports",
  "Entertainment & OTT",
  "Travel & Vacations",
  "Subscriptions & SaaS",
  "Debt & Loan EMI",
  "Insurance & Protection",
  "Education & Learning",
  "Personal Care & Grooming",
  "Beauty & Skincare",
  "Family & Child Care",
  "Gifts & Celebrations",
  "Investments & Wealth",
  "Taxes & Professional Fees",
  "Home & Maintenance",
  "Pet Care & Vet",
  "Emergency Reserve",
  "Charity & Community",
  "Books & Courses",
  "Hobbies & Creative",
  "Office & Coworking",
  "Alcohol & Nightlife",
  "Other & Contingency",
  // Legacy aliases
  "Travel",
  "Investments",
  "Personal & Education",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Housing & Rent": "#F43F5E",
  "Groceries & Essentials": "#10B981",
  "Food & Dining": "#F59E0B",
  "Utilities & Bills": "#3B82F6",
  "Transport & Fuel": "#8B5CF6",
  "Vehicle & Servicing": "#A78BFA",
  "Shopping & Lifestyle": "#EC4899",
  "Electronics & Gadgets": "#38BDF8",
  "Health & Medical": "#06B6D4",
  "Fitness & Sports": "#10B981",
  "Entertainment & OTT": "#A855F7",
  "Travel & Vacations": "#6366F1",
  "Subscriptions & SaaS": "#14B8A6",
  "Debt & Loan EMI": "#E11D48",
  "Insurance & Protection": "#0284C7",
  "Education & Learning": "#D97706",
  "Personal Care & Grooming": "#F472B6",
  "Beauty & Skincare": "#FB7185",
  "Family & Child Care": "#FB923C",
  "Gifts & Celebrations": "#FACC15",
  "Investments & Wealth": "#059669",
  "Taxes & Professional Fees": "#64748B",
  "Home & Maintenance": "#78716C",
  "Pet Care & Vet": "#E879F9",
  "Emergency Reserve": "#22C55E",
  "Charity & Community": "#F43F5E",
  "Books & Courses": "#F59E0B",
  "Hobbies & Creative": "#8B5CF6",
  "Office & Coworking": "#64748B",
  "Alcohol & Nightlife": "#F43F5E",
  "Other & Contingency": "#71717A",
  // Legacy
  Travel: "#6366F1",
  Investments: "#059669",
  "Personal & Education": "#D97706",
  Other: "#71717A",
};

export default function ExpensesSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const redisExpensesKey = getUserCacheKey(user?.id, CACHE_KEYS.EXPENSES);
  const redisAccountsKey = getUserCacheKey(user?.id, CACHE_KEYS.ACCOUNTS);
  const redisLedgerKey = getUserCacheKey(user?.id, CACHE_KEYS.LEDGER);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency)
  const initialExpenses = useMemo(() => {
    const raw = getFromLocalCache<ExpenseItem[]>(redisExpensesKey) || [];
    return raw.filter((item) => !isFamilyTransfer(item));
  }, [redisExpensesKey]);

  const initialAccounts = useMemo(() => {
    return getFromLocalCache<AccountItem[]>(redisAccountsKey) || [];
  }, [redisAccountsKey]);

  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts);
  const [loading, setLoading] = useState<boolean>(initialExpenses.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Month navigation & Filter states
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthYear);
  const [isAllTime, setIsAllTime] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & Dining");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState<string>("");
  const [deductFromAccount, setDeductFromAccount] = useState<boolean>(true);
  const [notes, setNotes] = useState("");

  // Earliest data month
  const earliestMonthYear = useMemo(() => {
    const dates = expenses.map((e) => e.expense_date).filter(Boolean);
    return getEarliestDataMonth(dates);
  }, [expenses]);

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

  // 2. Fetch Expenses
  const fetchExpenses = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    setErrorMsg(null);

    if (!skipCache) {
      const cached = getFromLocalCache<ExpenseItem[]>(redisExpensesKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setExpenses(cached);
        setLoading(false);
      }
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expense_date", { ascending: false });

      if (error) {
        setErrorMsg("Unable to retrieve expense records. Please try again.");
      } else if (data) {
        const mapped: ExpenseItem[] = data
          .map((item) => ({
            id: item.id,
            title: item.title,
            amount: Number(item.amount) || 0,
            category: item.category,
            account_id: item.account_id,
            expense_date: item.expense_date,
            notes: item.notes,
            tags: item.tags || [],
            created_at: item.created_at,
          }))
          .filter((item) => !isFamilyTransfer(item));

        setExpenses(mapped);
        saveToCache(redisExpensesKey, mapped, 3600);
      }
    } catch {
      setErrorMsg("Unable to load expenses.");
    } finally {
      setLoading(false);
    }
  }, [user, redisExpensesKey]);

  useEffect(() => {
    if (!user) return;
    fetchExpenses();
    fetchAccounts();

    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-expenses-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchExpenses(true);
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
  }, [user, fetchExpenses, fetchAccounts]);

  const openAddModal = () => {
    setEditingExpense(null);
    setTitle("");
    setAmount("");
    setCategory("Food & Dining");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setAccountId("");
    setDeductFromAccount(true);
    setNotes("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: ExpenseItem) => {
    setEditingExpense(item);
    setTitle(item.title);
    setAmount(item.amount.toString());
    setCategory(item.category);
    setExpenseDate(item.expense_date);
    setAccountId(item.account_id || "");
    setDeductFromAccount(false);
    setNotes(item.notes || "");
    setIsModalOpen(true);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
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
      if (editingExpense) {
        const { error } = await supabase.rpc("fn_update_expense_atomic", {
          p_expense_id: editingExpense.id,
          p_user_id: user.id,
          p_title: title.trim(),
          p_amount: parsedAmount,
          p_category: category,
          p_account_id: accountId || null,
          p_expense_date: expenseDate,
          p_notes: notes.trim() || null,
          p_tags: [],
        });

        if (error) {
          showToast("Update Failed", error.message || "Failed to update record.", "error");
        } else {
          showToast("Expense Updated", `${title.trim()} (${formatINR(parsedAmount)}) updated and balances reconciled.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisExpensesKey,
            redisAccountsKey,
            redisLedgerKey,
          ]);
          await fetchExpenses(true);
          await fetchAccounts(true);
        }
      } else {
        const targetAccountId = (accountId && deductFromAccount) ? accountId : null;
        const { error } = await supabase.rpc("fn_record_expense_atomic", {
          p_user_id: user.id,
          p_title: title.trim(),
          p_amount: parsedAmount,
          p_category: category,
          p_account_id: targetAccountId,
          p_expense_date: expenseDate,
          p_notes: notes.trim() || null,
          p_tags: [],
        });

        if (error) {
          showToast("Create Failed", error.message || "Failed to log expense.", "error");
        } else {
          showToast("Expense Logged", `${title.trim()} (${formatINR(parsedAmount)}) recorded.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisExpensesKey,
            redisAccountsKey,
            redisLedgerKey,
          ]);
          await fetchExpenses(true);
          await fetchAccounts(true);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record expense.";
      showToast("Operation Failed", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, itemTitle: string) => {
    if (!user) return;
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc("fn_delete_expense_atomic", {
        p_expense_id: id,
        p_user_id: user.id,
      });

      if (error) {
        showToast("Delete Failed", error.message || "Could not delete expense.", "error");
      } else {
        showToast("Expense Deleted", `${itemTitle} removed and account balance restored.`, "info");
        await invalidateCacheKeys([
          redisExpensesKey,
          redisAccountsKey,
          redisLedgerKey,
        ]);
        await fetchExpenses(true);
        await fetchAccounts(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove expense.";
      showToast("Delete Failed", msg, "error");
    }
  };

  // Filter displayed expenses by month and search/category filters
  const displayedExpenses = useMemo(() => {
    return expenses.filter((item) => {
      // 1. Month filter
      if (!isAllTime) {
        if (!item.expense_date || !item.expense_date.startsWith(selectedMonthYear)) {
          return false;
        }
      }

      // 2. Category filter
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      // 3. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesNote = item.notes?.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNote && !matchesCategory) return false;
      }

      return true;
    });
  }, [expenses, isAllTime, selectedMonthYear, categoryFilter, searchTerm]);

  // Aggregate Metrics for Displayed Month
  const totalExpenses = useMemo(() => {
    return displayedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [displayedExpenses]);

  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    displayedExpenses.forEach((item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
    });
    return acc;
  }, [displayedExpenses]);

  const topCategoryEntry = useMemo(() => {
    const entries = Object.entries(categoryTotals);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0];
  }, [categoryTotals]);

  const averageExpense = useMemo(() => {
    if (displayedExpenses.length === 0) return 0;
    return totalExpenses / displayedExpenses.length;
  }, [displayedExpenses, totalExpenses]);

  const maxExpense = useMemo(() => {
    if (displayedExpenses.length === 0) return 0;
    return Math.max(...displayedExpenses.map((e) => e.amount));
  }, [displayedExpenses]);

  const dailyBurnRate = useMemo(() => {
    if (displayedExpenses.length === 0) return 0;
    let elapsedDays = 30;
    if (isAllTime) {
      const uniqueDays = new Set(displayedExpenses.map((e) => e.expense_date)).size;
      elapsedDays = Math.max(1, uniqueDays);
    } else if (isCurrentMonth) {
      elapsedDays = Math.max(1, new Date().getDate());
    } else {
      const parts = selectedMonthYear.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      elapsedDays = new Date(y, m, 0).getDate();
    }
    return totalExpenses / elapsedDays;
  }, [displayedExpenses, totalExpenses, isAllTime, selectedMonthYear, isCurrentMonth]);

  // Donut/Pie Chart Segments
  const donutSegments: DonutSegment[] = useMemo(() => {
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        label: cat,
        value: val,
        color: CATEGORY_COLORS[cat] || "#71717A",
      }));
  }, [categoryTotals]);

  // Line Chart: 6-Month Timeline Trend
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

    expenses.forEach((item) => {
      if (item.expense_date) {
        const itemKey = item.expense_date.substring(0, 7);
        const target = months.find((m) => m.key === itemKey);
        if (target) {
          target.value += item.amount;
        }
      }
    });

    return months;
  }, [expenses]);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Universal Page Header */}
      <PageHeader
        title="Expenses & Outflows"
        description="Daily expenditures, category burn rates, and historical spending trajectory."
        badge={
          <Badge variant="danger">
            {displayedExpenses.length} Records • {isAllTime ? "All Time" : monthDisplayTitle}
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
                title={!canGoPrev ? "No earlier expense records" : "Previous Month"}
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
              variant="danger"
              icon={<Plus size={15} />}
              onClick={openAddModal}
            >
              Add Expense
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

      {/* ROW 1: 4 SEPARATE KPI METRIC CARDS */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          {/* Card 1: Total Logged Outflow */}
          <StatCard
            title="Total Logged Outflow"
            value={<span className="text-rose-400">{formatINR(totalExpenses)}</span>}
            icon={<ArrowDownRight size={16} />}
            iconColor="rose"
            subtitle={`Aggregated across ${displayedExpenses.length} entries`}
          />

          {/* Card 2: Largest Outflow Category */}
          <StatCard
            title="Largest Category"
            value={
              <span className="truncate block text-lg sm:text-2xl font-bold">
                {topCategoryEntry ? topCategoryEntry[0] : "None"}
              </span>
            }
            icon={<TrendingDown size={16} />}
            iconColor="amber"
            subtitle={
              topCategoryEntry
                ? `${formatINR(topCategoryEntry[1])} • ${
                    totalExpenses > 0
                      ? ((topCategoryEntry[1] / totalExpenses) * 100).toFixed(1)
                      : 0
                  }% of total`
                : "No categorized spend"
            }
          />

          {/* Card 3: Expense Volume & Averages */}
          <StatCard
            title="Expense Volume"
            value={`${displayedExpenses.length} Items`}
            icon={<CreditCard size={16} />}
            iconColor="neutral"
            subtitle={`Avg: ${formatINR(averageExpense)} • Peak: ${formatINR(maxExpense)}`}
          />

          {/* Card 4: Daily Burn Rate */}
          <StatCard
            title="Daily Burn Rate"
            value={<span className="text-amber-400">{formatINR(dailyBurnRate)}/day</span>}
            icon={<Flame size={16} />}
            iconColor="amber"
            subtitle={
              isAllTime
                ? "All-time average burn pace"
                : `Paced across active days in ${monthDisplayTitle}`
            }
          />
        </div>
      )}

      {/* ROW 2: VISUAL CHARTS (LINE CHART + PIE CHART SIDE BY SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
        {/* Left Card: 6-Month Spending Line Chart */}
        <div
          className="lg:col-span-7 rounded-2xl p-6 border border-[var(--app-border)] bg-[var(--app-card)] shadow-xs flex flex-col justify-between"
        >
          <InteractiveLineChart
            title="Spending Trajectory"
            subtitle="6-Month Monthly Outflow Trend"
            data={lineChartData}
            color="#f43f5e"
            gradientId="expenseTrendGradient"
            formatter={formatINR}
            type="expense"
            emptyMessage="No expense records found in the last 6 months."
          />
        </div>

        {/* Right Card: Category Allocation Donut / Pie Chart */}
        <div
          className="lg:col-span-5 rounded-2xl p-6 border border-[var(--app-border)] bg-[var(--app-card)] shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border-subtle)]">
            <div className="flex items-center gap-1.5">
              <PieChartIcon size={14} className="text-rose-400" />
              <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">Category Breakdown</h3>
            </div>
            <span className="text-[10px] font-mono text-[var(--app-muted)]">
              {donutSegments.length} Categories
            </span>
          </div>

          <div className="pt-4 flex items-center justify-center">
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Skeleton className="w-36 h-36 rounded-full" />
              </div>
            ) : (
              <InteractiveDonutChart
                totalLabel="Total Burn"
                totalValue={totalExpenses}
                segments={donutSegments}
                formatter={formatINR}
                centerColor="#f43f5e"
                emptyMessage="No expense data available."
                emptySubMessage="Log your first expense to view category allocation."
                icon={<PieChartIcon size={24} className="opacity-50 text-rose-400" />}
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
              placeholder="Search expenses by title or notes..."
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
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FINANCIAL EXPENSES TRANSACTION LIST */}
      {loading ? (
        <CardSkeleton rows={8} />
      ) : displayedExpenses.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={32} className="text-rose-400" />}
          title="No Expenses Logged"
          description={
            isAllTime
              ? "Start tracking your burn rate by recording your first expense."
              : `No expenses logged for ${monthDisplayTitle}.`
          }
          action={
            <Button
              variant="danger"
              size="sm"
              icon={<Plus size={14} />}
              onClick={openAddModal}
            >
              Add Expense
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
            <div className="col-span-4">Merchant / Payee</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-3">Payment Account & Date</div>
            <div className="col-span-2 text-right">Outflow Amount</div>
          </div>

          {/* Transaction Rows */}
          <div className="divide-y divide-[var(--app-border-subtle)]">
            {displayedExpenses.map((item) => {
              const catColor = CATEGORY_COLORS[item.category] || "#71717A";
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
                          className="font-bold text-sm tracking-tight truncate hover:text-rose-400 transition-colors cursor-pointer block text-[var(--app-fg)]"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                        <p className="text-[11px] text-[var(--app-muted)] truncate mt-0.5">
                          {item.notes || `${item.category} Outflow`}
                        </p>
                      </div>
                    </div>

                    {/* Col 2: Category Pill */}
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
                    </div>

                    {/* Col 3: Payment Account + Formatted Date */}
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
                            <Wallet size={12} className="text-rose-400" />
                            <span>Cash / Direct</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--app-muted)]">
                        <Calendar size={11} className="opacity-70" />
                        <span>{formatDisplayDate(item.expense_date)}</span>
                      </div>
                    </div>

                    {/* Col 4: Amount + Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-3.5">
                      <div className="text-right">
                        <div className="text-base font-bold font-mono tracking-tight text-rose-400 tabular-nums">
                          -{formatINR(item.amount)}
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] opacity-60">
                          Debited
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit Expense"
                          className="w-7 h-7 rounded-lg flex items-center justify-center border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 transition-all cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(item.id, item.title)}
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
                            {item.notes || `${item.category} Outflow`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold font-mono text-rose-400 tabular-nums">
                          -{formatINR(item.amount)}
                        </div>
                        <span className="text-[9px] uppercase font-mono text-[var(--app-muted)]">Debited</span>
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
                          {formatDisplayDate(item.expense_date)}
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
                          onClick={() => handleDeleteExpense(item.id, item.title)}
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

      {/* POPUP MODAL: Add / Edit Expense */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? "Edit Expense Entry" : "Record New Expense"}
        description="Enter expense details. If linked to an account, balance will automatically be debited."
        size="lg"
      >
        <form onSubmit={handleSubmitExpense} className="space-y-4">
          <Input
            label="Expense Title or Merchant"
            placeholder="e.g. Swiggy, DMart, Rent, Electricity Bill"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            leftIcon={<CreditCard size={15} />}
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
              label="Expense Date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={EXPENSE_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            />

            <Select
              label="Paid From (Account / Card)"
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
          </div>

          <Input
            label="Notes / Memo (Optional)"
            placeholder="e.g. Paid via UPI QR / Split with colleagues"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {!editingExpense && accountId && (
            <label className="flex items-center gap-2 pt-1 text-xs text-[var(--app-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={deductFromAccount}
                onChange={(e) => setDeductFromAccount(e.target.checked)}
                className="rounded accent-emerald-500 cursor-pointer"
              />
              <span>Deduct from {accounts.find((a) => a.id === accountId)?.name} balance</span>
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
              variant="danger"
              size="sm"
              loading={submitting}
            >
              {editingExpense ? "Update Expense" : "Save Expense"}
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
