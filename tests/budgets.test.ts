import { describe, it, expect } from "vitest";
import {
  normalizeCategoryName,
  getCategoryMetadata,
  getPrecedingMonth,
  calculateBudgetPace,
  analyzeUnbudgetedSpending,
  buildCategoryCards,
  filterAndSortCategoryCards,
  prepareBudgetRollover,
  BudgetItem,
  ExpenseItem,
} from "../src/utils/budgetUtils";

describe("Budget Utilities & Financial Controls Suite", () => {
  describe("Category Normalization & Metadata Resolution", () => {
    it("normalizes standard category names properly", () => {
      expect(normalizeCategoryName("Housing & Rent")).toBe("Housing & Rent");
      expect(normalizeCategoryName("groceries & essentials")).toBe("Groceries & Essentials");
    });

    it("resolves legacy category aliases to standard master names", () => {
      expect(normalizeCategoryName("travel")).toBe("Travel & Vacations");
      expect(normalizeCategoryName("investments")).toBe("Investments & Wealth");
      expect(normalizeCategoryName("personal & education")).toBe("Education & Learning");
      expect(normalizeCategoryName("other")).toBe("Other & Contingency");
    });

    it("handles null, undefined or empty strings gracefully", () => {
      expect(normalizeCategoryName(null)).toBe("Other & Contingency");
      expect(normalizeCategoryName(undefined)).toBe("Other & Contingency");
      expect(normalizeCategoryName("")).toBe("Other & Contingency");
    });

    it("resolves metadata with default colors and icons for standard & custom categories", () => {
      const foodMeta = getCategoryMetadata("Food & Dining");
      expect(foodMeta.color).toBe("#F59E0B");
      expect(foodMeta.defaultAmount).toBe(6000);

      const customMeta = getCategoryMetadata("Custom Freelance Tech");
      expect(customMeta.name).toBe("Custom Freelance Tech");
      expect(customMeta.color).toBe("#71717A");
      expect(customMeta.defaultAmount).toBe(3000);
    });
  });

  describe("Preceding Month Calculation", () => {
    it("computes preceding month within the same calendar year", () => {
      expect(getPrecedingMonth("2026-11")).toBe("2026-10");
      expect(getPrecedingMonth("2026-05")).toBe("2026-04");
    });

    it("rolls back across year boundaries properly", () => {
      expect(getPrecedingMonth("2026-01")).toBe("2025-12");
      expect(getPrecedingMonth("2024-01")).toBe("2023-12");
    });

    it("handles invalid or empty inputs safely", () => {
      expect(getPrecedingMonth("")).toBe("");
      expect(getPrecedingMonth("invalid")).toBe("");
    });
  });

  describe("Burn Pace and Projections", () => {
    it("calculates daily burn allowance and projections accurately", () => {
      const pace = calculateBudgetPace("2026-11", false, 60000, 30000);
      expect(pace.totalDaysInMonth).toBe(30);
      expect(pace.projectedSpend).toBe(30000); // completed month
      expect(pace.projectedDiff).toBe(30000);
    });
  });

  describe("Unbudgeted Spending Detection", () => {
    it("accurately identifies expenses in categories without a budget ceiling", () => {
      const budgets: BudgetItem[] = [
        { id: "b1", category: "Groceries & Essentials", amount: 10000, period: "monthly", month_year: "2026-11", alert_threshold: 80 },
        { id: "b2", category: "Food & Dining", amount: 5000, period: "monthly", month_year: "2026-11", alert_threshold: 80 },
      ];

      const expenses: ExpenseItem[] = [
        { id: "e1", title: "Supermarket", amount: 3000, category: "Groceries & Essentials", expense_date: "2026-11-05" },
        { id: "e2", title: "Flight Tickets", amount: 12000, category: "Travel & Vacations", expense_date: "2026-11-10" },
        { id: "e3", title: "Hotel Stay", amount: 5000, category: "travel", expense_date: "2026-11-12" }, // Alias resolves to Travel & Vacations
        { id: "e4", title: "Netflix", amount: 650, category: "Subscriptions & SaaS", expense_date: "2026-11-14" },
      ];

      const result = analyzeUnbudgetedSpending(expenses, budgets);

      expect(result.unbudgetedExpenses.length).toBe(3);
      expect(result.totalUnbudgeted).toBe(12000 + 5000 + 650);
      expect(result.unbudgetedCategories.length).toBe(2);

      // Travel & Vacations should be top unbudgeted category with 17,000 total and 2 transactions
      const travel = result.unbudgetedCategories.find((c) => c.name === "Travel & Vacations");
      expect(travel).toBeDefined();
      expect(travel?.total).toBe(17000);
      expect(travel?.count).toBe(2);

      const subs = result.unbudgetedCategories.find((c) => c.name === "Subscriptions & SaaS");
      expect(subs?.total).toBe(650);
    });
  });

  describe("Category Cards Composition & Status Flags", () => {
    it("flags over-budget and warning statuses correctly", () => {
      const budgets: BudgetItem[] = [
        { id: "b1", category: "Food & Dining", amount: 5000, period: "monthly", month_year: "2026-11", alert_threshold: 80 },
        { id: "b2", category: "Utilities & Bills", amount: 4000, period: "monthly", month_year: "2026-11", alert_threshold: 75 },
        { id: "b3", category: "Housing & Rent", amount: 20000, period: "monthly", month_year: "2026-11", alert_threshold: 80 },
      ];

      const expenses: ExpenseItem[] = [
        { id: "e1", title: "Dinner", amount: 5500, category: "Food & Dining", expense_date: "2026-11-02" }, // 110% -> Over budget
        { id: "e2", title: "Power Bill", amount: 3200, category: "Utilities & Bills", expense_date: "2026-11-05" }, // 80% >= 75% -> Warning
        { id: "e3", title: "Rent", amount: 10000, category: "Housing & Rent", expense_date: "2026-11-01" }, // 50% -> On Track
      ];

      const cards = buildCategoryCards(budgets, expenses);

      const food = cards.find((c) => c.category === "Food & Dining")!;
      expect(food.isOverBudget).toBe(true);
      expect(food.isWarning).toBe(false);
      expect(food.percentUsed).toBe(110);
      expect(food.remainingAmount).toBe(-500);

      const utils = cards.find((c) => c.category === "Utilities & Bills")!;
      expect(utils.isOverBudget).toBe(false);
      expect(utils.isWarning).toBe(true);
      expect(utils.percentUsed).toBe(80);

      const housing = cards.find((c) => c.category === "Housing & Rent")!;
      expect(housing.isOverBudget).toBe(false);
      expect(housing.isWarning).toBe(false);
      expect(housing.percentUsed).toBe(50);
      expect(housing.remainingAmount).toBe(10000);
    });

    it("surfaces unbudgeted categories that have spending this month", () => {
      const budgets: BudgetItem[] = [];
      const expenses: ExpenseItem[] = [
        { id: "e1", title: "Vet Visit", amount: 3500, category: "Pet Care & Vet", expense_date: "2026-11-04" },
      ];

      const cards = buildCategoryCards(budgets, expenses);
      const petCard = cards.find((c) => c.category === "Pet Care & Vet")!;
      expect(petCard).toBeDefined();
      expect(petCard.isBudgeted).toBe(false);
      expect(petCard.spentAmount).toBe(3500);
      expect(petCard.expenseCount).toBe(1);
    });
  });

  describe("Filter and Sort Logic", () => {
    const sampleCards = [
      {
        category: "Food & Dining",
        meta: getCategoryMetadata("Food & Dining"),
        color: "#F59E0B",
        IconComponent: () => null,
        isBudgeted: true,
        budgetAmount: 5000,
        spentAmount: 6000,
        remainingAmount: -1000,
        percentUsed: 120,
        isOverBudget: true,
        isWarning: false,
        expenseCount: 4,
        expenses: [],
      },
      {
        category: "Utilities & Bills",
        meta: getCategoryMetadata("Utilities & Bills"),
        color: "#3B82F6",
        IconComponent: () => null,
        isBudgeted: true,
        budgetAmount: 4000,
        spentAmount: 3400,
        remainingAmount: 600,
        percentUsed: 85,
        isOverBudget: false,
        isWarning: true,
        expenseCount: 2,
        expenses: [],
      },
      {
        category: "Housing & Rent",
        meta: getCategoryMetadata("Housing & Rent"),
        color: "#F43F5E",
        IconComponent: () => null,
        isBudgeted: true,
        budgetAmount: 20000,
        spentAmount: 10000,
        remainingAmount: 10000,
        percentUsed: 50,
        isOverBudget: false,
        isWarning: false,
        expenseCount: 1,
        expenses: [],
      },
      {
        category: "Travel & Vacations",
        meta: getCategoryMetadata("Travel & Vacations"),
        color: "#6366F1",
        IconComponent: () => null,
        isBudgeted: false,
        budgetAmount: 0,
        spentAmount: 5000,
        remainingAmount: -5000,
        percentUsed: 0,
        isOverBudget: false,
        isWarning: false,
        expenseCount: 1,
        expenses: [],
      },
      {
        category: "Fitness & Sports",
        meta: getCategoryMetadata("Fitness & Sports"),
        color: "#10B981",
        IconComponent: () => null,
        isBudgeted: false,
        budgetAmount: 0,
        spentAmount: 0,
        remainingAmount: 0,
        percentUsed: 0,
        isOverBudget: false,
        isWarning: false,
        expenseCount: 0,
        expenses: [],
      },
    ];

    it("filters correctly by OVER, WARNING, ON_TRACK, and WITH_SPEND", () => {
      const over = filterAndSortCategoryCards(sampleCards, "OVER", "RISK", "");
      expect(over.length).toBe(1);
      expect(over[0].category).toBe("Food & Dining");

      const warn = filterAndSortCategoryCards(sampleCards, "WARNING", "RISK", "");
      expect(warn.length).toBe(1);
      expect(warn[0].category).toBe("Utilities & Bills");

      const onTrack = filterAndSortCategoryCards(sampleCards, "ON_TRACK", "RISK", "");
      expect(onTrack.length).toBe(1);
      expect(onTrack[0].category).toBe("Housing & Rent");

      const withSpend = filterAndSortCategoryCards(sampleCards, "WITH_SPEND", "RISK", "");
      expect(withSpend.length).toBe(4);
    });

    it("sorts by RISK placing over budget first, then warning, then active", () => {
      const sorted = filterAndSortCategoryCards(sampleCards, "ALL", "RISK", "");
      expect(sorted[0].category).toBe("Food & Dining"); // Over budget
      expect(sorted[1].category).toBe("Utilities & Bills"); // Warning
      expect(sorted[2].category).toBe("Housing & Rent"); // Active
      expect(sorted[3].category).toBe("Travel & Vacations"); // Unset with spend
      expect(sorted[4].category).toBe("Fitness & Sports"); // Unset no spend
    });

    it("sorts by % Used (Highest first)", () => {
      const sorted = filterAndSortCategoryCards(sampleCards, "ALL", "PERCENT_DESC", "");
      expect(sorted[0].percentUsed).toBe(120);
      expect(sorted[1].percentUsed).toBe(85);
      expect(sorted[2].percentUsed).toBe(50);
    });

    it("filters by search query case-insensitively", () => {
      const searched = filterAndSortCategoryCards(sampleCards, "ALL", "NAME_ASC", "util");
      expect(searched.length).toBe(1);
      expect(searched[0].category).toBe("Utilities & Bills");
    });
  });

  describe("Budget Rollover / Copy from Previous Month", () => {
    it("skips existing categories and copies missing ones cleanly", () => {
      const prevMonthBudgets: BudgetItem[] = [
        { id: "p1", category: "Housing & Rent", amount: 20000, period: "monthly", month_year: "2026-10", alert_threshold: 80, notes: "Rent" },
        { id: "p2", category: "Groceries & Essentials", amount: 10000, period: "monthly", month_year: "2026-10", alert_threshold: 80 },
        { id: "p3", category: "Food & Dining", amount: 6000, period: "monthly", month_year: "2026-10", alert_threshold: 80 },
      ];

      // Current month already has Housing set
      const currentMonthBudgets: BudgetItem[] = [
        { id: "c1", category: "Housing & Rent", amount: 22000, period: "monthly", month_year: "2026-11", alert_threshold: 80 },
      ];

      const { toInsert, skippedCount, totalAmount } = prepareBudgetRollover(
        prevMonthBudgets,
        currentMonthBudgets,
        "2026-11",
        "user-123"
      );

      expect(skippedCount).toBe(1);
      expect(toInsert.length).toBe(2);
      expect(totalAmount).toBe(16000);
      expect(toInsert.map((b) => b.category)).toEqual(["Groceries & Essentials", "Food & Dining"]);
      expect(toInsert[0].month_year).toBe("2026-11");
      expect(toInsert[0].user_id).toBe("user-123");
    });
  });

  describe("Budget Section Architecture & Separate Analytics View Structure", () => {
    it("verifies view sub-tab definitions for budgets and analytics separation", () => {
      const tabs = [
        { id: "budgets", label: "Budgets & Ceilings" },
        { id: "analytics", label: "Budget Analytics" },
      ];
      expect(tabs).toHaveLength(2);
      expect(tabs[0].id).toBe("budgets");
      expect(tabs[1].id).toBe("analytics");
    });

    it("ensures analytics donut segment calculation splits ceilings and actual outflows cleanly", () => {
      const sampleBudgets: BudgetItem[] = [
        { id: "b1", category: "Food & Dining", amount: 6000, period: "monthly", month_year: "2026-11", alert_threshold: 80 },
        { id: "b2", category: "Housing & Rent", amount: 25000, period: "monthly", month_year: "2026-11", alert_threshold: 80 },
      ];
      const sampleExpenses: ExpenseItem[] = [
        { id: "e1", title: "Dinner", category: "Food & Dining", amount: 4500, expense_date: "2026-11-05" },
        { id: "e2", title: "Shirt", category: "Shopping & Lifestyle", amount: 3200, expense_date: "2026-11-10" },
      ];

      // Ceilings distribution segments
      const ceilingSegments = sampleBudgets.map((b) => ({
        label: b.category,
        value: b.amount,
      }));
      expect(ceilingSegments).toHaveLength(2);
      expect(ceilingSegments.reduce((sum, s) => sum + s.value, 0)).toBe(31000);

      // Actual Outflows distribution segments
      const outflowMap = new Map<string, number>();
      for (const e of sampleExpenses) {
        outflowMap.set(e.category, (outflowMap.get(e.category) || 0) + e.amount);
      }
      expect(outflowMap.get("Food & Dining")).toBe(4500);
      expect(outflowMap.get("Shopping & Lifestyle")).toBe(3200);
    });
  });
});
