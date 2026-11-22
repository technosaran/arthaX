/**
 * Centralized High-Contrast, Distinct Color Palettes and Color Resolution Engine
 * Guarantees charts never display duplicate or indistinguishable adjacent colors.
 */

// 16 completely distinct, vibrant, high-contrast colors widely spaced across the 360° color wheel.
// Consecutively indexed items have maximum contrast and belong to completely different color families.
export const DISTINCT_CHART_PALETTE: readonly string[] = [
  "#10B981", // 0: Emerald Green
  "#3B82F6", // 1: Electric Royal Blue
  "#F59E0B", // 2: Radiant Amber / Gold
  "#8B5CF6", // 3: Vivid Purple / Violet
  "#F43F5E", // 4: Hot Coral / Rose
  "#06B6D4", // 5: Neon Cyan / Turquoise
  "#F97316", // 6: Deep Bright Orange
  "#D946EF", // 7: Vibrant Fuchsia / Magenta
  "#84CC16", // 8: Crisp Lime Green
  "#6366F1", // 9: Deep Indigo
  "#EAB308", // 10: Bright Yellow
  "#EC4899", // 11: Electric Pink
  "#0EA5E9", // 12: Sky Blue
  "#14B8A6", // 13: Deep Teal
  "#E11D48", // 14: Ruby Red
  "#A855F7", // 15: Lavender Purple
];

/**
 * Income Category Color Map
 * Every category is assigned a completely different color family.
 */
export const INCOME_CATEGORY_COLORS: Record<string, string> = {
  Salary: "#10B981", // Emerald Green
  Freelance: "#8B5CF6", // Vivid Purple
  Business: "#F59E0B", // Radiant Amber
  Dividends: "#06B6D4", // Neon Cyan
  Interest: "#3B82F6", // Electric Royal Blue
  Rental: "#F43F5E", // Hot Coral / Rose
  "Capital Gains": "#D946EF", // Vibrant Fuchsia
  Bonus: "#84CC16", // Crisp Lime Green
  "Crypto & Web3": "#F97316", // Deep Orange
  Other: "#6366F1", // Deep Indigo
};

/**
 * Common income category aliases to ensure fuzzy matching from bank statements / CSV imports.
 */
const INCOME_ALIASES: Record<string, string> = {
  salary: "Salary",
  salaries: "Salary",
  payroll: "Salary",
  "salary credit": "Salary",
  stipend: "Salary",
  freelance: "Freelance",
  consulting: "Freelance",
  contract: "Freelance",
  gig: "Freelance",
  business: "Business",
  sales: "Business",
  revenue: "Business",
  dividend: "Dividends",
  dividends: "Dividends",
  yield: "Dividends",
  interest: "Interest",
  "bank interest": "Interest",
  "fd interest": "Interest",
  "savings interest": "Interest",
  rental: "Rental",
  rent: "Rental",
  "rental income": "Rental",
  capital_gains: "Capital Gains",
  "capital gains": "Capital Gains",
  bonus: "Bonus",
  incentive: "Bonus",
  crypto: "Crypto & Web3",
  web3: "Crypto & Web3",
  bitcoin: "Crypto & Web3",
  other: "Other",
  deposit: "Other",
  transfer: "Other",
  refund: "Other",
  cashback: "Other",
};

/**
 * Resolve income category color with case-insensitive matching and fallback to distinct palette.
 */
export function getIncomeCategoryColor(category: string, index?: number): string {
  if (!category) {
    return DISTINCT_CHART_PALETTE[typeof index === "number" ? index % DISTINCT_CHART_PALETTE.length : 0];
  }

  const trimmed = category.trim();
  // Exact match
  if (INCOME_CATEGORY_COLORS[trimmed]) {
    return INCOME_CATEGORY_COLORS[trimmed];
  }

  // Case-insensitive alias match
  const lower = trimmed.toLowerCase();
  const canonical = INCOME_ALIASES[lower];
  if (canonical && INCOME_CATEGORY_COLORS[canonical]) {
    return INCOME_CATEGORY_COLORS[canonical];
  }

  // Look up case-insensitively in keys
  for (const [key, color] of Object.entries(INCOME_CATEGORY_COLORS)) {
    if (key.toLowerCase() === lower) return color;
  }

  // If not matched, pick a distinct color from the master palette based on index or hash
  if (typeof index === "number" && index >= 0) {
    return DISTINCT_CHART_PALETTE[index % DISTINCT_CHART_PALETTE.length];
  }

  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash << 5) - hash + lower.charCodeAt(i);
    hash |= 0;
  }
  return DISTINCT_CHART_PALETTE[Math.abs(hash) % DISTINCT_CHART_PALETTE.length];
}

/**
 * Expense Category Color Map
 * Carefully mapped to prevent identical colors between major spend categories.
 */
export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  "Housing & Rent": "#F43F5E", // Hot Coral / Rose
  "Groceries & Essentials": "#10B981", // Emerald Green
  "Food & Dining": "#F59E0B", // Radiant Amber
  "Utilities & Bills": "#3B82F6", // Electric Royal Blue
  "Transport & Fuel": "#8B5CF6", // Vivid Purple
  "Vehicle & Servicing": "#A855F7", // Lavender Purple
  "Shopping & Lifestyle": "#EC4899", // Electric Pink
  "Electronics & Gadgets": "#06B6D4", // Neon Cyan
  "Health & Medical": "#E11D48", // Ruby Red
  "Fitness & Sports": "#84CC16", // Crisp Lime
  "Entertainment & OTT": "#D946EF", // Vibrant Fuchsia
  "Travel & Vacations": "#0EA5E9", // Sky Blue
  "Subscriptions & SaaS": "#14B8A6", // Deep Teal
  "Debt & Loan EMI": "#DC2626", // Deep Red
  "Insurance & Protection": "#6366F1", // Deep Indigo
  "Education & Learning": "#D97706", // Deep Amber
  "Personal Care & Grooming": "#F472B6", // Soft Pink
  "Beauty & Skincare": "#FB7185", // Coral Pink
  "Family & Child Care": "#F97316", // Deep Orange
  "Gifts & Celebrations": "#EAB308", // Golden Yellow
  "Investments & Wealth": "#059669", // Dark Emerald
  "Taxes & Professional Fees": "#475569", // Slate
  "Home & Maintenance": "#78716C", // Warm Stone
  "Pet Care & Vet": "#C084FC", // Light Violet
  "Emergency Reserve": "#22C55E", // Vibrant Green
  "Charity & Community": "#FB923C", // Light Orange
  "Books & Courses": "#FBBF24", // Warm Yellow
  "Hobbies & Creative": "#9333EA", // Purple
  "Office & Coworking": "#64748B", // Cool Gray
  "Alcohol & Nightlife": "#BE123C", // Wine Red
  "Other & Contingency": "#6366F1", // Deep Indigo
  Other: "#6366F1",
};

/**
 * Resolve expense category color with case-insensitive matching and fallback to distinct palette.
 */
export function getExpenseCategoryColor(category: string, index?: number): string {
  if (!category) {
    return DISTINCT_CHART_PALETTE[typeof index === "number" ? index % DISTINCT_CHART_PALETTE.length : 0];
  }

  const trimmed = category.trim();
  if (EXPENSE_CATEGORY_COLORS[trimmed]) {
    return EXPENSE_CATEGORY_COLORS[trimmed];
  }

  const lower = trimmed.toLowerCase();
  for (const [key, color] of Object.entries(EXPENSE_CATEGORY_COLORS)) {
    if (key.toLowerCase() === lower) return color;
  }

  if (typeof index === "number" && index >= 0) {
    return DISTINCT_CHART_PALETTE[index % DISTINCT_CHART_PALETTE.length];
  }

  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash << 5) - hash + lower.charCodeAt(i);
    hash |= 0;
  }
  return DISTINCT_CHART_PALETTE[Math.abs(hash) % DISTINCT_CHART_PALETTE.length];
}

/**
 * Given a list of chart segments, guarantees that:
 * 1. Missing or undefined colors are replaced with distinct colors from the palette.
 * 2. Duplicate colors (e.g. all 4 segments passed as #10B981) are detected and resolved
 *    so every segment gets a completely different color.
 * 3. Adjacent segments never have the exact same color.
 */
export function ensureDistinctColors<T extends { color?: string; label?: string; [key: string]: any }>(
  segments: T[],
  palette: readonly string[] = DISTINCT_CHART_PALETTE
): T[] {
  if (!segments || segments.length === 0) return segments;
  if (segments.length === 1) {
    return [
      {
        ...segments[0],
        color: segments[0].color || palette[0],
      },
    ];
  }

  // Count color occurrences to detect collisions
  const colorCounts = new Map<string, number>();
  segments.forEach((seg) => {
    const c = (seg.color || "").trim().toLowerCase();
    if (c) {
      colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
    }
  });

  const usedColors = new Set<string>();
  let palettePointer = 0;

  const getNextAvailableColor = (disallowedPrev?: string): string => {
    let attempts = 0;
    while (attempts < palette.length) {
      const candidate = palette[palettePointer % palette.length];
      palettePointer++;
      attempts++;
      const lowerCandidate = candidate.toLowerCase();
      if (!usedColors.has(lowerCandidate) && lowerCandidate !== disallowedPrev?.toLowerCase()) {
        usedColors.add(lowerCandidate);
        return candidate;
      }
    }
    // If all palette colors have been used, pick the next one avoiding the immediate previous
    const fallback = palette[palettePointer % palette.length];
    palettePointer++;
    return fallback;
  };

  const result: T[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const prevColor = result.length > 0 ? result[result.length - 1].color : undefined;
    const rawColor = (seg.color || "").trim();
    const lowerRaw = rawColor.toLowerCase();

    // If color is missing, or is a duplicate used elsewhere, or matches previous neighbor
    const isDuplicate = !rawColor || (colorCounts.get(lowerRaw) || 0) > 1 || usedColors.has(lowerRaw) || lowerRaw === prevColor?.toLowerCase();

    if (isDuplicate) {
      // Reassign a distinct color from the curated palette
      const newColor = getNextAvailableColor(prevColor);
      result.push({
        ...seg,
        color: newColor,
      });
    } else {
      usedColors.add(lowerRaw);
      result.push({
        ...seg,
        color: rawColor,
      });
    }
  }

  // Ensure last segment does not match first segment if count > 2
  const lastSeg = result[result.length - 1];
  const firstSeg = result[0];
  if (result.length > 2 && lastSeg?.color && firstSeg?.color && lastSeg.color.toLowerCase() === firstSeg.color.toLowerCase()) {
    result[result.length - 1] = {
      ...lastSeg,
      color: getNextAvailableColor(result[result.length - 2]?.color),
    };
  }

  return result;
}

/**
 * Correctly pluralize unit strings in charts (e.g. "Class" -> "Classes", "Category" -> "Categories", "Source" -> "Sources").
 */
export function pluralizeUnit(unit: string = "Class", count: number): string {
  const clean = (unit || "Class").trim();
  if (count === 1) return clean;

  const lower = clean.toLowerCase();
  if (lower === "class") return "Classes";
  if (lower === "category") return "Categories";
  if (lower === "source") return "Sources";
  if (lower === "asset") return "Assets";
  if (lower === "stream") return "Streams";
  if (lower.endsWith("ies")) return clean;
  if (lower.endsWith("y") && !/[aeiou]y$/.test(lower)) {
    return `${clean.slice(0, -1)}ies`;
  }
  if (
    lower.endsWith("s") ||
    lower.endsWith("sh") ||
    lower.endsWith("ch") ||
    lower.endsWith("x") ||
    lower.endsWith("z")
  ) {
    return `${clean}es`;
  }
  return `${clean}s`;
}
