"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Target,
  Plus,
  Trash2,
  Loader2,
  X,
  Search,
  Download,
  Pencil,
  LayoutGrid,
  List,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  ShieldCheck,
  Zap,
  Copy,
  SlidersHorizontal,
  Home,
  Utensils,
  ShoppingCart,
  Car,
  ShoppingBag,
  HeartPulse,
  Film,
  Plane,
  Layers,
  CreditCard,
  GraduationCap,
  Users,
  Gift,
  TrendingUp,
  Wrench,
  CircleDollarSign,
  Laptop,
  Dumbbell,
  Receipt,
  BookOpen,
  Activity,
  Heart,
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
  { name: "Travel & Vacations", color: "#6366F1", icon: Plane, defaultAmount: 8000 },
  { name: "Subscriptions & SaaS", color: "#14B8A6", icon: Layers, defaultAmount: 1500 },
  { name: "Debt & Loan EMI", color: "#E11D48", icon: CreditCard, defaultAmount: 15000 },
  { name: "Insurance & Protection", color: "#0284C7", icon: ShieldCheck, defaultAmount: 3500 },
  { name: "Education & Learning", color: "#D97706", icon: GraduationCap, defaultAmount: 4000 },
  { name: "Personal Care & Grooming", color: "#F472B6", icon: Sparkles, defaultAmount: 2000 },
  { name: "Beauty & Skincare", color: "#FB7185", icon: Sparkles, defaultAmount: 2000 },
  { name: "Family & Child Care", color: "#FB923C", icon: Users, defaultAmount: 6000 },
  { name: "Gifts & Celebrations", color: "#FACC15", icon: Gift, defaultAmount: 3000 },
  { name: "Investments & Wealth", color: "#059669", icon: TrendingUp, defaultAmount: 15000 },
  { name: "Taxes & Professional Fees", color: "#64748B", icon: Receipt, defaultAmount: 5000 },
  { name: "Home & Maintenance", color: "#78716C", icon: Wrench, defaultAmount: 3000 },
  { name: "Pet Care & Vet", color: "#E879F9", icon: Heart, defaultAmount: 2500 },
  { name: "Emergency Reserve", color: "#22C55E", icon: ShieldCheck, defaultAmount: 5000 },
  { name: "Charity & Community", color: "#EF4444", icon: Heart, defaultAmount: 1500 },
  { name: "Books & Courses", color: "#F59E0B", icon: BookOpen, defaultAmount: 1500 },
  { name: "Hobbies & Creative", color: "#8B5CF6", icon: Activity, defaultAmount: 2000 },
  { name: "Office & Coworking", color: "#64748B", icon: Laptop, defaultAmount: 3000 },
  { name: "Alcohol & Nightlife", color: "#F43F5E", icon: Utensils, defaultAmount: 3500 },
  { name: "Other & Contingency", color: "#71717A", icon: CircleDollarSign, defaultAmount: 2500 },
];

export const CATEGORY_MAP: Record<string, CategoryMeta> = BUDGET_CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.name] = cat;
    return acc;
  },
  {} as Record<string, CategoryMeta>
);

export const CATEGORY_COLORS: Record<string, string> = BUDGET_CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.name] = cat.color;
    return acc;
  },
  {} as Record<string, string>
);

interface PresetPackage {
  name: string;
  description: string;
  budgets: { category: string; amount: number }[];
}

const PRESET_PACKAGES: PresetPackage[] = [
  {
    name: "Essential Blueprint",
    description: "Covers everyday essentials: groceries, rent, utilities, fuel, medical & savings",
    budgets: [
      { category: "Housing & Rent", amount: 20000 },
      { category: "Groceries & Essentials", amount: 10000 },
      { category: "Food & Dining", amount: 5000 },
      { category: "Utilities & Bills", amount: 4500 },
      { category: "Transport & Fuel", amount: 4500 },
      { category: "Health & Medical", amount: 3000 },
      { category: "Subscriptions & SaaS", amount: 1500 },
      { category: "Investments & Wealth", amount: 15000 },
    ],
  },
  {
    name: "Urban Living & Leisure",
    description: "Designed for modern lifestyle with dining, gadgets, travel & fitness",
    budgets: [
      { category: "Housing & Rent", amount: 28000 },
      { category: "Groceries & Essentials", amount: 12000 },
      { category: "Food & Dining", amount: 10000 },
      { category: "Shopping & Lifestyle", amount: 8000 },
      { category: "Electronics & Gadgets", amount: 6000 },
      { category: "Fitness & Sports", amount: 3000 },
      { category: "Entertainment & OTT", amount: 3000 },
      { category: "Travel & Vacations", amount: 10000 },
      { category: "Investments & Wealth", amount: 20000 },
    ],
  },
  {
    name: "Family & Home Builder",
    description: "Comprehensive home package with child care, maintenance, vehicle, insurance & EMIs",
    budgets: [
      { category: "Housing & Rent", amount: 25000 },
      { category: "Groceries & Essentials", amount: 14000 },
      { category: "Utilities & Bills", amount: 6000 },
      { category: "Debt & Loan EMI", amount: 18000 },
      { category: "Insurance & Protection", amount: 4500 },
      { category: "Family & Child Care", amount: 10000 },
      { category: "Vehicle & Servicing", amount: 4000 },
      { category: "Home & Maintenance", amount: 4000 },
      { category: "Emergency Reserve", amount: 5000 },
    ],
  },
];

export default function BudgetsSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Active month in YYYY-MM format with strict boundary constraints
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => getCurrentMonthYear());

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

  // Filters
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "ACTIVE" | "UNSET">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ON_TRACK" | "WARNING" | "OVER">("ALL");
  const [sortBy, setSortBy] = useState<"highest_budget" | "highest_spent" | "highest_ratio" | "category">("highest_budget");

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Form states
  const [formCategory, setFormCategory] = useState("Food & Dining");
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

  // Compute earliest month that actually has budget or expense data
  const earliestMonthYear = useMemo(() => {
    const dates = [
      ...budgets.map((b) => b.month_year),
      ...expenses.map((e) => e.expense_date),
    ];
    return getEarliestDataMonth(dates, currentMonthYear);
  }, [budgets, expenses, currentMonthYear]);

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
        setErrorMsg("Unable to retrieve budget records from database.");
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

        // Update Multi-Tier Cache
        saveToCache(redisBudgetsKey, mapped, 3600);
      }
    } catch {
      setErrorMsg("Failed to connect to database for budgets.");
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
        .select("id, title, amount, category, expense_date")
        .eq("user_id", user.id);

      if (!error && data) {
        setExpenses(
          data.map((e) => ({
            id: e.id,
            title: e.title,
            amount: Number(e.amount) || 0,
            category: e.category,
            expense_date: e.expense_date,
          }))
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

  // Build the complete list of ALL category cards (both with active limits AND available to budget)
  const allCategoryCards = useMemo(() => {
    const budgetMap = new Map<string, BudgetItem>();
    currentMonthBudgets.forEach((b) => {
      budgetMap.set(b.category.toLowerCase(), b);
    });

    // Start with all standard predefined categories
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

    // Also include any custom categories that have a budget set for this month
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

  // Counters
  const activeBudgetsCount = useMemo(() => {
    return allCategoryCards.filter((c) => c.isBudgeted).length;
  }, [allCategoryCards]);

  const unbudgetedCount = useMemo(() => {
    return allCategoryCards.filter((c) => !c.isBudgeted).length;
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

  // Filtered & Sorted Cards
  const displayedCards = useMemo(() => {
    return allCategoryCards
      .filter((item) => {
        // Mode filter: ALL vs ACTIVE vs UNSET
        if (filterMode === "ACTIVE" && !item.isBudgeted) return false;
        if (filterMode === "UNSET" && item.isBudgeted) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCategory = item.category.toLowerCase().includes(q);
          const matchNotes = item.budgetItem?.notes?.toLowerCase().includes(q);
          if (!matchCategory && !matchNotes) return false;
        }

        // Status filter (only applies to budgeted items)
        if (statusFilter !== "ALL") {
          if (!item.isBudgeted) return false;
          if (statusFilter === "ON_TRACK" && (item.isOverBudget || item.isWarning)) return false;
          if (statusFilter === "WARNING" && (!item.isWarning || item.isOverBudget)) return false;
          if (statusFilter === "OVER" && !item.isOverBudget) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Prioritize active budgets first in ALL view unless sorting alphabetically
        if (filterMode === "ALL" && sortBy !== "category") {
          if (a.isBudgeted && !b.isBudgeted) return -1;
          if (!a.isBudgeted && b.isBudgeted) return 1;
        }

        if (sortBy === "highest_budget") return b.budgetAmount - a.budgetAmount;
        if (sortBy === "highest_spent") return b.spentAmount - a.spentAmount;
        if (sortBy === "highest_ratio") return b.percentUsed - a.percentUsed;
        if (sortBy === "category") return a.category.localeCompare(b.category);
        return 0;
      });
  }, [allCategoryCards, filterMode, searchQuery, statusFilter, sortBy]);

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

  // Apply Preset Package
  const handleApplyPreset = async (preset: PresetPackage) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const supabase = createClient();

      const inserts = preset.budgets.map((b) => ({
        user_id: user.id,
        category: b.category,
        amount: b.amount,
        period: "monthly",
        month_year: selectedMonthYear,
        alert_threshold: 80,
        notes: `Blueprint: ${preset.name}`,
      }));

      await supabase
        .from("budgets")
        .delete()
        .eq("month_year", selectedMonthYear)
        .eq("user_id", user.id);

      const { error } = await supabase.from("budgets").insert(inserts);
      if (error) throw error;

      showToast("Blueprint Applied", `Applied ${preset.name} (${preset.budgets.length} categories)`, "success");
      setIsPresetsOpen(false);
      await invalidateCacheKeys([redisBudgetsKey, "arthax:cache:budgets"]);
      await fetchBudgets(true);
    } catch {
      showToast("Error", "Could not apply preset budget package.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Clone from Previous Month
  const handleCopyPreviousMonth = async () => {
    if (!user) return;
    const [yearStr, monthStr] = selectedMonthYear.split("-");
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    const prevMonthYear = `${year}-${String(month + 1).padStart(2, "0")}`;

    const prevBudgets = budgets.filter((b) => b.month_year === prevMonthYear);
    if (prevBudgets.length === 0) {
      showToast("No Records", `No budgets found in previous month (${prevMonthYear}) to copy.`, "info");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const inserts = prevBudgets.map((b) => ({
        user_id: user.id,
        category: b.category,
        amount: b.amount,
        period: b.period,
        month_year: selectedMonthYear,
        alert_threshold: b.alert_threshold,
        notes: b.notes ? `Copied from ${prevMonthYear}` : null,
      }));

      await supabase
        .from("budgets")
        .delete()
        .eq("month_year", selectedMonthYear)
        .eq("user_id", user.id);

      const { error } = await supabase.from("budgets").insert(inserts);
      if (error) throw error;

      showToast("Budgets Cloned", `Cloned ${prevBudgets.length} category budgets from ${prevMonthYear}`, "success");
      await invalidateCacheKeys([redisBudgetsKey, "arthax:cache:budgets"]);
      await fetchBudgets(true);
    } catch {
      showToast("Copy Failed", "Could not clone budgets from previous month.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (currentMonthBudgets.length === 0) {
      showToast("No Data", "There are no budgets configured for this month to export.", "info");
      return;
    }

    const headers = [
      "Category",
      "Month",
      "Budget Limit (INR)",
      "Actual Spent (INR)",
      "Remaining (INR)",
      "Utilization (%)",
      "Status",
      "Notes",
    ];

    const rows = allCategoryCards
      .filter((c) => c.isBudgeted)
      .map((item) => {
        let status = "On Track";
        if (item.isOverBudget) status = "Over Budget";
        else if (item.isWarning) status = "Near Limit";

        return [
          `"${item.category}"`,
          `"${selectedMonthYear}"`,
          item.budgetAmount.toFixed(2),
          item.spentAmount.toFixed(2),
          item.remainingAmount.toFixed(2),
          item.percentUsed.toFixed(1) + "%",
          `"${status}"`,
          `"${(item.budgetItem?.notes || "").replace(/"/g, '""')}"`,
        ];
      });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `arthaX_budgets_${selectedMonthYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Export Ready", `Budget audit report for ${selectedMonthYear} exported.`, "success");
  };

  return (
    <main
      className="flex-1 h-screen overflow-y-auto px-4 sm:px-8 py-6 transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* 1. TOP HEADER & MONTH CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 mb-6 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
            <span
              className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border opacity-75"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-card)" }}
            >
              {activeBudgetsCount} Active / {allCategoryCards.length} Categories
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
          <p className="text-xs opacity-60 mt-1">
            Choose any category card to set or adjust its monthly spending limit.
          </p>
        </div>

        {/* Controls Suite */}
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
              title={!canGoPrev ? "No earlier budget or expense records" : "Previous Month"}
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

          {/* Smart Presets */}
          <button
            onClick={() => setIsPresetsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer opacity-80 hover:opacity-100"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
            title="Auto-generate budgets using tested blueprints"
          >
            <Sparkles size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Blueprints</span>
          </button>

          {/* Clone Past Month */}
          <button
            onClick={handleCopyPreviousMonth}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer opacity-80 hover:opacity-100 disabled:opacity-40"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
            title="Clone budgets from previous month"
          >
            <Copy size={13} />
            <span className="hidden md:inline">Clone Past</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="p-2 text-xs rounded-xl border transition-all cursor-pointer opacity-80 hover:opacity-100"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
            title="Export CSV audit"
          >
            <Download size={13} />
          </button>

          {/* Custom Budget Modal Button */}
          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: "var(--app-fg)",
              color: "var(--app-bg)",
            }}
          >
            <Plus size={14} />
            <span>Custom Category</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          className="mb-6 p-3.5 rounded-xl text-xs border flex items-center justify-between"
          style={{
            borderColor: "rgba(244, 63, 94, 0.4)",
            backgroundColor: "var(--app-card)",
            color: "#F43F5E",
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => fetchBudgets()} className="font-mono underline opacity-80 hover:opacity-100">
            Retry
          </button>
        </div>
      )}

      {/* 2. SEPARATE KPI TELEMETRY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Card 1: Allocated Cap */}
        <div
          className="rounded-2xl p-5 space-y-2 border shadow-sm transition-all"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">
              Allocated Cap
            </span>
            <Target size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight">
            {loading ? "..." : formatINR(totalBudgeted)}
          </div>
          <p className="text-[11px] opacity-50 font-mono">
            {activeBudgetsCount} categories budgeted for {monthDisplayTitle}
          </p>
        </div>

        {/* Card 2: Total Spent */}
        <div
          className="rounded-2xl p-5 space-y-2 border shadow-sm transition-all"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">
              Total Spent
            </span>
            <TrendingDown size={15} className="text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-rose-400">
            {loading ? "..." : formatINR(totalSpentInBudgetedCategories)}
          </div>
          <p className="text-[11px] opacity-50 font-mono">
            {overallPercentUsed.toFixed(1)}% burned of cap
          </p>
        </div>

        {/* Card 3: Safe Balance */}
        <div
          className="rounded-2xl p-5 space-y-2 border shadow-sm transition-all"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">
              {totalRemaining >= 0 ? "Safe Balance" : "Budget Exceeded"}
            </span>
            <ShieldCheck
              size={15}
              className={totalRemaining >= 0 ? "text-emerald-400" : "text-rose-400"}
            />
          </div>
          <div
            className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight"
            style={{ color: totalRemaining >= 0 ? "#10B981" : "#F43F5E" }}
          >
            {loading
              ? "..."
              : totalRemaining >= 0
              ? formatINR(totalRemaining)
              : `-${formatINR(Math.abs(totalRemaining))}`}
          </div>
          <p className="text-[11px] opacity-50 font-mono">
            {totalRemaining >= 0 ? "Safe buffer remaining" : "Exceeded spending limits"}
          </p>
        </div>

        {/* Card 4: Daily Safe Burn */}
        <div
          className="rounded-2xl p-5 space-y-2 border shadow-sm transition-all"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">
              Daily Safe Burn
            </span>
            <Zap size={15} className="text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-emerald-400">
            {paceMetrics.dailyAllowance > 0 ? formatINR(paceMetrics.dailyAllowance) : "₹0"}
            <span className="text-xs font-normal opacity-60"> /day</span>
          </div>
          <p className="text-[11px] opacity-50 font-mono">
            {paceMetrics.daysLeft} days left in month
          </p>
        </div>
      </div>

      {/* SEPARATE CARD: MONTH BURN PACE PROGRESS */}
      <div
        className="rounded-2xl border p-4 sm:p-5 mb-6 transition-all shadow-sm"
        style={{
          backgroundColor: "var(--app-card)",
          borderColor: "var(--app-border-subtle)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-60">
              Month Burn Pace
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
              style={{
                borderColor: `${
                  overallPercentUsed > 100
                    ? "#F43F5E"
                    : overallPercentUsed > 80
                    ? "#F59E0B"
                    : "#10B981"
                }40`,
                color:
                  overallPercentUsed > 100
                    ? "#F43F5E"
                    : overallPercentUsed > 80
                    ? "#F59E0B"
                    : "#10B981",
              }}
            >
              {overallPercentUsed.toFixed(1)}% burned
            </span>
          </div>

          <div className="text-[11px] opacity-70">
            Projected Spend:{" "}
            <strong className="font-bold font-mono text-white">
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
                  ? `~${formatINR(paceMetrics.projectedDiff)} under`
                  : `~${formatINR(Math.abs(paceMetrics.projectedDiff))} over`})
              </span>
            )}
          </div>
        </div>

        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, overallPercentUsed)}%`,
              backgroundColor:
                overallPercentUsed > 100
                  ? "#F43F5E"
                  : overallPercentUsed > 80
                  ? "#F59E0B"
                  : "#10B981",
            }}
          />
        </div>
      </div>

      {/* 3. INTERACTIVE CATEGORY CARDS TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Card Filter Modes: All Cards / Active Limits / Available to Set */}
        <div
          className="flex items-center rounded-xl border p-1 text-xs font-medium"
          style={{
            borderColor: "var(--app-border-subtle)",
            backgroundColor: "var(--app-card)",
          }}
        >
          <button
            onClick={() => setFilterMode("ALL")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterMode === "ALL" ? "shadow-sm font-semibold" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: filterMode === "ALL" ? "var(--app-fg)" : "transparent",
              color: filterMode === "ALL" ? "var(--app-bg)" : "var(--app-fg)",
            }}
          >
            <span>All Cards</span>
            <span className="text-[10px] font-mono opacity-70">
              ({allCategoryCards.length})
            </span>
          </button>

          <button
            onClick={() => setFilterMode("ACTIVE")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterMode === "ACTIVE" ? "shadow-sm font-semibold" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: filterMode === "ACTIVE" ? "var(--app-fg)" : "transparent",
              color: filterMode === "ACTIVE" ? "var(--app-bg)" : "var(--app-fg)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Active Limits</span>
            <span className="text-[10px] font-mono opacity-70">
              ({activeBudgetsCount})
            </span>
          </button>

          <button
            onClick={() => setFilterMode("UNSET")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterMode === "UNSET" ? "shadow-sm font-semibold" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: filterMode === "UNSET" ? "var(--app-fg)" : "transparent",
              color: filterMode === "UNSET" ? "var(--app-bg)" : "var(--app-fg)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Available to Set</span>
            <span className="text-[10px] font-mono opacity-70">
              ({unbudgetedCount})
            </span>
          </button>
        </div>

        {/* Search, Status & View Mode */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors w-36 sm:w-48"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border-subtle)",
                color: "var(--app-fg)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Filter (Only relevant for active budgets) */}
          {filterMode !== "UNSET" && (
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-2.5 py-1.5 text-xs rounded-xl border font-mono appearance-none pr-7 cursor-pointer focus:outline-none"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                  color: "var(--app-fg)",
                }}
              >
                <option value="ALL">Status: All</option>
                <option value="ON_TRACK">On Track</option>
                <option value="WARNING">Near Limit</option>
                <option value="OVER">Over Limit</option>
              </select>
              <SlidersHorizontal size={11} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-2.5 py-1.5 text-xs rounded-xl border font-mono appearance-none pr-7 cursor-pointer focus:outline-none"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
                color: "var(--app-fg)",
              }}
            >
              <option value="highest_budget">Highest Cap</option>
              <option value="highest_spent">Highest Outflow</option>
              <option value="highest_ratio">Burn Ratio %</option>
              <option value="category">Category A-Z</option>
            </select>
            <SlidersHorizontal size={11} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
          </div>

          {/* View Mode Toggle */}
          <div
            className="flex items-center rounded-xl border p-0.5"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
          >
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid" ? "shadow-sm" : "opacity-40 hover:opacity-100"
              }`}
              style={{
                backgroundColor: viewMode === "grid" ? "var(--app-fg)" : "transparent",
                color: viewMode === "grid" ? "var(--app-bg)" : "var(--app-fg)",
              }}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table" ? "shadow-sm" : "opacity-40 hover:opacity-100"
              }`}
              style={{
                backgroundColor: viewMode === "table" ? "var(--app-fg)" : "transparent",
                color: viewMode === "table" ? "var(--app-bg)" : "var(--app-fg)",
              }}
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. CARDS GRID & INTERACTIVE SELECTION */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50 gap-2">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-xs font-mono">Loading categories & budgets...</span>
        </div>
      ) : displayedCards.length === 0 ? (
        <div
          className="rounded-2xl border p-12 text-center space-y-3"
          style={{
            borderColor: "var(--app-border-subtle)",
            backgroundColor: "var(--app-card)",
          }}
        >
          <div className="w-10 h-10 mx-auto rounded-xl border flex items-center justify-center opacity-50">
            <Target size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold">No Categories Match Filters</h3>
            <p className="text-xs opacity-50 mt-1 max-w-sm mx-auto">
              Try adjusting your search query or reset the filter mode to view all available category cards.
            </p>
          </div>
          <button
            onClick={() => {
              setFilterMode("ALL");
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border opacity-80 hover:opacity-100"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID OF CHOOSEABLE CATEGORY CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedCards.map((item) => {
            const Icon = item.IconComponent;
            const progress = Math.min(100, item.percentUsed);
            const statusColor = item.isOverBudget
              ? "#F43F5E"
              : item.isWarning
              ? "#F59E0B"
              : "#10B981";

            // If budget is ALREADY ACTIVE
            if (item.isBudgeted) {
              return (
                <div
                  key={item.category}
                  className="rounded-2xl border p-4.5 transition-all duration-200 flex flex-col justify-between hover:border-white/40 shadow-sm group relative"
                  style={{
                    backgroundColor: "var(--app-card)",
                    borderColor: item.isOverBudget
                      ? "rgba(244, 63, 94, 0.4)"
                      : item.isWarning
                      ? "rgba(245, 158, 11, 0.3)"
                      : "var(--app-border-subtle)",
                  }}
                >
                  <div>
                    {/* Card Top: Icon, Category Name, Active Status Badge */}
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
                          <h4 className="text-xs font-bold tracking-tight truncate">{item.category}</h4>
                          <span className="text-[10px] font-mono opacity-50 block truncate">
                            {item.expenseCount} {item.expenseCount === 1 ? "expense" : "expenses"} logged
                          </span>
                        </div>
                      </div>

                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex-shrink-0"
                        style={{
                          borderColor: `${statusColor}40`,
                          color: statusColor,
                          backgroundColor: `${statusColor}08`,
                        }}
                      >
                        {item.percentUsed.toFixed(0)}%
                      </span>
                    </div>

                    {/* Financial Figures: Spent vs Cap */}
                    <div className="my-3 font-mono">
                      <div className="flex items-baseline justify-between">
                        <span
                          className="text-lg font-extrabold tracking-tight"
                          style={{ color: item.isOverBudget ? "#F43F5E" : "var(--app-fg)" }}
                        >
                          {formatINR(item.spentAmount)}
                        </span>
                        <span className="text-xs opacity-50 font-normal">
                          of {formatINR(item.budgetAmount)}
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden mt-2"
                        style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: statusColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Safe left / Exceeded & Edit / Delete */}
                  <div
                    className="pt-2.5 mt-2 border-t flex items-center justify-between text-[11px] font-mono"
                    style={{ borderColor: "var(--app-border-subtle)" }}
                  >
                    <span
                      className="font-medium truncate"
                      style={{ color: item.isOverBudget ? "#F43F5E" : "#10B981" }}
                    >
                      {item.isOverBudget
                        ? `Exceeded +${formatINR(Math.abs(item.remainingAmount))}`
                        : `${formatINR(item.remainingAmount)} left`}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => item.budgetItem && handleOpenEditModal(item.budgetItem)}
                        title="Edit Limit"
                        className="p-1 rounded opacity-70 hover:opacity-100 hover:text-amber-400 cursor-pointer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => item.budgetItem && setDeleteConfirmationId(item.budgetItem.id)}
                        title="Remove Limit"
                        className="p-1 rounded opacity-70 hover:opacity-100 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // If budget is NOT SET YET (Available card ready to choose and set!)
            return (
              <div
                key={item.category}
                onClick={() => handleOpenAddModal(item.category, item.meta.defaultAmount)}
                className="rounded-2xl border p-4.5 transition-all duration-200 flex flex-col justify-between hover:border-white/40 shadow-sm group cursor-pointer"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border-subtle)",
                }}
              >
                <div>
                  {/* Top: Icon, Category Name, Available Badge */}
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
                        <h4 className="text-xs font-bold tracking-tight truncate group-hover:text-amber-400 transition-colors">
                          {item.category}
                        </h4>
                        <span className="text-[10px] font-mono opacity-50 block truncate">
                          {item.spentAmount > 0
                            ? `${formatINR(item.spentAmount)} spent this month`
                            : "No ceiling set"}
                        </span>
                      </div>
                    </div>

                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono border opacity-50 flex-shrink-0"
                      style={{ borderColor: "var(--app-border-subtle)" }}
                    >
                      Unset
                    </span>
                  </div>

                  {/* Middle preview */}
                  <div className="my-3 font-mono">
                    <div className="flex items-baseline justify-between text-[11px] opacity-60">
                      <span>Suggested Cap:</span>
                      <strong className="font-bold font-mono opacity-90">{formatINR(item.meta.defaultAmount)}</strong>
                    </div>

                    {/* Unset indicator track */}
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden mt-2"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    />
                  </div>
                </div>

                {/* Card Bottom: 1-Click Set Action */}
                <div
                  className="pt-2.5 mt-2 border-t flex items-center justify-between"
                  style={{ borderColor: "var(--app-border-subtle)" }}
                >
                  <span className="text-[10px] font-mono opacity-40">Ready to activate</span>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded-lg transition-all group-hover:scale-105 shadow-sm"
                    style={{
                      backgroundColor: "var(--app-fg)",
                      color: "var(--app-bg)",
                    }}
                  >
                    <Plus size={11} />
                    <span>Set Budget</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE / LEDGER VIEW */
        <div
          className="rounded-2xl border overflow-hidden shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border-subtle)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr
                  className="border-b font-mono uppercase tracking-wider text-[11px] opacity-50"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Budget Limit</th>
                  <th className="py-3 px-4 text-right">Actual Spent</th>
                  <th className="py-3 px-4 text-right">Safe Remaining</th>
                  <th className="py-3 px-4">Burn Progress</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--app-border-subtle)" }}>
                {displayedCards.map((item) => {
                  const progress = Math.min(100, item.percentUsed);
                  const statusColor = item.isOverBudget
                    ? "#F43F5E"
                    : item.isWarning
                    ? "#F59E0B"
                    : "#10B981";

                  const Icon = item.IconComponent;

                  return (
                    <tr
                      key={item.category}
                      className="hover:opacity-90 transition-colors"
                      style={{ borderColor: "var(--app-border-subtle)" }}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: `${item.color}15`,
                              color: item.color,
                            }}
                          >
                            <Icon size={13} />
                          </div>
                          <span className="font-semibold">{item.category}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-right">
                        {item.isBudgeted ? formatINR(item.budgetAmount) : (
                          <span className="opacity-40 text-[11px] font-normal">Unset</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 font-mono font-bold text-right"
                        style={{ color: item.isOverBudget ? "#F43F5E" : "var(--app-fg)" }}
                      >
                        {formatINR(item.spentAmount)}
                      </td>
                      <td
                        className="py-3 px-4 font-mono font-bold text-right"
                        style={{ color: item.isOverBudget ? "#F43F5E" : "#10B981" }}
                      >
                        {item.isBudgeted ? (
                          item.isOverBudget
                            ? `-${formatINR(Math.abs(item.remainingAmount))}`
                            : formatINR(item.remainingAmount)
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 w-40">
                        {item.isBudgeted ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="flex-1 h-1.5 rounded-full overflow-hidden"
                              style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor: statusColor,
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono opacity-50 w-8 text-right">
                              {item.percentUsed.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono opacity-30">No limit set</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.isBudgeted ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
                            style={{
                              borderColor: `${statusColor}40`,
                              color: statusColor,
                              backgroundColor: `${statusColor}08`,
                            }}
                          >
                            {item.isOverBudget
                              ? "Over Limit"
                              : item.isWarning
                              ? "Near Limit"
                              : "On Track"}
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono border opacity-50"
                            style={{ borderColor: "var(--app-border-subtle)" }}
                          >
                            Unset
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {item.isBudgeted && item.budgetItem ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item.budgetItem!)}
                              title="Edit"
                              className="p-1 rounded opacity-60 hover:opacity-100 hover:text-amber-400 cursor-pointer"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmationId(item.budgetItem!.id)}
                              title="Delete"
                              className="p-1 rounded opacity-60 hover:opacity-100 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenAddModal(item.category, item.meta.defaultAmount)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all hover:scale-105"
                            style={{
                              backgroundColor: "var(--app-fg)",
                              color: "var(--app-bg)",
                            }}
                          >
                            + Set
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT BUDGET */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 sm:p-7 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border-subtle)",
              color: "var(--app-fg)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div>
                <h3 className="text-base font-bold tracking-tight">
                  {editingBudget ? "Edit Category Budget" : "Set Category Spending Limit"}
                </h3>
                <p className="text-xs opacity-50 mt-0.5">
                  Target Period: {monthDisplayTitle}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitBudget} className="space-y-4">
              {/* Category Selector */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-wider opacity-60 mb-1.5">
                  Category ({BUDGET_CATEGORIES.length} Available)
                </label>
                <select
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
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs font-medium border focus:outline-none transition-colors cursor-pointer"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border-subtle)",
                    color: "var(--app-fg)",
                  }}
                >
                  {BUDGET_CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="custom">+ Custom Category Name...</option>
                </select>

                {isCustomCategory && (
                  <input
                    type="text"
                    placeholder="Enter custom category name (e.g. Photography, Vintage Watches)"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    required
                    className="w-full mt-2 rounded-xl px-3.5 py-2 text-xs border focus:outline-none"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border-subtle)",
                    }}
                  />
                )}
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-wider opacity-60 mb-1.5">
                  Monthly Budget Limit (INR ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold opacity-50">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="e.g. 10000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    className="w-full rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-mono border focus:outline-none"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border-subtle)",
                      color: "var(--app-fg)",
                    }}
                  />
                </div>

                {/* Quick Addition Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[1000, 5000, 10000, 25000].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        const curr = parseFloat(formAmount) || 0;
                        setFormAmount((curr + inc).toString());
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-lg border opacity-60 hover:opacity-100 cursor-pointer"
                      style={{
                        borderColor: "var(--app-border-subtle)",
                        backgroundColor: "var(--app-bg)",
                      }}
                    >
                      +{formatINR(inc)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormAmount("")}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-lg border opacity-40 hover:opacity-100 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Warning Threshold */}
              <div>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="text-[11px] uppercase font-mono tracking-wider opacity-60">
                    Alert Threshold
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {formThreshold}% of budget
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

              {/* Notes */}
              <div>
                <label className="block text-[11px] uppercase font-mono tracking-wider opacity-60 mb-1.5">
                  Internal Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g. Cap for dining out, Swiggy orders, and weekend brunches"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl px-3 py-2 text-xs border focus:outline-none"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border-subtle)",
                    color: "var(--app-fg)",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl opacity-60 hover:opacity-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--app-fg)",
                    color: "var(--app-bg)",
                  }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  {editingBudget ? "Save Changes" : "Set Limit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BLUEPRINTS / PRESETS */}
      {isPresetsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border-subtle)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div>
                <h3 className="text-base font-bold tracking-tight">Smart Budget Blueprints</h3>
                <p className="text-xs opacity-50 mt-0.5">
                  One-click category presets for {monthDisplayTitle}.
                </p>
              </div>
              <button
                onClick={() => setIsPresetsOpen(false)}
                className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {PRESET_PACKAGES.map((pkg) => {
                const pkgTotal = pkg.budgets.reduce((s, b) => s + b.amount, 0);

                return (
                  <div
                    key={pkg.name}
                    className="p-3.5 rounded-xl border transition-all"
                    style={{
                      borderColor: "var(--app-border-subtle)",
                      backgroundColor: "var(--app-bg)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div>
                        <div className="font-semibold text-xs">{pkg.name}</div>
                        <div className="text-[11px] opacity-50">{pkg.description}</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-emerald-400">
                          {formatINR(pkgTotal)}
                        </div>
                        <div className="text-[10px] opacity-40">
                          {pkg.budgets.length} categories
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 my-2.5">
                      {pkg.budgets.map((b) => (
                        <span
                          key={b.category}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md border opacity-60"
                          style={{ borderColor: "var(--app-border-subtle)" }}
                        >
                          {b.category}: {formatINR(b.amount)}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => handleApplyPreset(pkg)}
                      disabled={submitting}
                      className="w-full py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer hover:opacity-90 disabled:opacity-40"
                      style={{
                        backgroundColor: "var(--app-fg)",
                        color: "var(--app-bg)",
                      }}
                    >
                      {submitting ? "Applying..." : `Apply ${pkg.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 space-y-3 shadow-2xl relative"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border-subtle)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-bold">Remove Category Budget?</h3>
            </div>
            <p className="text-xs opacity-60 leading-relaxed">
              Are you sure you want to delete this category budget limit? Recorded transactions will remain untouched.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmationId(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg opacity-60 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const b = budgets.find((item) => item.id === deleteConfirmationId);
                  if (b) handleDeleteBudget(b.id, b.category);
                }}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
