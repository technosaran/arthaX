import React from "react";
import {
  Home,
  ShoppingCart,
  Utensils,
  Zap,
  Car,
  Wrench,
  ShoppingBag,
  Laptop,
  HeartPulse,
  Dumbbell,
  Film,
  Plane,
  CreditCard,
  Landmark,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Users,
  Gift,
  TrendingUp,
  Receipt,
  Heart,
  Shield,
  HeartHandshake,
  BookOpen,
  Palette,
  Briefcase,
  Wine,
  CircleDollarSign,
} from "lucide-react";

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

export interface ExpenseItem {
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

export interface CategoryCardData {
  category: string;
  meta: CategoryMeta;
  color: string;
  IconComponent: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  isBudgeted: boolean;
  budgetItem?: BudgetItem;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentUsed: number;
  isOverBudget: boolean;
  isWarning: boolean;
  expenseCount: number;
  expenses: ExpenseItem[];
}

export interface UnbudgetedCategorySummary {
  name: string;
  total: number;
  count: number;
  color: string;
}

export type BudgetFilterMode = "ALL" | "ACTIVE" | "OVER" | "WARNING" | "ON_TRACK" | "UNSET" | "WITH_SPEND";
export type BudgetSortMode = "RISK" | "PERCENT_DESC" | "SPENT_DESC" | "BUDGET_DESC" | "REMAINING_ASC" | "NAME_ASC";

// Standard Master Categories synchronized with ExpensesSection
export const BUDGET_CATEGORIES: CategoryMeta[] = [
  { name: "Housing & Rent", color: "#F43F5E", icon: Home, defaultAmount: 20000 },
  { name: "Groceries & Essentials", color: "#10B981", icon: ShoppingCart, defaultAmount: 10000 },
  { name: "Food & Dining", color: "#F59E0B", icon: Utensils, defaultAmount: 6000 },
  { name: "Utilities & Bills", color: "#3B82F6", icon: Zap, defaultAmount: 4500 },
  { name: "Transport & Fuel", color: "#8B5CF6", icon: Car, defaultAmount: 4500 },
  { name: "Vehicle & Servicing", color: "#A78BFA", icon: Wrench, defaultAmount: 3000 },
  { name: "Shopping & Lifestyle", color: "#EC4899", icon: ShoppingBag, defaultAmount: 5000 },
  { name: "Electronics & Gadgets", color: "#38BDF8", icon: Laptop, defaultAmount: 5000 },
  { name: "Health & Medical", color: "#06B6D4", icon: HeartPulse, defaultAmount: 3500 },
  { name: "Fitness & Sports", color: "#10B981", icon: Dumbbell, defaultAmount: 2500 },
  { name: "Entertainment & OTT", color: "#A855F7", icon: Film, defaultAmount: 2000 },
  { name: "Travel & Vacations", color: "#6366F1", icon: Plane, defaultAmount: 8000 },
  { name: "Subscriptions & SaaS", color: "#14B8A6", icon: CreditCard, defaultAmount: 1500 },
  { name: "Debt & Loan EMI", color: "#E11D48", icon: Landmark, defaultAmount: 15000 },
  { name: "Insurance & Protection", color: "#0284C7", icon: ShieldCheck, defaultAmount: 5000 },
  { name: "Education & Learning", color: "#D97706", icon: GraduationCap, defaultAmount: 4000 },
  { name: "Personal Care & Grooming", color: "#F472B6", icon: Sparkles, defaultAmount: 2500 },
  { name: "Beauty & Skincare", color: "#FB7185", icon: Sparkles, defaultAmount: 2000 },
  { name: "Family & Child Care", color: "#FB923C", icon: Users, defaultAmount: 6000 },
  { name: "Gifts & Celebrations", color: "#FACC15", icon: Gift, defaultAmount: 3000 },
  { name: "Investments & Wealth", color: "#059669", icon: TrendingUp, defaultAmount: 10000 },
  { name: "Taxes & Professional Fees", color: "#64748B", icon: Receipt, defaultAmount: 5000 },
  { name: "Home & Maintenance", color: "#78716C", icon: Wrench, defaultAmount: 3000 },
  { name: "Pet Care & Vet", color: "#E879F9", icon: Heart, defaultAmount: 2500 },
  { name: "Emergency Reserve", color: "#22C55E", icon: Shield, defaultAmount: 5000 },
  { name: "Charity & Community", color: "#F43F5E", icon: HeartHandshake, defaultAmount: 1500 },
  { name: "Books & Courses", color: "#F59E0B", icon: BookOpen, defaultAmount: 1500 },
  { name: "Hobbies & Creative", color: "#8B5CF6", icon: Palette, defaultAmount: 2000 },
  { name: "Office & Coworking", color: "#64748B", icon: Briefcase, defaultAmount: 3000 },
  { name: "Alcohol & Nightlife", color: "#F43F5E", icon: Wine, defaultAmount: 2500 },
  { name: "Other & Contingency", color: "#71717A", icon: CircleDollarSign, defaultAmount: 3000 },
];

// Aliases mapping for backward compatibility
export const CATEGORY_ALIASES: Record<string, string> = {
  travel: "Travel & Vacations",
  investments: "Investments & Wealth",
  "personal & education": "Education & Learning",
  other: "Other & Contingency",
};

/**
 * Normalizes category names to standard master names, resolving aliases.
 */
export function normalizeCategoryName(rawCategory: string | null | undefined): string {
  if (!rawCategory) return "Other & Contingency";
  const trimmed = rawCategory.trim();
  const lower = trimmed.toLowerCase();
  if (CATEGORY_ALIASES[lower]) {
    return CATEGORY_ALIASES[lower];
  }
  const match = BUDGET_CATEGORIES.find((c) => c.name.toLowerCase() === lower);
  return match ? match.name : trimmed;
}

/**
 * Resolves icon, color, and default metadata for any category.
 */
export function getCategoryMetadata(categoryName: string): CategoryMeta {
  const normalized = normalizeCategoryName(categoryName);
  const found = BUDGET_CATEGORIES.find((c) => c.name.toLowerCase() === normalized.toLowerCase());
  if (found) return found;

  return {
    name: normalized,
    color: "#71717A",
    icon: CircleDollarSign,
    defaultAmount: 3000,
  };
}

/**
 * Computes the chronological preceding month key (e.g., '2026-11' -> '2026-10', '2026-01' -> '2025-12').
 */
export function getPrecedingMonth(monthYear: string): string {
  if (!monthYear || !monthYear.includes("-")) return "";
  const [yearStr, monthStr] = monthYear.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-indexed
  month -= 1;
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Calculates burn pace and monthly projection metrics.
 */
export function calculateBudgetPace(
  selectedMonthYear: string,
  isCurrentMonth: boolean,
  totalBudgeted: number,
  totalSpent: number
) {
  const [yearStr, monthStr] = (selectedMonthYear || "").split("-");
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || new Date().getMonth() + 1;
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  let currentDay = totalDaysInMonth;
  if (isCurrentMonth) {
    currentDay = now.getDate();
  } else if (new Date(year, month - 1, 1) > now) {
    currentDay = 1;
  }

  const daysLeft = Math.max(0, totalDaysInMonth - currentDay);
  const remaining = totalBudgeted - totalSpent;
  const dailyAllowance = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;
  const projectedSpend = currentDay > 0 ? (totalSpent / currentDay) * totalDaysInMonth : 0;
  const projectedDiff = totalBudgeted - projectedSpend;

  return {
    totalDaysInMonth,
    currentDay,
    daysLeft,
    dailyAllowance,
    projectedSpend,
    projectedDiff,
  };
}

/**
 * Computes unbudgeted expenses and aggregate category summaries.
 */
export function analyzeUnbudgetedSpending(
  monthExpenses: ExpenseItem[],
  monthBudgets: BudgetItem[]
) {
  const budgetedCategorySet = new Set(
    monthBudgets.map((b) => normalizeCategoryName(b.category).toLowerCase())
  );

  const unbudgetedExpenses = monthExpenses.filter((e) => {
    const norm = normalizeCategoryName(e.category).toLowerCase();
    return !budgetedCategorySet.has(norm);
  });

  const categoryMap: Record<string, { total: number; count: number }> = {};
  let totalUnbudgeted = 0;

  for (const exp of unbudgetedExpenses) {
    const norm = normalizeCategoryName(exp.category);
    if (!categoryMap[norm]) {
      categoryMap[norm] = { total: 0, count: 0 };
    }
    categoryMap[norm].total += exp.amount;
    categoryMap[norm].count += 1;
    totalUnbudgeted += exp.amount;
  }

  const unbudgetedCategories: UnbudgetedCategorySummary[] = Object.entries(categoryMap).map(
    ([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      color: getCategoryMetadata(name).color,
    })
  );

  unbudgetedCategories.sort((a, b) => b.total - a.total);

  return {
    unbudgetedExpenses,
    totalUnbudgeted,
    unbudgetedCategories,
  };
}

/**
 * Builds the complete list of CategoryCardData items, merging predefined categories,
 * active budgets, and any category with expenses logged this month.
 */
export function buildCategoryCards(
  monthBudgets: BudgetItem[],
  monthExpenses: ExpenseItem[]
): CategoryCardData[] {
  const budgetMap = new Map<string, BudgetItem>();
  monthBudgets.forEach((b) => {
    budgetMap.set(normalizeCategoryName(b.category).toLowerCase(), b);
  });

  // Group expenses by normalized category
  const expenseMap = new Map<string, ExpenseItem[]>();
  for (const exp of monthExpenses) {
    const norm = normalizeCategoryName(exp.category).toLowerCase();
    if (!expenseMap.has(norm)) {
      expenseMap.set(norm, []);
    }
    expenseMap.get(norm)!.push(exp);
  }

  const cards: CategoryCardData[] = [];
  const processedKeys = new Set<string>();

  // 1. Process master predefined categories
  for (const catMeta of BUDGET_CATEGORIES) {
    const key = catMeta.name.toLowerCase();
    processedKeys.add(key);

    const budgetItem = budgetMap.get(key);
    const catExpenses = expenseMap.get(key) || [];
    const spent = catExpenses.reduce((sum, e) => sum + e.amount, 0);
    const isBudgeted = !!budgetItem;
    const budgetAmount = budgetItem ? budgetItem.amount : 0;
    const remaining = budgetAmount - spent;
    const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 10000) / 100 : 0;
    const isOverBudget = isBudgeted && spent > budgetAmount;
    const isWarning = isBudgeted && !isOverBudget && percentUsed >= (budgetItem?.alert_threshold || 80);

    cards.push({
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
      expenseCount: catExpenses.length,
      expenses: catExpenses,
    });
  }

  // 2. Add custom or non-standard categories that have an active budget
  for (const b of monthBudgets) {
    const normName = normalizeCategoryName(b.category);
    const key = normName.toLowerCase();
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      const meta = getCategoryMetadata(normName);
      const catExpenses = expenseMap.get(key) || [];
      const spent = catExpenses.reduce((sum, e) => sum + e.amount, 0);
      const budgetAmount = b.amount;
      const remaining = budgetAmount - spent;
      const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 10000) / 100 : 0;
      const isOverBudget = spent > budgetAmount;
      const isWarning = !isOverBudget && percentUsed >= (b.alert_threshold || 80);

      cards.push({
        category: normName,
        meta,
        color: meta.color,
        IconComponent: meta.icon,
        isBudgeted: true,
        budgetItem: b,
        budgetAmount,
        spentAmount: spent,
        remainingAmount: remaining,
        percentUsed,
        isOverBudget,
        isWarning,
        expenseCount: catExpenses.length,
        expenses: catExpenses,
      });
    }
  }

  // 3. Add any categories that have expenses this month but no budget set
  expenseMap.forEach((catExpenses, key) => {
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      const sampleCat = catExpenses[0]?.category || key;
      const normName = normalizeCategoryName(sampleCat);
      const meta = getCategoryMetadata(normName);
      const spent = catExpenses.reduce((sum, e) => sum + e.amount, 0);

      cards.push({
        category: normName,
        meta,
        color: meta.color,
        IconComponent: meta.icon,
        isBudgeted: false,
        budgetAmount: 0,
        spentAmount: spent,
        remainingAmount: -spent,
        percentUsed: 0,
        isOverBudget: false,
        isWarning: false,
        expenseCount: catExpenses.length,
        expenses: catExpenses,
      });
    }
  });

  return cards;
}

/**
 * Filters and sorts CategoryCardData according to active filter tab, sort order, and search query.
 */
export function filterAndSortCategoryCards(
  cards: CategoryCardData[],
  filterMode: BudgetFilterMode,
  sortMode: BudgetSortMode,
  searchQuery: string
): CategoryCardData[] {
  const query = searchQuery.trim().toLowerCase();

  const filtered = cards.filter((item) => {
    // Search query filter
    if (query) {
      const matchName = item.category.toLowerCase().includes(query);
      const matchNotes = item.budgetItem?.notes?.toLowerCase().includes(query);
      if (!matchName && !matchNotes) return false;
    }

    // Status filter tabs
    switch (filterMode) {
      case "ACTIVE":
        return item.isBudgeted;
      case "OVER":
        return item.isOverBudget;
      case "WARNING":
        return item.isWarning;
      case "ON_TRACK":
        return item.isBudgeted && !item.isWarning && !item.isOverBudget;
      case "UNSET":
        return !item.isBudgeted;
      case "WITH_SPEND":
        return item.spentAmount > 0;
      case "ALL":
      default:
        return true;
    }
  });

  // Sort
  return filtered.sort((a, b) => {
    switch (sortMode) {
      case "RISK": {
        // Over budget first, then warning, then active on-track, then unset with spend, then unset
        const getPriority = (c: CategoryCardData) => {
          if (c.isOverBudget) return 5;
          if (c.isWarning) return 4;
          if (c.isBudgeted) return 3;
          if (c.spentAmount > 0) return 2;
          return 1;
        };
        const pDiff = getPriority(b) - getPriority(a);
        if (pDiff !== 0) return pDiff;
        return b.percentUsed - a.percentUsed;
      }
      case "PERCENT_DESC":
        return b.percentUsed - a.percentUsed;
      case "SPENT_DESC":
        return b.spentAmount - a.spentAmount;
      case "BUDGET_DESC":
        return b.budgetAmount - a.budgetAmount;
      case "REMAINING_ASC":
        return a.remainingAmount - b.remainingAmount;
      case "NAME_ASC":
        return a.category.localeCompare(b.category);
      default:
        return 0;
    }
  });
}

/**
 * Prepares rollover budget payloads from previous month for current month,
 * skipping categories that already exist in the target month to prevent unique constraint violation.
 */
export function prepareBudgetRollover(
  prevMonthBudgets: BudgetItem[],
  currentMonthBudgets: BudgetItem[],
  targetMonthYear: string,
  userId: string
): {
  toInsert: Array<Omit<BudgetItem, "id" | "created_at">>;
  skippedCount: number;
  totalAmount: number;
} {
  const currentCategorySet = new Set(
    currentMonthBudgets.map((b) => normalizeCategoryName(b.category).toLowerCase())
  );

  const toInsert: Array<Omit<BudgetItem, "id" | "created_at">> = [];
  let skippedCount = 0;
  let totalAmount = 0;

  for (const prev of prevMonthBudgets) {
    const norm = normalizeCategoryName(prev.category);
    if (currentCategorySet.has(norm.toLowerCase())) {
      skippedCount++;
    } else {
      toInsert.push({
        user_id: userId,
        category: norm,
        amount: prev.amount,
        period: "monthly",
        month_year: targetMonthYear,
        alert_threshold: prev.alert_threshold || 80,
        notes: prev.notes || null,
      });
      totalAmount += prev.amount;
    }
  }

  return {
    toInsert,
    skippedCount,
    totalAmount,
  };
}
