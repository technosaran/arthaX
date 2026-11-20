"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Target,
  Plus,
  Trash2,
  X,
  Search,
  Pencil,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  ShieldCheck,
  Zap,
  CircleDollarSign,
  Copy,
  PieChart,
  Eye,
  Download,
  Calendar,
  CheckCircle2,
  ArrowUpDown,
  Filter,
  BarChart3,
} from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/cacheKeys";
import { saveToCache, getFromLocalCache, invalidateAllFinancialCache } from "@/utils/cacheClient";
import {
  getCurrentMonthYear,
  formatMonthDisplay,
  getEarliestDataMonth,
  computeNextMonth,
  computePrevMonth,
} from "@/utils/monthUtils";
import { isFamilyTransfer } from "@/utils/expenseFilter";
import { exportBudgetsPDF } from "@/utils/pdfExport";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import {
  BudgetItem,
  ExpenseItem,
  CategoryCardData,
  BudgetFilterMode,
  BudgetSortMode,
  BUDGET_CATEGORIES,
  getCategoryMetadata,
  getPrecedingMonth,
  calculateBudgetPace,
  analyzeUnbudgetedSpending,
  buildCategoryCards,
  filterAndSortCategoryCards,
  prepareBudgetRollover,
  normalizeCategoryName,
} from "@/utils/budgetUtils";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, StatCardSkeleton } from "@/components/ui/Skeleton";

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
  const inFlightRef = useRef<{ budgets: boolean; expenses: boolean }>({ budgets: false, expenses: false });
  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [submittingCopy, setSubmittingCopy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Month navigation
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthYear);

  // Filter & Search & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<BudgetFilterMode>("ALL");
  const [sortMode, setSortMode] = useState<BudgetSortMode>("RISK");
  const [activeTab, setActiveTab] = useState<"budgets" | "analytics">("budgets");
  const [analyticsTab, setAnalyticsTab] = useState<"BUDGET" | "SPENT">("BUDGET");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState<CategoryCardData | null>(null);
  const [drillDownSearch, setDrillDownSearch] = useState("");

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
    if (!user || inFlightRef.current.budgets) return;
    inFlightRef.current.budgets = true;
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
      inFlightRef.current.budgets = false;
    }
  }, [user, redisBudgetsKey]);

  // 2. Fetch Expenses
  const fetchExpenses = useCallback(async () => {
    if (!user || inFlightRef.current.expenses) return;
    inFlightRef.current.expenses = true;
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
    } finally {
      inFlightRef.current.expenses = false;
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

  // Synchronize budgets whenever another section modifies financial data
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchBudgets(true);
      fetchExpenses();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("arthax:financial_data_updated", handleDataUpdated);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("arthax:financial_data_updated", handleDataUpdated);
      }
    };
  }, [fetchBudgets, fetchExpenses]);

  // Expenses filtered to active month
  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((e) => e.expense_date && e.expense_date.startsWith(selectedMonthYear));
  }, [expenses, selectedMonthYear]);

  // Budgets filtered to active month
  const currentMonthBudgets = useMemo(() => {
    return budgets.filter((b) => b.month_year === selectedMonthYear);
  }, [budgets, selectedMonthYear]);

  // Preceding month key & budgets for rollover
  const precedingMonth = useMemo(() => {
    return getPrecedingMonth(selectedMonthYear);
  }, [selectedMonthYear]);

  const precedingMonthBudgets = useMemo(() => {
    if (!precedingMonth) return [];
    return budgets.filter((b) => b.month_year === precedingMonth);
  }, [budgets, precedingMonth]);

  // Rollover preview
  const rolloverPreview = useMemo(() => {
    if (!user) return { toInsert: [], skippedCount: 0, totalAmount: 0 };
    return prepareBudgetRollover(
      precedingMonthBudgets,
      currentMonthBudgets,
      selectedMonthYear,
      user.id
    );
  }, [precedingMonthBudgets, currentMonthBudgets, selectedMonthYear, user]);

  // Unbudgeted spending analysis
  const { unbudgetedExpenses, totalUnbudgeted, unbudgetedCategories } = useMemo(() => {
    return analyzeUnbudgetedSpending(currentMonthExpenses, currentMonthBudgets);
  }, [currentMonthExpenses, currentMonthBudgets]);

  // Build the complete list of category cards (Standard + Custom + Unbudgeted Active)
  const allCategoryCards = useMemo(() => {
    return buildCategoryCards(currentMonthBudgets, currentMonthExpenses);
  }, [currentMonthBudgets, currentMonthExpenses]);

  // Counts for filter pills
  const filterCounts = useMemo(() => {
    let active = 0;
    let over = 0;
    let warning = 0;
    let onTrack = 0;
    let unset = 0;
    let withSpend = 0;

    for (const c of allCategoryCards) {
      if (c.isBudgeted) {
        active++;
        if (c.isOverBudget) over++;
        else if (c.isWarning) warning++;
        else onTrack++;
      } else {
        unset++;
      }
      if (c.spentAmount > 0) withSpend++;
    }

    return {
      total: allCategoryCards.length,
      active,
      over,
      warning,
      onTrack,
      unset,
      withSpend,
    };
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

  const totalMonthExpenses = useMemo(() => {
    return currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [currentMonthExpenses]);

  // Pace & Projections
  const paceMetrics = useMemo(() => {
    return calculateBudgetPace(
      selectedMonthYear,
      isCurrentMonth,
      totalBudgeted,
      totalSpentInBudgetedCategories
    );
  }, [selectedMonthYear, isCurrentMonth, totalBudgeted, totalSpentInBudgetedCategories]);

  // Filtered & Sorted Cards
  const displayedCards = useMemo(() => {
    return filterAndSortCategoryCards(allCategoryCards, filterMode, sortMode, searchQuery);
  }, [allCategoryCards, filterMode, sortMode, searchQuery]);

  // Analytics Donut Segments
  const donutSegments = useMemo<DonutSegment[]>(() => {
    if (analyticsTab === "BUDGET") {
      return currentMonthBudgets
        .filter((b) => b.amount > 0)
        .map((b) => ({
          label: b.category,
          value: b.amount,
          color: getCategoryMetadata(b.category).color,
        }))
        .sort((a, b) => b.value - a.value);
    } else {
      const catTotals = new Map<string, number>();
      for (const exp of currentMonthExpenses) {
        const cat = normalizeCategoryName(exp.category);
        catTotals.set(cat, (catTotals.get(cat) || 0) + exp.amount);
      }
      const segs: DonutSegment[] = [];
      catTotals.forEach((val, cat) => {
        if (val > 0) {
          segs.push({
            label: cat,
            value: val,
            color: getCategoryMetadata(cat).color,
          });
        }
      });
      return segs.sort((a, b) => b.value - a.value);
    }
  }, [analyticsTab, currentMonthBudgets, currentMonthExpenses]);

  // Filtered transactions for drill-down modal
  const drillDownFilteredExpenses = useMemo(() => {
    if (!drillDownCategory) return [];
    const q = drillDownSearch.trim().toLowerCase();
    return drillDownCategory.expenses.filter((e) => {
      if (!q) return true;
      const matchTitle = (e.title || "").toLowerCase().includes(q);
      const matchNotes = (e.notes || "").toLowerCase().includes(q);
      const matchTags = (e.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchNotes || matchTags;
    });
  }, [drillDownCategory, drillDownSearch]);

  // Modal Handlers
  const handleOpenAddModal = (presetCategory?: string, defaultAmt?: number) => {
    setEditingBudget(null);
    if (presetCategory) {
      const isStandard = BUDGET_CATEGORIES.some((c) => c.name === presetCategory);
      if (isStandard) {
        setFormCategory(presetCategory);
        setIsCustomCategory(false);
        setCustomCategoryName("");
      } else {
        setFormCategory("custom");
        setIsCustomCategory(true);
        setCustomCategoryName(presetCategory);
      }
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
      await invalidateAllFinancialCache(user?.id);
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
      await invalidateAllFinancialCache(user?.id);
      await fetchBudgets(true);
    } catch {
      showToast("Delete Failed", "Could not remove budget target.", "error");
    }
  };

  // Rollover / Copy previous month budgets
  const handleConfirmCopyBudgets = async () => {
    if (!user || rolloverPreview.toInsert.length === 0) return;
    setSubmittingCopy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("budgets").insert(rolloverPreview.toInsert);
      if (error) throw error;

      showToast(
        "Budgets Copied",
        `Successfully copied ${rolloverPreview.toInsert.length} category budgets from ${formatMonthDisplay(precedingMonth)}!`,
        "success"
      );
      setIsCopyModalOpen(false);
      await invalidateAllFinancialCache(user?.id);
      await fetchBudgets(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not copy budgets.";
      showToast("Copy Failed", msg, "error");
    } finally {
      setSubmittingCopy(false);
    }
  };

  // Export PDF statement
  const handleExportPDF = async () => {
    try {
      setExportingPdf(true);
      await exportBudgetsPDF(currentMonthBudgets, currentMonthExpenses);
      showToast("PDF Exported", "Category budget statement downloaded successfully.", "success");
    } catch {
      showToast("Export Failed", "Could not generate budget PDF statement.", "error");
    } finally {
      setExportingPdf(false);
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
        description="Establish spending ceilings, detect unbudgeted leaks, and enforce month-over-month fiscal discipline."
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

            {/* Copy from Last Month Button */}
            {precedingMonthBudgets.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy size={13} />}
                onClick={() => setIsCopyModalOpen(true)}
                title={`Copy active ceilings from ${formatMonthDisplay(precedingMonth)}`}
              >
                Copy Last Month
              </Button>
            )}

            {/* Toggle Analytics Section */}
            <Button
              size="sm"
              variant={activeTab === "analytics" ? "primary" : "secondary"}
              icon={<PieChart size={13} />}
              onClick={() => setActiveTab(activeTab === "analytics" ? "budgets" : "analytics")}
              title={activeTab === "analytics" ? "Switch to Budgets View" : "Switch to Budget Analytics"}
            >
              Analytics
            </Button>

            {/* Export PDF */}
            <Button
              size="sm"
              variant="secondary"
              icon={<Download size={13} />}
              onClick={handleExportPDF}
              loading={exportingPdf}
              title="Download Budget Statement PDF"
            >
              PDF
            </Button>

            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => handleOpenAddModal()}
            >
              Set Budget
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
            subtitle={`${filterCounts.active} active ceilings set for ${monthDisplayTitle}`}
          />

          {/* Card 2: Budgeted Utilization */}
          <StatCard
            title="Budgeted Spend"
            value={<span className="text-rose-400">{formatINR(totalSpentInBudgetedCategories)}</span>}
            icon={<TrendingDown size={16} />}
            iconColor="rose"
            subtitle={`${overallPercentUsed.toFixed(1)}% of total ceiling consumed`}
          />

          {/* Card 3: Unbudgeted Outflows */}
          <StatCard
            title="Unbudgeted Outflows"
            value={
              <span className={totalUnbudgeted > 0 ? "text-amber-400" : "text-emerald-400"}>
                {formatINR(totalUnbudgeted)}
              </span>
            }
            icon={<AlertTriangle size={16} />}
            iconColor={totalUnbudgeted > 0 ? "amber" : "emerald"}
            subtitle={
              totalUnbudgeted > 0
                ? `${unbudgetedCategories.length} categories without limits`
                : "All outflows covered by budgets"
            }
          />

          {/* Card 4: Safe Cushion Balance */}
          <StatCard
            title={totalRemaining >= 0 ? "Safe Cushion Balance" : "Budget Overrun"}
            value={
              <span className={totalRemaining >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {totalRemaining >= 0 ? formatINR(totalRemaining) : `-${formatINR(Math.abs(totalRemaining))}`}
              </span>
            }
            icon={<ShieldCheck size={16} />}
            iconColor={totalRemaining >= 0 ? "emerald" : "rose"}
            subtitle={
              totalRemaining >= 0
                ? `${paceMetrics.dailyAllowance > 0 ? formatINR(paceMetrics.dailyAllowance) : "₹0"}/day safe pace`
                : "Exceeded allocated spending limits"
            }
          />
        </div>
      )}

      {/* 3. VIEW SUB-TABS: BUDGETS & CEILINGS vs BUDGET ANALYTICS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-[var(--app-border)]">
        <SegmentedControl
          value={activeTab}
          onChange={(val) => setActiveTab(val as "budgets" | "analytics")}
          options={[
            {
              value: "budgets",
              label: (
                <span className="flex items-center gap-1.5">
                  <Target size={14} />
                  <span>Budgets & Ceilings</span>
                  <Badge variant="neutral" className="ml-1">
                    {filterCounts.active}
                  </Badge>
                </span>
              ),
            },
            {
              value: "analytics",
              label: (
                <span className="flex items-center gap-1.5">
                  <PieChart size={14} />
                  <span>Budget Analytics</span>
                  {filterCounts.over > 0 && (
                    <Badge variant="danger" className="ml-1">
                      {filterCounts.over} over
                    </Badge>
                  )}
                </span>
              ),
            },
          ]}
        />

        <div className="text-xs font-mono text-[var(--app-muted)] flex items-center gap-2">
          {activeTab === "budgets" ? (
            <span>Showing {displayedCards.length} of {allCategoryCards.length} categories</span>
          ) : (
            <span>
              {monthDisplayTitle} • {filterCounts.over > 0 ? (
                <span className="text-rose-400 font-bold">{filterCounts.over} ceilings exceeded</span>
              ) : (
                <span className="text-emerald-400 font-bold">All ceilings healthy</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. SECTION 1: BUDGETS & CEILINGS VIEW                         */}
      {/* ============================================================ */}
      {activeTab === "budgets" && (
        <div className="space-y-6 animate-in fade-in duration-200">
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
                  ? `~${formatINR(paceMetrics.projectedDiff)} safe buffer`
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

      {/* UNBUDGETED SPENDING CALLOUT BANNER */}
      {totalUnbudgeted > 0 && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xs shadow-xs animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--app-fg)]">
                    Unbudgeted Outflows Detected
                  </h4>
                  <Badge variant="amber">{formatINR(totalUnbudgeted)} total</Badge>
                </div>
                <p className="text-xs text-[var(--app-muted)] mt-1">
                  You spent {formatINR(totalUnbudgeted)} across {unbudgetedCategories.length} categories that lack a spending ceiling this month. Setting limits prevents silent budget leaks.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {unbudgetedCategories.slice(0, 3).map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => handleOpenAddModal(cat.name, Math.ceil(cat.total / 1000) * 1000 || 3000)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-amber-500/30 bg-[var(--app-card)] text-[var(--app-fg)] hover:border-amber-400 hover:bg-[var(--app-card-hover)] transition-all cursor-pointer font-mono shadow-xs"
                >
                  <span className="truncate max-w-[120px]">{cat.name}:</span>
                  <strong className="text-amber-400">{formatINR(cat.total)}</strong>
                  <span className="text-[10px] text-[var(--app-accent)] font-semibold underline ml-1">+ Set Limit</span>
                </button>
              ))}
              {unbudgetedCategories.length > 3 && (
                <button
                  type="button"
                  onClick={() => setFilterMode("WITH_SPEND")}
                  className="text-xs font-mono text-[var(--app-accent)] hover:underline cursor-pointer"
                >
                  +{unbudgetedCategories.length - 3} more...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

          {/* FILTER, SEARCH & SORT TOOLBAR */}
      <div
        className="p-3 sm:p-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] mb-6 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs"
      >
        <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--app-muted)]" />
            <input
              type="text"
              placeholder="Search category limits or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] focus:outline-none focus:border-[var(--app-accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[var(--app-muted)] hover:text-[var(--app-fg)] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end overflow-x-auto">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "ALL", label: `All (${filterCounts.total})` },
              { id: "ACTIVE", label: `Active (${filterCounts.active})` },
              { id: "OVER", label: `Over (${filterCounts.over})`, alert: filterCounts.over > 0 },
              { id: "WARNING", label: `Warning (${filterCounts.warning})` },
              { id: "ON_TRACK", label: `On Track (${filterCounts.onTrack})` },
              { id: "WITH_SPEND", label: `With Spend (${filterCounts.withSpend})` },
              { id: "UNSET", label: `Unset (${filterCounts.unset})` },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setFilterMode(mode.id as BudgetFilterMode)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  filterMode === mode.id
                    ? "border-[var(--app-accent)] bg-[var(--app-accent-subtle)] text-[var(--app-accent)] font-bold shadow-xs"
                    : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
                }`}
              >
                <span>{mode.label}</span>
                {mode.alert && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-[var(--app-border-subtle)]">
            <ArrowUpDown size={13} className="text-[var(--app-muted)]" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as BudgetSortMode)}
              className="text-xs font-mono py-1.5 px-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-fg)] focus:outline-none cursor-pointer"
            >
              <option value="RISK">Sort: Risk / Priority</option>
              <option value="PERCENT_DESC">Sort: % Used (High to Low)</option>
              <option value="SPENT_DESC">Sort: Spent (High to Low)</option>
              <option value="BUDGET_DESC">Sort: Cap (High to Low)</option>
              <option value="REMAINING_ASC">Sort: Cushion (Low to High)</option>
              <option value="NAME_ASC">Sort: Name (A to Z)</option>
            </select>
          </div>
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
                          <button
                            type="button"
                            onClick={() => setDrillDownCategory(item)}
                            className="text-[10px] font-mono text-[var(--app-muted)] hover:text-[var(--app-accent)] transition-colors cursor-pointer"
                          >
                            {item.expenseCount} {item.expenseCount === 1 ? "expense" : "expenses"}
                          </button>
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
                        onClick={() => setDrillDownCategory(item)}
                        title="View Transactions"
                        className="p-1 rounded-lg text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-subtle)] cursor-pointer"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => item.budgetItem && handleOpenEditModal(item.budgetItem)}
                        title="Edit Limit"
                        className="p-1 rounded-lg text-[var(--app-muted)] hover:text-amber-400 hover:bg-[var(--app-card-subtle)] cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => item.budgetItem && setDeleteConfirmationId(item.budgetItem.id)}
                        title="Remove Limit"
                        className="p-1 rounded-lg text-[var(--app-muted)] hover:text-rose-400 hover:bg-[var(--app-card-subtle)] cursor-pointer"
                      >
                        <Trash2 size={13} />
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
                className="rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-card)] p-5 transition-all duration-200 flex flex-col justify-between hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] shadow-xs group"
                style={{
                  borderColor: item.spentAmount > 0 ? "rgba(245, 158, 11, 0.4)" : undefined,
                }}
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
                        {item.spentAmount > 0 ? (
                          <button
                            type="button"
                            onClick={() => setDrillDownCategory(item)}
                            className="text-[10px] font-mono text-amber-400 hover:underline cursor-pointer"
                          >
                            {item.expenseCount} {item.expenseCount === 1 ? "expense" : "expenses"}
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-[var(--app-muted)] block truncate">
                            No ceiling set
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono border flex-shrink-0 ${
                        item.spentAmount > 0
                          ? "border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold"
                          : "border-[var(--app-border-subtle)] text-[var(--app-muted)]"
                      }`}
                    >
                      {item.spentAmount > 0 ? "Unbudgeted" : "Unset"}
                    </span>
                  </div>

                  <div className="my-3 font-mono">
                    <div className="flex items-baseline justify-between text-[11px] text-[var(--app-muted)]">
                      <span>{item.spentAmount > 0 ? "Realized Outflow:" : "Suggested Cap:"}</span>
                      <strong
                        className={`font-bold tabular-nums ${
                          item.spentAmount > 0 ? "text-amber-400" : "text-[var(--app-fg)]"
                        }`}
                      >
                        {formatINR(item.spentAmount > 0 ? item.spentAmount : item.meta.defaultAmount)}
                      </strong>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] mt-2" />
                  </div>
                </div>

                <div className="pt-2.5 mt-2 border-t border-[var(--app-border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--app-muted)]">
                    {item.spentAmount > 0 ? "Needs Ceiling" : "Ready to set"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAddModal(
                        item.category,
                        item.spentAmount > 0
                          ? Math.ceil(item.spentAmount / 1000) * 1000 || item.meta.defaultAmount
                          : item.meta.defaultAmount
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-bold text-[var(--app-accent)] hover:underline cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Set Budget</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )}

      {/* ============================================================ */}
      {/* 5. SECTION 2: DEDICATED BUDGET ANALYTICS                      */}
      {/* ============================================================ */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* TOP ANALYTICS HEADER & DISTRIBUTION CARD */}
          <div className="p-5 sm:p-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[var(--app-border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <PieChart size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--app-fg)]">
                    Budget Allocation & Outflows Analysis
                  </h3>
                  <p className="text-xs text-[var(--app-muted)]">
                    Visual distribution of monthly ceilings and realized expenditures for {monthDisplayTitle}
                  </p>
                </div>
              </div>

              {/* Mode Switcher: Ceilings vs Actual Spend */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setAnalyticsTab("BUDGET")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                    analyticsTab === "BUDGET"
                      ? "bg-[var(--app-accent)] text-black font-bold shadow-xs"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  Ceilings ({formatINR(totalBudgeted)})
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab("SPENT")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                    analyticsTab === "SPENT"
                      ? "bg-[var(--app-accent)] text-black font-bold shadow-xs"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  Actual Outflows ({formatINR(totalMonthExpenses)})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Donut Chart */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <InteractiveDonutChart
                  title={analyticsTab === "BUDGET" ? "Budget Distribution" : "Actual Spending Split"}
                  totalLabel={analyticsTab === "BUDGET" ? "Total Budget Cap" : "Total Outflows"}
                  totalValue={analyticsTab === "BUDGET" ? totalBudgeted : totalMonthExpenses}
                  segments={donutSegments}
                  formatter={formatINR}
                  centerColor={analyticsTab === "BUDGET" ? "#F59E0B" : "#F43F5E"}
                  size={190}
                />
                {/* Top Segments Legend Pills */}
                {donutSegments.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 max-w-sm">
                    {donutSegments.slice(0, 5).map((seg) => {
                      const total = analyticsTab === "BUDGET" ? totalBudgeted : totalMonthExpenses;
                      const pct = total > 0 ? ((seg.value / total) * 100).toFixed(0) : 0;
                      return (
                        <div
                          key={seg.label}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="text-[var(--app-fg)] truncate max-w-[90px]">{seg.label}</span>
                          <span className="text-[var(--app-muted)] font-bold">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Comparison Metrics Breakdown */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-1">Total Cap</span>
                    <span className="text-sm font-bold text-amber-400">{formatINR(totalBudgeted)}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-1">Budgeted Spend</span>
                    <span className="text-sm font-bold text-rose-400">{formatINR(totalSpentInBudgetedCategories)}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-1">Unbudgeted Spend</span>
                    <span className="text-sm font-bold text-amber-400">{formatINR(totalUnbudgeted)}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-1">Total Outflows</span>
                    <span className="text-sm font-bold text-[var(--app-fg)]">{formatINR(totalMonthExpenses)}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-1">Remaining Cushion</span>
                    <span className={`text-sm font-bold ${totalRemaining >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {totalRemaining >= 0 ? formatINR(totalRemaining) : `-${formatINR(Math.abs(totalRemaining))}`}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                    <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-1">Overrun Categories</span>
                    <span className="text-sm font-bold text-rose-400">{filterCounts.over} of {filterCounts.active}</span>
                  </div>
                </div>

                {/* Top Burned Categories */}
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--app-muted)] block mb-2 font-mono">
                    Top Active Ceilings by Utilization
                  </span>
                  <div className="space-y-2">
                    {allCategoryCards
                      .filter((c) => c.isBudgeted)
                      .sort((a, b) => b.percentUsed - a.percentUsed)
                      .slice(0, 5)
                      .map((item) => (
                        <div key={item.category} className="text-xs font-mono">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[var(--app-fg)] truncate max-w-[180px] font-semibold">{item.category}</span>
                            <span className="text-[var(--app-muted)]">
                              {formatINR(item.spentAmount)} / {formatINR(item.budgetAmount)}{" "}
                              <strong
                                className={
                                  item.isOverBudget
                                    ? "text-rose-400"
                                    : item.isWarning
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                                }
                              >
                                ({item.percentUsed.toFixed(0)}%)
                              </strong>
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, item.percentUsed)}%`,
                                backgroundColor: item.isOverBudget
                                  ? "#f43f5e"
                                  : item.isWarning
                                  ? "#F59E0B"
                                  : "#10b981",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MONTH BURN PACE & VELOCITY PROJECTION CARD */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--app-muted)]">
                  Overall Budget Burn Pace & Trajectory
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
                Projected Outflow:{" "}
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
                      ? `~${formatINR(paceMetrics.projectedDiff)} safe buffer`
                      : `~${formatINR(Math.abs(paceMetrics.projectedDiff))} overrun`})
                  </span>
                )}
              </div>
            </div>

            <div className="w-full h-2.5 rounded-full bg-[var(--app-track-bg)] overflow-hidden mb-3">
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

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--app-muted)] pt-2 border-t border-[var(--app-border-subtle)]">
              <span>Safe Daily Run-Rate: <strong className="text-emerald-400">{paceMetrics.dailyAllowance > 0 ? formatINR(paceMetrics.dailyAllowance) : "₹0"}/day</strong></span>
              <span>Month Trajectory: <strong className="text-[var(--app-fg)]">{monthDisplayTitle}</strong></span>
              <span>Active Ceilings: <strong className="text-[var(--app-fg)]">{filterCounts.active}</strong></span>
            </div>
          </div>

          {/* COMPREHENSIVE CATEGORY SPENDING & HEALTH ANALYSIS TABLE */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 sm:p-6 shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[var(--app-border-subtle)]">
              <div>
                <h4 className="text-sm font-bold text-[var(--app-fg)]">Category Utilization & Risk Breakdown</h4>
                <p className="text-xs text-[var(--app-muted)]">Complete view of budget ceilings, realized spend, and buffer variance</p>
              </div>
              <span className="text-xs font-mono text-[var(--app-muted)]">
                {allCategoryCards.filter((c) => c.isBudgeted || c.spentAmount > 0).length} tracked categories
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-[var(--app-border-subtle)] text-[var(--app-muted)] text-left uppercase text-[10px] tracking-wider">
                    <th className="pb-2.5 font-semibold">Category</th>
                    <th className="pb-2.5 font-semibold">Budget Cap</th>
                    <th className="pb-2.5 font-semibold">Actual Spend</th>
                    <th className="pb-2.5 font-semibold">Remaining Cushion</th>
                    <th className="pb-2.5 font-semibold min-w-[140px]">Utilization</th>
                    <th className="pb-2.5 font-semibold text-center">Status</th>
                    <th className="pb-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border-subtle)]">
                  {allCategoryCards
                    .filter((c) => c.isBudgeted || c.spentAmount > 0)
                    .sort((a, b) => {
                      if (a.isOverBudget && !b.isOverBudget) return -1;
                      if (!a.isOverBudget && b.isOverBudget) return 1;
                      return b.percentUsed - a.percentUsed;
                    })
                    .map((item) => {
                      const Icon = item.IconComponent;
                      return (
                        <tr
                          key={item.category}
                          className="hover:bg-[var(--app-card-hover)] transition-colors group"
                        >
                          {/* Category Name */}
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: `${item.color}15`,
                                  color: item.color,
                                }}
                              >
                                <Icon size={13} />
                              </div>
                              <span className="font-semibold text-[var(--app-fg)] truncate max-w-[140px] sm:max-w-none">
                                {item.category}
                              </span>
                            </div>
                          </td>

                          {/* Budget Cap */}
                          <td className="py-3 pr-3 tabular-nums">
                            {item.isBudgeted ? (
                              <span className="font-semibold text-[var(--app-fg)]">
                                {formatINR(item.budgetAmount)}
                              </span>
                            ) : (
                              <span className="text-[var(--app-muted)] italic">Uncapped</span>
                            )}
                          </td>

                          {/* Actual Spend */}
                          <td className="py-3 pr-3 tabular-nums font-semibold text-rose-400">
                            {formatINR(item.spentAmount)}
                          </td>

                          {/* Remaining Cushion */}
                          <td className="py-3 pr-3 tabular-nums font-semibold">
                            {item.isBudgeted ? (
                              <span className={item.remainingAmount >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                {item.remainingAmount >= 0
                                  ? formatINR(item.remainingAmount)
                                  : `-${formatINR(Math.abs(item.remainingAmount))}`}
                              </span>
                            ) : (
                              <span className="text-amber-400">Unbudgeted</span>
                            )}
                          </td>

                          {/* Utilization Bar */}
                          <td className="py-3 pr-3">
                            {item.isBudgeted ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span
                                    className={
                                      item.isOverBudget
                                        ? "text-rose-400 font-bold"
                                        : item.isWarning
                                        ? "text-amber-400 font-bold"
                                        : "text-[var(--app-muted)]"
                                    }
                                  >
                                    {item.percentUsed.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, item.percentUsed)}%`,
                                      backgroundColor: item.isOverBudget
                                        ? "#f43f5e"
                                        : item.isWarning
                                        ? "#F59E0B"
                                        : "#10b981",
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--app-muted)]">—</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 pr-3 text-center">
                            {item.isOverBudget ? (
                              <Badge variant="danger">Overrun</Badge>
                            ) : item.isWarning ? (
                              <Badge variant="warning">Warning</Badge>
                            ) : item.isBudgeted ? (
                              <Badge variant="success">On Track</Badge>
                            ) : (
                              <Badge variant="amber">Unbudgeted</Badge>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.expenseCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setDrillDownCategory(item)}
                                  className="px-2 py-1 rounded-md text-[10px] font-semibold border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:border-[var(--app-border)] transition-all cursor-pointer flex items-center gap-1"
                                  title="Inspect individual transaction outflows"
                                >
                                  <Eye size={11} />
                                  <span>View ({item.expenseCount})</span>
                                </button>
                              )}
                              {!item.isBudgeted && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenAddModal(
                                      item.category,
                                      Math.ceil(item.spentAmount / 1000) * 1000 || item.meta.defaultAmount
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-[10px] font-semibold bg-[var(--app-accent)] text-black hover:opacity-90 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Plus size={11} />
                                  <span>Set Limit</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* UNBUDGETED OUTFLOWS LEAKS CARD IN ANALYTICS */}
          {totalUnbudgeted > 0 && (
            <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[var(--app-fg)]">
                        Unbudgeted Spending Leaks ({formatINR(totalUnbudgeted)})
                      </h4>
                      <Badge variant="amber">{unbudgetedCategories.length} categories uncapped</Badge>
                    </div>
                    <p className="text-xs text-[var(--app-muted)] mt-1">
                      These categories incurred spending during {monthDisplayTitle} without a defined limit. Adding ceilings prevents cash leaks.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {unbudgetedCategories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => handleOpenAddModal(cat.name, Math.ceil(cat.total / 1000) * 1000 || 3000)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-amber-500/30 bg-[var(--app-card)] text-[var(--app-fg)] hover:border-amber-400 hover:bg-[var(--app-card-hover)] transition-all cursor-pointer font-mono shadow-xs"
                    >
                      <span className="truncate max-w-[120px]">{cat.name}:</span>
                      <strong className="text-amber-400">{formatINR(cat.total)}</strong>
                      <span className="text-[10px] text-[var(--app-accent)] font-semibold underline ml-1">+ Set Limit</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT BUDGET */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBudget ? "Edit Category Budget" : "Set Category Budget"}
        description={`Period: ${monthDisplayTitle}`}
        size="md"
      >
        <form onSubmit={handleSubmitBudget} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Category"
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
                <option value="custom">+ Custom Category...</option>
              </Select>

              {isCustomCategory && (
                <div className="mt-1.5">
                  <Input
                    placeholder="Enter category name"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <Input
                label="Budget Limit (₹ INR) *"
                type="number"
                step="1"
                min="1"
                placeholder="e.g. 10000"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                required
                leftIcon={<span className="font-mono text-xs font-bold">₹</span>}
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[var(--app-fg)]">
                Alert Notification Threshold
              </span>
              <span className="font-mono font-bold text-amber-400">
                {formThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={formThreshold}
              onChange={(e) => setFormThreshold(e.target.value)}
              className="w-full accent-amber-400 cursor-pointer h-1.5"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border-subtle)]">
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
              {editingBudget ? "Save Changes" : "Set Budget"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: COPY FROM PREVIOUS MONTH */}
      <Modal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        title={`Copy Budgets from ${formatMonthDisplay(precedingMonth)}`}
        description={`Roll forward your active spending ceilings into ${monthDisplayTitle}.`}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] text-xs font-mono space-y-1.5">
            <div className="flex justify-between text-[var(--app-muted)]">
              <span>Found in {formatMonthDisplay(precedingMonth)}:</span>
              <strong className="text-[var(--app-fg)]">{precedingMonthBudgets.length} budgets</strong>
            </div>
            <div className="flex justify-between text-[var(--app-muted)]">
              <span>Already configured in {monthDisplayTitle}:</span>
              <strong className="text-emerald-400">{rolloverPreview.skippedCount} (will skip)</strong>
            </div>
            <div className="flex justify-between text-[var(--app-muted)] pt-1 border-t border-[var(--app-border-subtle)]">
              <span className="font-bold text-[var(--app-fg)]">New budgets to create:</span>
              <strong className="text-amber-400 font-bold">{rolloverPreview.toInsert.length} ({formatINR(rolloverPreview.totalAmount)})</strong>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {precedingMonthBudgets.map((b) => {
              const alreadyExists = currentMonthBudgets.some(
                (c) => c.category.toLowerCase() === b.category.toLowerCase()
              );
              const meta = getCategoryMetadata(b.category);
              const Icon = meta.icon;

              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-[var(--app-border-subtle)] text-xs font-mono"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                    >
                      <Icon size={12} />
                    </div>
                    <span className="text-[var(--app-fg)] truncate">{b.category}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[var(--app-fg)] font-bold">{formatINR(b.amount)}</span>
                    {alreadyExists ? (
                      <Badge variant="neutral">Already Set</Badge>
                    ) : (
                      <Badge variant="success">Will Copy</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCopyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={submittingCopy}
              disabled={rolloverPreview.toInsert.length === 0}
              onClick={handleConfirmCopyBudgets}
              icon={<Copy size={13} />}
            >
              Copy {rolloverPreview.toInsert.length} Budgets
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: CATEGORY EXPENSE DRILL-DOWN */}
      <Modal
        isOpen={!!drillDownCategory}
        onClose={() => {
          setDrillDownCategory(null);
          setDrillDownSearch("");
        }}
        title={drillDownCategory ? `${drillDownCategory.category} Outflows` : "Category Outflows"}
        description={`Transaction ledger for ${monthDisplayTitle}`}
        size="lg"
      >
        {drillDownCategory && (
          <div className="space-y-4">
            {/* Header Telemetry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="p-2.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-0.5">Total Spent</span>
                <span className="text-sm font-bold text-rose-400">{formatINR(drillDownCategory.spentAmount)}</span>
              </div>
              <div className="p-2.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-0.5">Allocated Cap</span>
                <span className="text-sm font-bold text-amber-400">
                  {drillDownCategory.isBudgeted ? formatINR(drillDownCategory.budgetAmount) : "Uncapped"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-0.5">Cushion</span>
                <span
                  className={`text-sm font-bold ${
                    drillDownCategory.isOverBudget
                      ? "text-rose-400"
                      : drillDownCategory.isBudgeted
                      ? "text-emerald-400"
                      : "text-[var(--app-muted)]"
                  }`}
                >
                  {drillDownCategory.isBudgeted
                    ? drillDownCategory.isOverBudget
                      ? `Over +${formatINR(Math.abs(drillDownCategory.remainingAmount))}`
                      : `${formatINR(drillDownCategory.remainingAmount)} left`
                    : "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                <span className="text-[10px] uppercase text-[var(--app-muted)] block mb-0.5">Transactions</span>
                <span className="text-sm font-bold text-[var(--app-fg)]">{drillDownCategory.expenseCount} logged</span>
              </div>
            </div>

            {/* Transaction Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-[var(--app-muted)]" />
              <input
                type="text"
                placeholder="Search transaction titles or tags..."
                value={drillDownSearch}
                onChange={(e) => setDrillDownSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] focus:outline-none"
              />
            </div>

            {/* Transaction Rows List */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {drillDownFilteredExpenses.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--app-muted)] font-mono">
                  {drillDownSearch
                    ? "No transactions match your search filter."
                    : "No transactions recorded in this category for this month."}
                </div>
              ) : (
                drillDownFilteredExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card)] flex items-center justify-between gap-3 text-xs font-mono hover:border-[var(--app-border)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--app-fg)] truncate">{exp.title}</span>
                        {exp.tags && exp.tags.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1">
                            {exp.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.2 rounded text-[9px] bg-[var(--app-card-subtle)] text-[var(--app-muted)] border border-[var(--app-border-subtle)]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--app-muted)] mt-0.5 flex items-center gap-2">
                        <span>{exp.expense_date}</span>
                        {exp.notes && <span className="truncate max-w-[200px]">· {exp.notes}</span>}
                      </div>
                    </div>

                    <div className="font-bold text-sm text-rose-400 tabular-nums shrink-0">
                      -{formatINR(exp.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--app-border-subtle)]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDrillDownCategory(null);
                  setDrillDownSearch("");
                }}
              >
                Close
              </Button>

              {drillDownCategory.isBudgeted ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Pencil size={13} />}
                  onClick={() => {
                    const b = drillDownCategory.budgetItem;
                    setDrillDownCategory(null);
                    if (b) handleOpenEditModal(b);
                  }}
                >
                  Edit Budget Cap
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => {
                    const cat = drillDownCategory.category;
                    const amt = Math.ceil(drillDownCategory.spentAmount / 1000) * 1000 || 3000;
                    setDrillDownCategory(null);
                    handleOpenAddModal(cat, amt);
                  }}
                >
                  Set Budget Cap
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4: DELETE CONFIRMATION */}
      <Modal
        isOpen={!!deleteConfirmationId}
        onClose={() => setDeleteConfirmationId(null)}
        title="Remove Budget Ceiling?"
        description="Are you sure you want to remove this category ceiling? Transaction records remain completely untouched."
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
