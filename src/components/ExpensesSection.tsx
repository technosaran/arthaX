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
  RefreshCw,
  Flame,
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

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  account_id?: string | null;
  expense_date: string;
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
    return getFromLocalCache<ExpenseItem[]>(redisExpensesKey) || [];
  }, [redisExpensesKey]);

  const initialAccounts = useMemo(() => {
    return getFromLocalCache<AccountItem[]>(redisAccountsKey) || [];
  }, [redisAccountsKey]);

  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts);
  const [loading, setLoading] = useState<boolean>(initialExpenses.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & Dining");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState<string>("");
  const [deductFromAccount, setDeductFromAccount] = useState(true);
  const [notes, setNotes] = useState("");

  // Active month in YYYY-MM format with strict boundary constraints
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => getCurrentMonthYear());
  const [isAllTime, setIsAllTime] = useState<boolean>(false);

  // Compute earliest month that actually has expense data
  const earliestMonthYear = useMemo(() => {
    return getEarliestDataMonth(
      expenses.map((e) => e.expense_date),
      currentMonthYear
    );
  }, [expenses, currentMonthYear]);

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

  // 2. Fetch Expenses
  const fetchExpenses = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    setErrorMsg(null);

    // Instant local cache check
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
        const mapped: ExpenseItem[] = data.map((item) => ({
          id: item.id,
          title: item.title,
          amount: Number(item.amount) || 0,
          category: item.category,
          account_id: item.account_id,
          expense_date: item.expense_date,
          notes: item.notes,
          created_at: item.created_at,
        }));

        setExpenses(mapped);

        // Update Multi-Tier Cache
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

    // Realtime Supabase broadcast subscription scoped to user
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
    setDeductFromAccount(false); // Default false on edit
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
        // Atomic Edit Flow: Updates expense and automatically reconciles balance differences
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
        // Atomic Create Flow: Uses row-level locking to deduct balance without race conditions
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
          showToast("Record Failed", error.message || "Please check inputs.", "error");
        } else {
          showToast("Expense Logged", `${title.trim()} (${formatINR(parsedAmount)}) recorded with atomic precision.`, "success");
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
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      showToast("Operation Failed", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, name: string) => {
    if (!user) return;
    const supabase = createClient();
    // Atomic Delete Flow: Deletes transaction and automatically refunds deducted balance
    const { error } = await supabase.rpc("fn_delete_expense_atomic", {
      p_expense_id: id,
      p_user_id: user.id,
    });

    if (error) {
      showToast("Delete Failed", error.message || "Could not remove expense record.", "error");
    } else {
      showToast("Expense Removed", `${name} deleted and balance restored to account.`, "info");
      await invalidateCacheKeys([
        redisExpensesKey,
        redisAccountsKey,
        redisLedgerKey,
      ]);
      await fetchExpenses(true);
      await fetchAccounts(true);
    }
  };

  // Filtered expenses based on active month
  const displayedExpenses = useMemo(() => {
    if (isAllTime) return expenses;
    return expenses.filter((e) => e.expense_date && e.expense_date.startsWith(selectedMonthYear));
  }, [expenses, isAllTime, selectedMonthYear]);

  // Telemetry & Aggregations
  const totalExpenses = useMemo(() => {
    return displayedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [displayedExpenses]);

  const categoryTotals = useMemo(() => {
    return displayedExpenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [displayedExpenses]);

  const topCategoryEntry = useMemo(() => {
    return Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  }, [categoryTotals]);

  const averageExpense = displayedExpenses.length > 0 ? totalExpenses / displayedExpenses.length : 0;
  const maxExpense = displayedExpenses.length > 0 ? Math.max(...displayedExpenses.map((i) => i.amount)) : 0;

  const dailyBurnRate = useMemo(() => {
    if (displayedExpenses.length === 0 || totalExpenses <= 0) return 0;
    if (isAllTime) {
      const dates = displayedExpenses
        .map((e) => (e.expense_date ? new Date(e.expense_date).getTime() : NaN))
        .filter((t) => !isNaN(t));
      if (dates.length <= 1) return totalExpenses;
      const days = Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)) + 1);
      return totalExpenses / days;
    }
    const [yearStr, monthStr] = selectedMonthYear.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();
    let elapsedDays = totalDaysInMonth;
    if (isCurrentMonth) {
      elapsedDays = Math.max(1, now.getDate());
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
      className="flex-1 h-full p-3.5 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Top Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              {displayedExpenses.length} Records • {isAllTime ? "All Time" : monthDisplayTitle}
            </span>
          </div>
          <p className="text-xs opacity-70 mt-1">
            Track your daily expenses, bills, and monthly spending.
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
              title={!canGoPrev ? "No earlier expense records" : "Previous Month"}
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
            Add Expense
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

      {/* ROW 1: 4 SEPARATE KPI CARDS (RESPONSIVE 4-COLUMN GRID) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
        {/* Card 1: Total Logged Outflow */}
        <div
          className="rounded-2xl p-5 sm:p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-xs font-mono uppercase tracking-wider">
            <span>Total Logged Outflow</span>
            <ArrowDownRight size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-2 text-rose-400">
            {loading ? "..." : formatINR(totalExpenses)}
          </div>
          <p className="text-[11px] opacity-50 mt-1 font-mono truncate">
            Aggregated across {displayedExpenses.length} recorded items
          </p>
        </div>

        {/* Card 2: Largest Outflow Category */}
        <div
          className="rounded-2xl p-5 sm:p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-xs font-mono uppercase tracking-wider">
            <span>Largest Outflow Category</span>
            <TrendingDown size={16} className="text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight mt-2 truncate">
            {topCategoryEntry ? topCategoryEntry[0] : "None"}
          </div>
          <p className="text-[11px] opacity-60 mt-1 font-mono text-amber-400 truncate">
            {topCategoryEntry ? formatINR(topCategoryEntry[1]) : "₹0.00"} (
            {topCategoryEntry && totalExpenses > 0
              ? `${((topCategoryEntry[1] / totalExpenses) * 100).toFixed(1)}%`
              : "0%"}
            )
          </p>
        </div>

        {/* Card 3: Expense Volume & Averages */}
        <div
          className="rounded-2xl p-5 sm:p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-xs font-mono uppercase tracking-wider">
            <span>Expense Volume</span>
            <CreditCard size={16} className="opacity-70" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-2">
            {loading ? "..." : `${displayedExpenses.length} Items`}
          </div>
          <p className="text-[11px] opacity-50 mt-1 font-mono truncate">
            Avg: {formatINR(averageExpense)} • Peak: {formatINR(maxExpense)}
          </p>
        </div>

        {/* Card 4 (NEW): Daily Burn Rate */}
        <div
          className="rounded-2xl p-5 sm:p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between opacity-60 text-xs font-mono uppercase tracking-wider">
            <span>Daily Burn Rate</span>
            <Flame size={16} className="text-orange-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-2 text-orange-400">
            {loading ? "..." : formatINR(dailyBurnRate)}
            <span className="text-xs font-normal opacity-60"> /day</span>
          </div>
          <p className="text-[11px] opacity-50 mt-1 font-mono truncate">
            {isAllTime ? "All-time average burn pace" : `Paced across active days in ${monthDisplayTitle}`}
          </p>
        </div>
      </div>

      {/* ROW 2: VISUAL CHARTS (LINE CHART + PIE CHART SIDE BY SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
        {/* Left Card: 6-Month Spending Line Chart */}
        <div
          className="lg:col-span-7 rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
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
          className="lg:col-span-5 rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
            <div className="flex items-center gap-1.5">
              <PieChartIcon size={14} className="text-rose-400" />
              <h3 className="text-sm font-bold tracking-tight">Category Breakdown</h3>
            </div>
            <span className="text-[10px] font-mono opacity-50">
              {donutSegments.length} Categories
            </span>
          </div>

          <div className="pt-4 flex items-center justify-center">
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Loader2 size={24} className="animate-spin opacity-50" />
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

      {/* EXPENSES LOG HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Expenses Log
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-mono font-bold border"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
              color: "#f43f5e",
            }}
          >
            {displayedExpenses.length}
          </span>
        </div>
      </div>

      {/* FINANCIAL EXPENSES TRANSACTION LIST (NO CARDS) */}
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
      ) : displayedExpenses.length === 0 ? (
        <div
          className="p-16 rounded-2xl border text-center space-y-3"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card)",
          }}
        >
          <CreditCard size={36} className="mx-auto opacity-30 text-rose-400" />
          <h3 className="text-base font-bold">No Expenses Logged</h3>
          <p className="text-xs opacity-60 max-w-sm mx-auto">
            {isAllTime
              ? "Start tracking your burn rate by recording your first expense."
              : `No expenses logged for ${monthDisplayTitle}.`}
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
            Add Expense
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
            <div className="col-span-4">Merchant / Payee</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-3">Payment Account & Date</div>
            <div className="col-span-2 text-right">Outflow Amount</div>
          </div>

          {/* Transaction Rows */}
          <div className="divide-y" style={{ borderColor: "var(--app-border-subtle)" }}>
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
                      <EntityLogo name={item.title} category={item.category} size={42} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => openEditModal(item)}
                            className="font-bold text-sm tracking-tight truncate hover:text-rose-400 transition-colors cursor-pointer"
                            title={item.title}
                          >
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-50 truncate mt-0.5 font-sans">
                          {item.notes || (item.category ? `${item.category} Outflow` : "Direct Debit")}
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
                            <Wallet size={12} className="opacity-60 text-rose-400" />
                            <span>Cash / Direct</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono opacity-50">
                        <Calendar size={11} className="opacity-70" />
                        <span>{formatDisplayDate(item.expense_date)}</span>
                      </div>
                    </div>

                    {/* Col 4: Amount + Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-3.5">
                      <div className="text-right">
                        <div className="text-base font-bold font-mono tracking-tight text-rose-400">
                          -{formatINR(item.amount)}
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider opacity-40">
                          Debited
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit Expense"
                          className="w-7 h-7 rounded-md flex items-center justify-center border hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 transition-all opacity-70 hover:opacity-100 cursor-pointer"
                          style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(item.id, item.title)}
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
                            {item.notes || (item.category ? `${item.category} Outflow` : "Direct Debit")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold font-mono text-rose-400">
                          -{formatINR(item.amount)}
                        </div>
                        <span className="text-[9px] uppercase font-mono opacity-40">Debited</span>
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
                          {formatDisplayDate(item.expense_date)}
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
                          onClick={() => handleDeleteExpense(item.id, item.title)}
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

      {/* POPUP MODAL: Add / Edit Expense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl border p-4 sm:p-5 shadow-2xl relative max-h-[95vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between pb-3 mb-3 border-b"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg border flex items-center justify-center"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  <TrendingDown size={15} className="text-rose-400" />
                </div>
                <h3 className="text-base font-bold tracking-tight">
                  {editingExpense ? "Edit Expense" : "Add Expense"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:opacity-75 transition-opacity cursor-pointer opacity-70 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-3">
              {/* Row 1: Title */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-wider opacity-70 mb-1">
                  Expense Title or Payee
                </label>
                <input
                  type="text"
                  placeholder="e.g. Groceries, Rent, Dinner"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg px-3 py-2 text-xs sm:text-sm border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                />
              </div>

              {/* Row 2: Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider opacity-70 mb-1">
                    Amount (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs sm:text-sm font-mono opacity-60">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full rounded-lg pl-7 pr-3 py-2 text-xs sm:text-sm font-mono border focus:outline-none transition-colors"
                      style={{
                        backgroundColor: "var(--app-bg)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-fg)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider opacity-70 mb-1">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs sm:text-sm font-mono border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Category & Paid From Account */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider opacity-70 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs sm:text-sm border focus:outline-none transition-colors cursor-pointer"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-mono tracking-wider opacity-70 mb-1">
                    Paid From (Optional)
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs sm:text-sm border focus:outline-none transition-colors cursor-pointer"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  >
                    <option value="">None / Cash</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatINR(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Notes / Memo */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-wider opacity-70 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via UPI / GPay"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs sm:text-sm border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                />
              </div>

              {/* Checkbox: auto deduct from account */}
              {!editingExpense && accountId && (
                <label className="flex items-center gap-2 pt-0.5 text-xs opacity-80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductFromAccount}
                    onChange={(e) => setDeductFromAccount(e.target.checked)}
                    className="rounded accent-rose-500 cursor-pointer"
                  />
                  <span>Deduct from {accounts.find((a) => a.id === accountId)?.name} balance</span>
                </label>
              )}

              {/* Actions */}
              <div
                className="flex items-center justify-end gap-2.5 pt-3 border-t"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-opacity cursor-pointer opacity-80 hover:opacity-100"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--app-fg)",
                    color: "var(--app-bg)",
                  }}
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  {editingExpense ? "Update" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}