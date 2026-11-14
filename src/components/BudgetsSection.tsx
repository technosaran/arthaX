"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Target,
  Plus,
  Trash2,
  Loader2,
  X,
  Search,
  Pencil,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  ShieldCheck,
  Zap,
  Home,
  Utensils,
  ShoppingCart,
  Car,
  ShoppingBag,
  HeartPulse,
  Film,
  CircleDollarSign,
  Laptop,
  Dumbbell,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
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
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";

export interface BudgetItem {
  id: string;
  user_id?: string;
  category: string;
  amount: number;
  period: string;
  month_year: string;
  alert_threshold: number;
  notes?: string | null;
  created_at?: string;
}

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  expense_date: string;
  notes?: string | null;
  tags?: string[];
}

export interface CategoryMeta {
  name: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  defaultAmount: number;
}

export const BUDGET_CATEGORIES: CategoryMeta[] = [
  { name: "Housing & Rent", color: "#F43F5E", icon: Home, defaultAmount: 20000 },
  { name: "Groceries & Essentials", color: "#10B981", icon: ShoppingCart, defaultAmount: 10000 },
  { name: "Food & Dining", color: "#F59E0B", icon: Utensils, defaultAmount: 6000 },
  { name: "Utilities & Bills", color: "#3B82F6", icon: Zap, defaultAmount: 4500 },
  { name: "Transport & Fuel", color: "#8B5CF6", icon: Car, defaultAmount: 4500 },
  { name: "Vehicle & Servicing", color: "#A78BFA", icon: Car, defaultAmount: 3000 },
  { name: "Shopping & Lifestyle", color: "#EC4899", icon: ShoppingBag, defaultAmount: 5000 },
  { name: "Electronics & Gadgets", color: "#38BDF8", icon: Laptop, defaultAmount: 5000 },
  { name: "Health & Medical", color: "#06B6D4", icon: HeartPulse, defaultAmount: 3500 },
  { name: "Fitness & Sports", color: "#10B981", icon: Dumbbell, defaultAmount: 2500 },
  { name: "Entertainment & OTT", color: "#A855F7", icon: Film, defaultAmount: 2000 },
];

export default function BudgetsSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const redisBudgetsKey = getUserCacheKey(user?.id, CACHE_KEYS.BUDGETS);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency)
  const initialBudgets = useMemo(() => {
    return getFromLocalCache<BudgetItem[]>(redisBudgetsKey) || [];
  }, [redisBudgetsKey]);

  const [budgets, setBudgets] = useState<BudgetItem[]>(initialBudgets);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(initialBudgets.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Month navigation
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthYear);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "ACTIVE" | "UNSET">("ALL");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Form Fields
  const [formCategory, setFormCategory] = useState(BUDGET_CATEGORIES[0].name);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formThreshold, setFormThreshold] = useState("80");
  const [formNotes, setFormNotes] = useState("");

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Earliest data month
  const earliestMonthYear = useMemo(() => {
    const dates = [
      ...budgets.map((b) => b.month_year),
      ...expenses.map((e) => e.expense_date),
    ].filter(Boolean);
    return getEarliestDataMonth(dates);
  }, [budgets, expenses]);

  const canGoPrev = selectedMonthYear > earliestMonthYear;
  const canGoNext = selectedMonthYear < currentMonthYear;
  const isCurrentMonth = selectedMonthYear === currentMonthYear;

  const monthDisplayTitle = useMemo(() => {
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

  // 1. Fetch Budgets
  const fetchBudgets = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    setErrorMsg(null);
    try {
      if (!skipCache) {
        const cached = getFromLocalCache<BudgetItem[]>(redisBudgetsKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          setBudgets(cached);
          setLoading(false);
        }
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg("Unable to retrieve budget records.");
      } else if (data) {
        const mapped: BudgetItem[] = data.map((b) => ({
          id: b.id,
          user_id: b.user_id,
          category: b.category,
          amount: Number(b.amount) || 0,
          period: b.period,
          month_year: b.month_year,
          alert_threshold: Number(b.alert_threshold) || 80,
          notes: b.notes,
          created_at: b.created_at,
        }));
        setBudgets(mapped);
        saveToCache(redisBudgetsKey, mapped, 3600);
      }
    } catch {
      setErrorMsg("Unable to load budgets. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, redisBudgetsKey]);

  // 2. Fetch Expenses for current month
  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("expenses")
        .select("id, title, amount, category, expense_date, notes, tags")
        .eq("user_id", user.id);

      if (!error && data) {
        setExpenses(
          data
            .map((e) => ({
              id: e.id,
              title: e.title,
              amount: Number(e.amount) || 0,
              category: e.category,
              expense_date: e.expense_date,
              notes: e.notes,
              tags: e.tags || [],
            }))
            .filter((e) => !isFamilyTransfer(e))
        );
      }
    } catch {
      // Non-blocking
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchBudgets();
    fetchExpenses();

    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-budgets-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budgets", filter: `user_id=eq.${user.id}` },
        () => fetchBudgets(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${user.id}` },
        () => fetchExpenses()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchBudgets, fetchExpenses]);

  // Expenses filtered to active month
  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((e) => e.expense_date && e.expense_date.startsWith(selectedMonthYear));
  }, [expenses, selectedMonthYear]);

  // Spending aggregated by category for this month
  const categorySpentMap = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const exp of currentMonthExpenses) {
      const catKey = exp.category || "Other & Contingency";
      if (!map[catKey]) {
        map[catKey] = { total: 0, count: 0 };
      }
      map[catKey].total += exp.amount;
      map[catKey].count += 1;
    }
    return map;
  }, [currentMonthExpenses]);

  // Budgets filtered to active month
  const currentMonthBudgets = useMemo(() => {
    return budgets.filter((b) => b.month_year === selectedMonthYear);
  }, [budgets, selectedMonthYear]);

  // Build the complete list of category cards
  const allCategoryCards = useMemo(() => {
    const budgetMap = new Map<string, BudgetItem>();
    currentMonthBudgets.forEach((b) => {
      budgetMap.set(b.category.toLowerCase(), b);
    });

    const cards = BUDGET_CATEGORIES.map((catMeta) => {
      const budgetItem = budgetMap.get(catMeta.name.toLowerCase());
      const spentData = categorySpentMap[catMeta.name] || { total: 0, count: 0 };
      const spent = spentData.total;
      const isBudgeted = !!budgetItem;
      const budgetAmount = budgetItem ? budgetItem.amount : 0;
      const remaining = budgetAmount - spent;
      const percentUsed = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const isOverBudget = isBudgeted && spent > budgetAmount;
      const isWarning = isBudgeted && !isOverBudget && percentUsed >= (budgetItem?.alert_threshold || 80);

      return {
        category: catMeta.name,
        meta: catMeta,
        color: catMeta.color,
        IconComponent: catMeta.icon,
        isBudgeted,
        budgetItem,
        budgetAmount,
        spentAmount: spent,
        remainingAmount: remaining,
        percentUsed,
        isOverBudget,
        isWarning,
        expenseCount: spentData.count,
      };
    });

    // Custom categories
    currentMonthBudgets.forEach((b) => {
      const exists = cards.some((c) => c.category.toLowerCase() === b.category.toLowerCase());
      if (!exists) {
        const spentData = categorySpentMap[b.category] || { total: 0, count: 0 };
        const spent = spentData.total;
        const budgetAmount = b.amount;
        const remaining = budgetAmount - spent;
        const percentUsed = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        const isOverBudget = spent > budgetAmount;
        const isWarning = !isOverBudget && percentUsed >= (b.alert_threshold || 80);

        cards.push({
          category: b.category,
          meta: {
            name: b.category,
            color: "#71717A",
            icon: CircleDollarSign,
            defaultAmount: b.amount,
          },
          color: "#71717A",
          IconComponent: CircleDollarSign,
          isBudgeted: true,
          budgetItem: b,
          budgetAmount,
          spentAmount: spent,
          remainingAmount: remaining,
          percentUsed,
          isOverBudget,
          isWarning,
          expenseCount: spentData.count,
        });
      }
    });

    return cards;
  }, [currentMonthBudgets, categorySpentMap]);

  const activeBudgetsCount = useMemo(() => {
    return allCategoryCards.filter((c) => c.isBudgeted).length;
  }, [allCategoryCards]);

  // High-Level KPIs
  const totalBudgeted = useMemo(() => {
    return currentMonthBudgets.reduce((acc, curr) => acc + curr.amount, 0);
  }, [currentMonthBudgets]);

  const totalSpentInBudgetedCategories = useMemo(() => {
    return allCategoryCards
      .filter((c) => c.isBudgeted)
      .reduce((acc, curr) => acc + curr.spentAmount, 0);
  }, [allCategoryCards]);

  const totalRemaining = useMemo(() => {
    return totalBudgeted - totalSpentInBudgetedCategories;
  }, [totalBudgeted, totalSpentInBudgetedCategories]);

  const overallPercentUsed = useMemo(() => {
    if (totalBudgeted <= 0) return 0;
    return (totalSpentInBudgetedCategories / totalBudgeted) * 100;
  }, [totalBudgeted, totalSpentInBudgetedCategories]);

  // Pace & Projections
  const paceMetrics = useMemo(() => {
    const [yearStr, monthStr] = selectedMonthYear.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    const now = new Date();
    let currentDay = totalDaysInMonth;
    if (isCurrentMonth) {
      currentDay = now.getDate();
    } else if (new Date(year, month - 1, 1) > now) {
      currentDay = 1;
    }

    const daysLeft = Math.max(0, totalDaysInMonth - currentDay);
    const dailyAllowance = daysLeft > 0 && totalRemaining > 0 ? totalRemaining / daysLeft : 0;
    const projectedSpend = currentDay > 0 ? (totalSpentInBudgetedCategories / currentDay) * totalDaysInMonth : 0;
    const projectedDiff = totalBudgeted - projectedSpend;

    return {
      totalDaysInMonth,
      currentDay,
      daysLeft,
      dailyAllowance,
      projectedSpend,
      projectedDiff,
    };
  }, [selectedMonthYear, isCurrentMonth, totalRemaining, totalSpentInBudgetedCategories, totalBudgeted]);

  // Filtered Cards
  const displayedCards = useMemo(() => {
    return allCategoryCards.filter((item) => {
      if (filterMode === "ACTIVE" && !item.isBudgeted) return false;
      if (filterMode === "UNSET" && item.isBudgeted) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCategory = item.category.toLowerCase().includes(q);
        const matchNotes = item.budgetItem?.notes?.toLowerCase().includes(q);
        if (!matchCategory && !matchNotes) return false;
      }

      return true;
    });
  }, [allCategoryCards, filterMode, searchQuery]);

  // Modal Handlers
  const handleOpenAddModal = (presetCategory?: string, defaultAmt?: number) => {
    setEditingBudget(null);
    if (presetCategory) {
      setFormCategory(presetCategory);
      setIsCustomCategory(false);
      setCustomCategoryName("");
      setFormAmount(defaultAmt ? defaultAmt.toString() : "");
    } else {
      setFormCategory(BUDGET_CATEGORIES[0].name);
      setIsCustomCategory(false);
      setCustomCategoryName("");
      setFormAmount(BUDGET_CATEGORIES[0].defaultAmount.toString());
    }
    setFormThreshold("80");
    setFormNotes("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (budget: BudgetItem) => {
    setEditingBudget(budget);
    const isStandard = BUDGET_CATEGORIES.some((c) => c.name === budget.category);
    if (isStandard) {
      setFormCategory(budget.category);
      setIsCustomCategory(false);
      setCustomCategoryName("");
    } else {
      setFormCategory("custom");
      setIsCustomCategory(true);
      setCustomCategoryName(budget.category);
    }
    setFormAmount(budget.amount.toString());
    setFormThreshold((budget.alert_threshold || 80).toString());
    setFormNotes(budget.notes || "");
    setIsModalOpen(true);
  };

  // Submit Add / Edit Budget
  const handleSubmitBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const resolvedCategory = isCustomCategory ? customCategoryName.trim() : formCategory.trim();
    const parsedAmount = parseFloat(formAmount);
    const parsedThreshold = parseInt(formThreshold, 10) || 80;

    if (!resolvedCategory || isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Invalid Input", "Please provide a valid category and budget limit amount.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      if (editingBudget) {
        const { error } = await supabase
          .from("budgets")
          .update({
            category: resolvedCategory,
            amount: parsedAmount,
            alert_threshold: parsedThreshold,
            notes: formNotes.trim() || null,
          })
          .eq("id", editingBudget.id)
          .eq("user_id", user.id);

        if (error) throw error;
        showToast("Budget Updated", `Updated limit for ${resolvedCategory} to ${formatINR(parsedAmount)}`, "success");
      } else {
        const existing = currentMonthBudgets.find(
          (b) => b.category.toLowerCase() === resolvedCategory.toLowerCase()
        );

        if (existing) {
          const { error } = await supabase
            .from("budgets")
            .update({
              amount: parsedAmount,
              alert_threshold: parsedThreshold,
              notes: formNotes.trim() || null,
            })
            .eq("id", existing.id)
            .eq("user_id", user.id);

          if (error) throw error;
          showToast("Budget Updated", `Updated existing budget for ${resolvedCategory}`, "success");
        } else {
          const { error } = await supabase.from("budgets").insert({
            user_id: user.id,
            category: resolvedCategory,
            amount: parsedAmount,
            period: "monthly",
            month_year: selectedMonthYear,
            alert_threshold: parsedThreshold,
            notes: formNotes.trim() || null,
          });

          if (error) throw error;
          showToast("Budget Added", `Budget of ${formatINR(parsedAmount)} set for ${resolvedCategory}`, "success");
        }
      }

      setIsModalOpen(false);
      await invalidateCacheKeys([redisBudgetsKey, "arthax:cache:budgets"]);
      await fetchBudgets(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving budget record.";
      showToast("Operation Failed", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Budget
  const handleDeleteBudget = async (id: string, category: string) => {
    if (!user) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;

      showToast("Budget Removed", `Removed budget target for ${category}`, "info");
      setDeleteConfirmationId(null);
      await invalidateCacheKeys([redisBudgetsKey, "arthax:cache:budgets"]);
      await fetchBudgets(true);
    } catch {
      showToast("Delete Failed", "Could not remove budget target.", "error");
    }
  };

  return (
    <main
      className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Universal Page Header */}
      <PageHeader
        title="Category Budgets & Controls"
        description="Establish spending ceilings, track real-time utilization, and prevent budget overruns."
        badge={
          <Badge variant="amber">
            {activeBudgetsCount} Active / {allCategoryCards.length} Categories
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
                title={!canGoPrev ? "No earlier records" : "Previous Month"}
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
              {!isCurrentMonth && (
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
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => handleOpenAddModal()}
            >
              Set Category Budget
            </Button>
          </div>
        }
      />

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl text-xs border border-rose-500/30 bg-rose-500/10 text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{errorMsg}</span>
          </div>
          <Button size="xs" variant="ghost" onClick={() => fetchBudgets()}>
            Retry
          </Button>
        </div>
      )}

      {/* 2. SEPARATE KPI TELEMETRY CARDS */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          {/* Card 1: Allocated Cap */}
          <StatCard
            title="Allocated Budget Cap"
            value={formatINR(totalBudgeted)}
            icon={<Target size={16} />}
            iconColor="amber"
            subtitle={`${activeBudgetsCount} categories active for ${monthDisplayTitle}`}
          />

          {/* Card 2: Total Spent */}
          <StatCard
            title="Total Spent of Cap"
            value={<span className="text-rose-400">{formatINR(totalSpentInBudgetedCategories)}</span>}
            icon={<TrendingDown size={16} />}
            iconColor="rose"
            subtitle={`${overallPercentUsed.toFixed(1)}% of total ceiling burned`}
          />

          {/* Card 3: Safe Balance */}
          <StatCard
            title={totalRemaining >= 0 ? "Safe Cushion Balance" : "Budget Exceeded"}
            value={
              <span className={totalRemaining >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {totalRemaining >= 0 ? formatINR(totalRemaining) : `-${formatINR(Math.abs(totalRemaining))}`}
              </span>
            }
            icon={<ShieldCheck size={16} />}
            iconColor={totalRemaining >= 0 ? "emerald" : "rose"}
            subtitle={totalRemaining >= 0 ? "Safe buffer remaining" : "Exceeded spending limits"}
          />

          {/* Card 4: Daily Safe Burn */}
          <StatCard
            title="Daily Safe Burn Pace"
            value={
              <span className="text-emerald-400">
                {paceMetrics.dailyAllowance > 0 ? formatINR(paceMetrics.dailyAllowance) : "₹0"}
                <span className="text-xs font-normal opacity-60"> /day</span>
              </span>
            }
            icon={<Zap size={16} />}
            iconColor="emerald"
            subtitle={`${paceMetrics.daysLeft} days remaining this month`}
          />
        </div>
      )}

      {/* MONTH BURN PACE PROGRESS BAR */}
      <div
        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 sm:p-5 mb-6 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--app-muted)]">
              Overall Budget Burn Pace
            </span>
            <Badge
              variant={
                overallPercentUsed > 100
                  ? "danger"
                  : overallPercentUsed > 80
                  ? "warning"
                  : "success"
              }
            >
              {overallPercentUsed.toFixed(1)}% consumed
            </Badge>
          </div>

          <div className="text-[11px] text-[var(--app-muted)]">
            Projected Spend:{" "}
            <strong className="font-bold font-mono text-[var(--app-fg)]">
              {formatINR(paceMetrics.projectedSpend)}
            </strong>
            {totalBudgeted > 0 && (
              <span
                className={
                  paceMetrics.projectedDiff >= 0
                    ? "text-emerald-400 ml-1.5 font-bold"
                    : "text-rose-400 ml-1.5 font-bold"
                }
              >
                ({paceMetrics.projectedDiff >= 0
                  ? `~${formatINR(paceMetrics.projectedDiff)} safe`
                  : `~${formatINR(Math.abs(paceMetrics.projectedDiff))} overrun`})
              </span>
            )}
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-[var(--app-track-bg)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, overallPercentUsed)}%`,
              backgroundColor:
                overallPercentUsed > 100
                  ? "#f43f5e"
                  : overallPercentUsed > 80
                  ? "#F59E0B"
                  : "#10b981",
            }}
          />
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div
        className="p-3 sm:p-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs"
      >
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--app-muted)]" />
            <input
              type="text"
              placeholder="Search category limits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[var(--app-muted)] hover:text-[var(--app-fg)] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: "ALL", label: `All (${allCategoryCards.length})` },
            { id: "ACTIVE", label: `Active (${activeBudgetsCount})` },
            { id: "UNSET", label: `Unset (${allCategoryCards.length - activeBudgetsCount})` },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setFilterMode(mode.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                filterMode === mode.id
                  ? "border-[var(--app-accent)] bg-[var(--app-accent-subtle)] text-[var(--app-accent)] font-bold shadow-xs"
                  : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CATEGORY CARDS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : displayedCards.length === 0 ? (
        <EmptyState
          icon={<Target size={32} className="text-amber-400" />}
          title="No Categories Match Filter"
          description="Try adjusting your filter or search criteria to view matching categories."
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFilterMode("ALL");
                setSearchQuery("");
              }}
            >
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {displayedCards.map((item) => {
            const Icon = item.IconComponent;
            const progress = Math.min(100, item.percentUsed);
            const statusColor = item.isOverBudget
              ? "#f43f5e"
              : item.isWarning
              ? "#F59E0B"
              : "#10b981";

            if (item.isBudgeted) {
              return (
                <div
                  key={item.category}
                  className="rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] shadow-xs relative group"
                  style={{
                    backgroundColor: "var(--app-card)",
                    borderColor: item.isOverBudget
                      ? "rgba(244, 63, 94, 0.4)"
                      : item.isWarning
                      ? "rgba(245, 158, 11, 0.3)"
                      : "var(--app-border)",
                  }}
                >
                  <div>
                    {/* Top: Icon, Name, Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: `${item.color}15`,
                            color: item.color,
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold tracking-tight truncate text-[var(--app-fg)]">{item.category}</h4>
                          <span className="text-[10px] font-mono text-[var(--app-muted)] block truncate">
                            {item.expenseCount} {item.expenseCount === 1 ? "expense" : "expenses"} logged
                          </span>
                        </div>
                      </div>

                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex-shrink-0"
                        style={{
                          borderColor: `${statusColor}40`,
                          color: statusColor,
                          backgroundColor: `${statusColor}10`,
                        }}
                      >
                        {item.percentUsed.toFixed(0)}%
                      </span>
                    </div>

                    {/* Figures */}
                    <div className="my-3 font-mono">
                      <div className="flex items-baseline justify-between">
                        <span
                          className="text-lg font-extrabold tracking-tight tabular-nums"
                          style={{ color: item.isOverBudget ? "#f43f5e" : "var(--app-fg)" }}
                        >
                          {formatINR(item.spentAmount)}
                        </span>
                        <span className="text-xs text-[var(--app-muted)] font-normal tabular-nums">
                          of {formatINR(item.budgetAmount)}
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] overflow-hidden mt-2">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: statusColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Remaining and Actions */}
                  <div className="pt-2.5 mt-2 border-t border-[var(--app-border-subtle)] flex items-center justify-between text-[11px] font-mono">
                    <span
                      className="font-medium truncate tabular-nums"
                      style={{ color: item.isOverBudget ? "#f43f5e" : "#10b981" }}
                    >
                      {item.isOverBudget
                        ? `Over +${formatINR(Math.abs(item.remainingAmount))}`
                        : `${formatINR(item.remainingAmount)} left`}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => item.budgetItem && handleOpenEditModal(item.budgetItem)}
                        title="Edit Limit"
                        className="p-1 rounded-lg text-[var(--app-muted)] hover:text-amber-400 cursor-pointer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => item.budgetItem && setDeleteConfirmationId(item.budgetItem.id)}
                        title="Remove Limit"
                        className="p-1 rounded-lg text-[var(--app-muted)] hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Unset Card ready to set
            return (
              <div
                key={item.category}
                onClick={() => handleOpenAddModal(item.category, item.meta.defaultAmount)}
                className="rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-card)] p-5 transition-all duration-200 flex flex-col justify-between hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] shadow-xs group cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${item.color}15`,
                          color: item.color,
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold tracking-tight truncate text-[var(--app-fg)] group-hover:text-amber-400 transition-colors">
                          {item.category}
                        </h4>
                        <span className="text-[10px] font-mono text-[var(--app-muted)] block truncate">
                          {item.spentAmount > 0
                            ? `${formatINR(item.spentAmount)} spent`
                            : "No ceiling set"}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-[var(--app-border-subtle)] text-[var(--app-muted)] flex-shrink-0">
                      Unset
                    </span>
                  </div>

                  <div className="my-3 font-mono">
                    <div className="flex items-baseline justify-between text-[11px] text-[var(--app-muted)]">
                      <span>Suggested:</span>
                      <strong className="font-bold text-[var(--app-fg)] tabular-nums">{formatINR(item.meta.defaultAmount)}</strong>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] mt-2" />
                  </div>
                </div>

                <div className="pt-2.5 mt-2 border-t border-[var(--app-border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--app-muted)]">Ready to set</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--app-accent)] group-hover:underline">
                    <Plus size={11} />
                    <span>Set Budget</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT BUDGET */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBudget ? "Edit Category Budget" : "Set Category Spending Limit"}
        description={`Target Period: ${monthDisplayTitle}`}
        size="lg"
      >
        <form onSubmit={handleSubmitBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold tracking-tight text-[var(--app-fg)] mb-1.5">
              Category
            </label>
            <Select
              value={isCustomCategory ? "custom" : formCategory}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setIsCustomCategory(true);
                } else {
                  setIsCustomCategory(false);
                  setFormCategory(e.target.value);
                  const found = BUDGET_CATEGORIES.find((c) => c.name === e.target.value);
                  if (found && !formAmount) {
                    setFormAmount(found.defaultAmount.toString());
                  }
                }
              }}
            >
              {BUDGET_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value="custom">+ Custom Category Name...</option>
            </Select>

            {isCustomCategory && (
              <div className="mt-2">
                <Input
                  placeholder="Enter custom category name (e.g. Photography, Vintage)"
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div>
            <Input
              label="Monthly Budget Ceiling (₹ INR)"
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 10000"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              required
              leftIcon={<span className="font-mono text-xs font-bold">₹</span>}
            />

            {/* Quick Increment Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[1000, 5000, 10000, 25000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => {
                    const curr = parseFloat(formAmount) || 0;
                    setFormAmount((curr + inc).toString());
                  }}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:border-[var(--app-border)] cursor-pointer"
                >
                  +{formatINR(inc)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFormAmount("")}
                className="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-[var(--app-border-subtle)] text-[var(--app-muted)] hover:text-rose-400 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="font-semibold text-[var(--app-fg)]">
                Warning Alert Threshold
              </span>
              <span className="font-mono font-bold text-amber-400">
                {formThreshold}% of ceiling
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={formThreshold}
              onChange={(e) => setFormThreshold(e.target.value)}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <Input
            label="Internal Notes (Optional)"
            placeholder="e.g. Monthly limit for dining out, Swiggy orders, and weekend brunches"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />

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
              {editingBudget ? "Save Changes" : "Set Budget Limit"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: DELETE CONFIRMATION */}
      <Modal
        isOpen={!!deleteConfirmationId}
        onClose={() => setDeleteConfirmationId(null)}
        title="Remove Category Budget?"
        description="Are you sure you want to delete this category budget limit? Recorded transactions will remain untouched."
        size="sm"
      >
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleteConfirmationId(null)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              const b = budgets.find((item) => item.id === deleteConfirmationId);
              if (b) handleDeleteBudget(b.id, b.category);
            }}
          >
            Delete Budget
          </Button>
        </div>
      </Modal>
    </main>
  );
}
