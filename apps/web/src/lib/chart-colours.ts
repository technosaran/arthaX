/**
 * Centralized High-Contrast Distinct Color Palette for Charts & Graphs
 * Designed for maximum visual separation & zero color ambiguity in dark mode
 */

export const CHART_COLOURS = [
  "#3B82F6", // 1. Electric Blue
  "#10B981", // 2. Emerald Green (ONLY green in the palette)
  "#F59E0B", // 3. Amber Gold
  "#EF4444", // 4. Crimson Red
  "#8B5CF6", // 5. Vivid Purple
  "#06B6D4", // 6. Cyan Sky
  "#EC4899", // 7. Hot Pink
  "#F97316", // 8. Coral Orange
  "#6366F1", // 9. Deep Indigo
  "#D946EF", // 10. Bright Magenta
  "#FACC15", // 11. Bright Yellow
  "#94A3B8", // 12. Slate Silver
] as const;

export const CHART_SERIES_COLOURS = {
  expense: "#EF4444", // Crimson Red
  expenseSoft: "#F87171",
  income: "#10B981", // Emerald Green
  incomeSoft: "#34D399",
  comparisonExpense: "#EC4899",
} as const;

const CATEGORY_COLOURS = {
  "Food & Dining": "#F59E0B", // Amber Gold
  Transportation: "#3B82F6", // Electric Blue
  Shopping: "#EC4899", // Hot Pink
  Entertainment: "#8B5CF6", // Vivid Violet
  "Bills & Utilities": "#EF4444", // Bright Red
  Rent: "#F97316", // Coral Orange
  Utilities: "#06B6D4", // Cyan Sky
  Healthcare: "#10B981", // Emerald Green
  Education: "#6366F1", // Deep Indigo
  Travel: "#D946EF", // Bright Magenta
  Groceries: "#FACC15", // Bright Yellow
  "Personal Care": "#FB7185", // Salmon Pink
  Investment: "#7C3AED", // Violet
  Subscription: "#E11D48", // Crimson
  Salary: "#10B981", // Emerald
  Freelance: "#06B6D4", // Cyan
  Bonus: "#F59E0B", // Gold
  Work: "#3B82F6", // Blue
  Others: "#94A3B8", // Slate
} as const;

type CategoryName = keyof typeof CATEGORY_COLOURS;

const CATEGORY_ALIASES: Record<string, CategoryName> = {
  food: "Food & Dining",
  dining: "Food & Dining",
  grocery: "Groceries",
  groceries: "Groceries",
  transport: "Transportation",
  transportation: "Transportation",
  rent: "Rent",
  utility: "Utilities",
  utilities: "Utilities",
  bills: "Bills & Utilities",
  healthcare: "Healthcare",
  health: "Healthcare",
  education: "Education",
  travel: "Travel",
  shopping: "Shopping",
  entertainment: "Entertainment",
  investment: "Investment",
  subscription: "Subscription",
  personal: "Personal Care",
  salary: "Salary",
  freelance: "Freelance",
  bonus: "Bonus",
  work: "Work",
  others: "Others",
  other: "Others",
};

export function getChartColour(index: number): string {
  return CHART_COLOURS[index % CHART_COLOURS.length];
}

/**
 * Returns a deterministic, highly distinct color for any string label.
 * Uses prime hashing & asset keyword matching to guarantee maximum hue separation.
 */
export function getColorByLabel(label: string | null | undefined): string {
  if (!label) return CHART_COLOURS[0];
  const str = label.trim().toLowerCase();

  // Custom fixed distinct mappings for asset classes
  if (str.includes("stock") || str.includes("equity")) return "#3B82F6"; // Electric Blue
  if (str.includes("mutual") || str.includes("mf")) return "#10B981"; // Emerald Green
  if (str.includes("cash") || str.includes("bank")) return "#F59E0B"; // Amber Gold
  if (str.includes("bond") || str.includes("fixed")) return "#8B5CF6"; // Vivid Violet
  if (str.includes("crypto") || str.includes("btc")) return "#F97316"; // Coral Orange
  if (str.includes("alt") || str.includes("real estate") || str.includes("gold")) return "#EC4899"; // Hot Pink
  if (str.includes("forex") || str.includes("currency")) return "#06B6D4"; // Cyan Teal
  if (str.includes("fno") || str.includes("option")) return "#D946EF"; // Bright Magenta

  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const index = Math.abs(hash) % CHART_COLOURS.length;
  return CHART_COLOURS[index];
}

export function getCategoryColour(category: string): string {
  const normalized = category.trim().toLowerCase();

  if (!normalized) return CATEGORY_COLOURS.Others;

  const directMatch = Object.entries(CATEGORY_COLOURS).find(([key]) => key.toLowerCase() === normalized);
  if (directMatch) return directMatch[1];

  const aliasMatch = CATEGORY_ALIASES[normalized];
  if (aliasMatch) return CATEGORY_COLOURS[aliasMatch];

  const partialMatch = Object.entries(CATEGORY_ALIASES).find(([key]) => normalized.includes(key) || key.includes(normalized));
  if (partialMatch) return CATEGORY_COLOURS[partialMatch[1]];

  return getColorByLabel(category);
}
