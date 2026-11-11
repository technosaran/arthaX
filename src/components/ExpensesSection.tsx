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
  Sparkles,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import BankLogo from "@/components/BankLogo";
import EntityLogo from "@/components/EntityLogo";
import { fetchFromCache, saveToCache, invalidateCacheKeys } from "@/utils/cacheClient";
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
  "Charity & Community": "#EF4444",
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

const QUICK_PRESETS = [
  { label: "Groceries", title: "Monthly Groceries & Supermarket", amount: 3500, category: "Groceries & Essentials" },
  { label: "Dining / Swiggy", title: "Dining & Food Delivery", amount: 650, category: "Food & Dining" },
  { label: "Rent & Maintenance", title: "House Rent & Maintenance", amount: 18000, category: "Housing & Rent" },
  { label: "Electricity / Wifi", title: "Electricity & Fiber Internet", amount: 1800, category: "Utilities & Bills" },
  { label: "Fuel / Commute", title: "Fuel & Transit", amount: 2000, category: "Transport & Fuel" },
  { label: "OTT Subscription", title: "OTT Streaming Subscriptions", amount: 649, category: "Entertainment & OTT" },
  { label: "EMI / Loan", title: "Monthly Loan / Card EMI", amount: 12500, category: "Debt & Loan EMI" },
  { label: "Health / Pharma", title: "Medicines & Doctor Consultation", amount: 1200, category: "Health & Medical" },
];

export default function ExpensesSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  const redisExpensesKey = getUserCacheKey(user?.id, CACHE_KEYS.EXPENSES);
  const redisAccountsKey = getUserCacheKey(user?.id, CACHE_KEYS.ACCOUNTS);
  const redisLedgerKey = getUserCacheKey(user?.id, CACHE_KEYS.LEDGER);

  // 1. Fetch Accounts for linking
  const fetchAccounts = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    if (!skipCache) {
      const cached = await fetchFromCache<any[]>(redisAccountsKey);
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
        setAccounts(
          data.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            balance: Number(a.balance) || 0,
            last_four: a.last_four,
          }))
        );
      }
    } catch {
      // Non-blocking
    }
  }, [user, redisAccountsKey]);

  // 2. Fetch Expenses
  const fetchExpenses = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    setErrorMsg(null);

    // Try Redis cache first (if not bypassing)
    if (!skipCache) {
      const cached = await fetchFromCache<ExpenseItem[]>(redisExpensesKey);
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

        // Update Redis Cache
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

  const applyPreset = (preset: (typeof QUICK_PRESETS)[0]) => {
    setTitle(preset.title);
    setAmount(preset.amount.toString());
    setCategory(preset.category);
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
        // Edit flow
        const { error } = await supabase
          .from("expenses")
          .update({
            title: title.trim(),
            amount: parsedAmount,
            category,
            account_id: accountId || null,
            expense_date: expenseDate,
            notes: notes.trim() || null,
          })
          .eq("id", editingExpense.id)
          .eq("user_id", user.id);

        if (error) {
          showToast("Update Failed", error.message || "Failed to update record.", "error");
        } else {
          showToast("Expense Updated", `${title.trim()} (${formatINR(parsedAmount)}) updated.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisExpensesKey,
            redisAccountsKey,
            redisLedgerKey,
            "arthax:cache:expenses",
            "arthax:cache:accounts",
            "arthax:cache:ledger",
          ]);
          await fetchExpenses(true);
          await fetchAccounts(true);
        }
      } else {
        // Create flow
        const { error } = await supabase.from("expenses").insert([
          {
            user_id: user.id,
            title: title.trim(),
            amount: parsedAmount,
            category,
            account_id: accountId || null,
            expense_date: expenseDate,
            notes: notes.trim() || null,
          },
        ]);

        if (error) {
          showToast("Record Failed", error.message || "Please check inputs.", "error");
        } else {
          // If user selected an account & checked deduct balance
          if (accountId && deductFromAccount) {
            const targetAcc = accounts.find((a) => a.id === accountId);
            if (targetAcc) {
              const updatedBal = Math.max(0, targetAcc.balance - parsedAmount);
              await supabase
                .from("accounts")
                .update({ balance: updatedBal })
                .eq("id", accountId)
                .eq("user_id", user.id);
            }
          }

          showToast("Expense Logged", `${title.trim()} (${formatINR(parsedAmount)}) recorded.`, "success");
          setIsModalOpen(false);
          await invalidateCacheKeys([
            redisExpensesKey,
            redisAccountsKey,
            redisLedgerKey,
            "arthax:cache:expenses",
            "arthax:cache:accounts",
            "arthax:cache:ledger",
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
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      showToast("Delete Failed", "Could not remove expense record.", "error");
    } else {
      showToast("Expense Removed", `${name} has been deleted.`, "info");
      await invalidateCacheKeys([
        redisExpensesKey,
        redisAccountsKey,
        redisLedgerKey,
        "arthax:cache:expenses",
        "arthax:cache:accounts",
        "arthax:cache:ledger",
      ]);
      await fetchExpenses(true);
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

  // Donut/Pie Chart Segments
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  const chartSegments = useMemo(() => {
    if (totalExpenses === 0) return [];
    let offset = 0;
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => {
        const percentage = (val / totalExpenses) * 100;
        const currentOffset = offset;
        offset += (percentage / 100) * circumference;
        return {
          category: cat,
          amount: val,
          percentage,
          color: CATEGORY_COLORS[cat] || "#71717A",
          strokeDasharray: `${(percentage / 100) * circumference} ${circumference}`,
          strokeDashoffset: -currentOffset,
        };
      });
  }, [categoryTotals, totalExpenses, circumference]);

  // Line Chart: 6-Month Timeline Trend
  const monthlyTrend = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      months.push({ key, label, total: 0 });
    }

    expenses.forEach((item) => {
      if (item.expense_date) {
        const itemKey = item.expense_date.substring(0, 7);
        const target = months.find((m) => m.key === itemKey);
        if (target) {
          target.total += item.amount;
        }
      }
    });

    return months;
  }, [expenses]);

  const maxTrendExpense = useMemo(() => {
    return Math.max(...monthlyTrend.map((m) => m.total), 1) * 1.15;
  }, [monthlyTrend]);

  const linePoints = useMemo(() => {
    const plotWidth = 430;
    const plotHeight = 90;
    const paddingLeft = 35;
    const paddingTop = 20;
    const count = monthlyTrend.length;

    return monthlyTrend.map((m, idx) => {
      const x = paddingLeft + (count > 1 ? (idx / (count - 1)) * plotWidth : plotWidth / 2);
      const y = paddingTop + plotHeight - (m.total / maxTrendExpense) * plotHeight;
      return { x, y, label: m.label, total: m.total };
    });
  }, [monthlyTrend, maxTrendExpense]);

  const linePath = useMemo(() => {
    if (linePoints.length === 0) return "";
    if (linePoints.length === 1) return `M ${linePoints[0].x} ${linePoints[0].y}`;

    let d = `M ${linePoints[0].x.toFixed(1)} ${linePoints[0].y.toFixed(1)}`;
    for (let i = 0; i < linePoints.length - 1; i++) {
      const p0 = linePoints[i === 0 ? i : i - 1];
      const p1 = linePoints[i];
      const p2 = linePoints[i + 1];
      const p3 = linePoints[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }, [linePoints]);

  const areaPath = useMemo(() => {
    if (linePoints.length === 0) return "";
    const baseline = 20 + 90; // 110
    return `${linePath} L ${linePoints[linePoints.length - 1].x.toFixed(1)} ${baseline} L ${linePoints[0].x.toFixed(1)} ${baseline} Z`;
  }, [linePath, linePoints]);

  return (
    <main
      className="flex-1 h-screen p-6 sm:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Top Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8"
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
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
                color: "var(--app-fg)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-400" />
              Live Sync
            </span>
          </div>
          <p className="text-xs opacity-70 mt-1">
            Outflows, bills, lifestyle expenditures, and monthly burn rate telemetry.
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

      {/* ROW 1: SEPARATE KPI CARDS (LEFT TO RIGHT) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Card 1: Total Logged Outflow */}
        <div
          className="rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
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
          <div className="text-3xl font-extrabold font-mono tracking-tight mt-2 text-rose-400">
            {loading ? "..." : formatINR(totalExpenses)}
          </div>
          <p className="text-[11px] opacity-50 mt-1 font-mono">
            Aggregated across {expenses.length} recorded items
          </p>
        </div>

        {/* Card 2: Largest Outflow Category */}
        <div
          className="rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
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
          <div className="text-2xl font-bold tracking-tight mt-2 truncate">
            {topCategoryEntry ? topCategoryEntry[0] : "None"}
          </div>
          <p className="text-[11px] opacity-60 mt-1 font-mono text-amber-400">
            {topCategoryEntry ? formatINR(topCategoryEntry[1]) : "₹0.00"} (
            {topCategoryEntry && totalExpenses > 0
              ? `${((topCategoryEntry[1] / totalExpenses) * 100).toFixed(1)}%`
              : "0%"}
            )
          </p>
        </div>

        {/* Card 3: Expense Volume & Averages */}
        <div
          className="rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
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
          <div className="text-3xl font-extrabold font-mono tracking-tight mt-2">
            {loading ? "..." : `${expenses.length} Items`}
          </div>
          <p className="text-[11px] opacity-50 mt-1 font-mono">
            Avg: {formatINR(averageExpense)} • Peak: {formatINR(maxExpense)}
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
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Spending Trajectory</h3>
              <p className="text-[11px] opacity-60 font-mono mt-0.5">6-Month Monthly Outflow Trend</p>
            </div>
            <div
              className="px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold text-rose-400"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              Peak: {formatINR(Math.max(...monthlyTrend.map((m) => m.total)))}
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full pt-4">
            <svg viewBox="0 0 500 150" className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="expenseTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Subtle Horizontal Reference Guidelines */}
              <line x1="35" y1="20" x2="465" y2="20" stroke="var(--app-border-subtle)" strokeDasharray="3 3" strokeWidth="0.75" />
              <line x1="35" y1="65" x2="465" y2="65" stroke="var(--app-border-subtle)" strokeDasharray="3 3" strokeWidth="0.75" />
              <line x1="35" y1="110" x2="465" y2="110" stroke="var(--app-border-subtle)" strokeWidth="1" />

              {/* Area Under Curve */}
              {areaPath && <path d={areaPath} fill="url(#expenseTrendGradient)" />}

              {/* Smooth Trend Line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#F43F5E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Dots & Month Labels */}
              {linePoints.map((pt, idx) => (
                <g key={idx}>
                  {/* Outer glow circle on active data */}
                  {pt.total > 0 && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={7}
                      fill="#F43F5E"
                      opacity="0.2"
                    />
                  )}
                  {/* Point circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={pt.total > 0 ? 4 : 2.5}
                    fill="#F43F5E"
                    stroke="var(--app-card)"
                    strokeWidth="1.5"
                  />
                  {/* Month Label */}
                  <text
                    x={pt.x}
                    y={130}
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-current opacity-60"
                  >
                    {pt.label}
                  </text>
                  {/* Hover / Point Value */}
                  {pt.total > 0 && (
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      className="text-[9px] font-mono fill-current font-bold opacity-80"
                    >
                      {formatINR(pt.total).replace(".00", "")}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
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
              {chartSegments.length} Categories
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-44 w-full">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : expenses.length === 0 || totalExpenses === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs opacity-60 w-full">
              <PieChartIcon size={28} className="opacity-40 mb-2 text-rose-400" />
              <p>No expense data available.</p>
              <p className="text-[11px] mt-1">Log your first expense to view category allocation.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center pt-4">
              {/* SVG Donut / Pie Chart */}
              <div className="flex justify-center items-center relative flex-shrink-0">
                <svg width="150" height="150" viewBox="0 0 120 120" className="transform -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke="var(--app-border-subtle)"
                    strokeWidth="14"
                  />
                  {chartSegments.map((segment, idx) => (
                    <circle
                      key={idx}
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="14"
                      strokeDasharray={segment.strokeDasharray}
                      strokeDashoffset={segment.strokeDashoffset}
                      className="transition-all duration-500 ease-out"
                    />
                  ))}
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
                  <span className="text-[8px] uppercase tracking-wider font-semibold opacity-60">
                    Total Burn
                  </span>
                  <span className="text-[11px] font-bold font-mono tracking-tight text-rose-400">
                    {formatINR(totalExpenses)}
                  </span>
                </div>
              </div>

              {/* Legend with Color Dots, Categories, and Percentages */}
              <div className="space-y-1.5 w-full max-h-40 overflow-y-auto pr-1">
                {chartSegments.map((segment, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="truncate text-[11px] font-medium opacity-90">{segment.category}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono flex-shrink-0 text-right">
                      <span className="text-[11px] font-semibold">{formatINR(segment.amount)}</span>
                      <span className="text-[10px] opacity-50 w-8 text-right">
                        {segment.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              color: "#F43F5E",
            }}
          >
            {displayedExpenses.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchExpenses();
              fetchAccounts();
            }}
            className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity cursor-pointer font-mono"
            title="Refresh Expenses Data"
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
            Add Expense
          </button>
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
                  className="transition-colors hover:bg-white/[0.02] group"
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
                            <BankLogo name={account.name} size={14} />
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
                          className="w-7 h-7 rounded-md flex items-center justify-center border hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 transition-all text-zinc-400 cursor-pointer"
                          style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)" }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(item.id, item.title)}
                          title="Delete Record"
                          className="w-7 h-7 rounded-md flex items-center justify-center border hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-all text-zinc-400 cursor-pointer"
                          style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)" }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
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
                  <TrendingDown size={18} className="text-rose-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">
                    {editingExpense ? "Edit Expense Record" : "Record Outflow Expense"}
                  </h3>
                  <p className="text-xs opacity-60">
                    {editingExpense ? "Update existing transaction details." : "Log an outflow or expenditure item."}
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

            {/* Quick Presets (Only for New Expense) */}
            {!editingExpense && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider opacity-60">
                  <Sparkles size={11} className="text-amber-400" />
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
                      {preset.label} (₹{preset.amount})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Expense Title or Payee
                </label>
                <input
                  type="text"
                  placeholder="e.g. Swiggy Groceries, Flat Maintenance, Electricity Bill"
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
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm font-mono border focus:outline-none transition-colors"
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

              {/* Paid From Account */}
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Paid From Account (Optional)
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

                {!editingExpense && accountId && (
                  <label className="flex items-center gap-2 mt-2 text-xs opacity-80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deductFromAccount}
                      onChange={(e) => setDeductFromAccount(e.target.checked)}
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <span>Automatically deduct from {accounts.find((a) => a.id === accountId)?.name} balance</span>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Notes or Memo (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via UPI QR / GPay transaction ID"
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
                  {editingExpense ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}