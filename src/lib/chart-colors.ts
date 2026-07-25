/**
 * Centralized High-Contrast Distinct Color Palette for Charts & Graphs
 * Designed for maximum visual separation & zero color ambiguity in dark mode
 */

export const DISTINCT_CHART_COLORS = [
  "#3B82F6", // 1. Electric Blue
  "#10B981", // 2. Emerald Green
  "#F59E0B", // 3. Amber Gold
  "#F43F5E", // 4. Rose Red
  "#8B5CF6", // 5. Violet Purple
  "#06B6D4", // 6. Bright Cyan
  "#EC4899", // 7. Hot Pink
  "#F97316", // 8. Coral Orange
  "#6366F1", // 9. Vivid Indigo
  "#84CC16", // 10. Lime Green
  "#14B8A6", // 11. Mint Teal
  "#D946EF", // 12. Magenta
];

/**
 * Get distinct color by index
 */
export function getDistinctChartColor(index: number): string {
  return DISTINCT_CHART_COLORS[index % DISTINCT_CHART_COLORS.length];
}

/**
 * Hash-based deterministic distinct color lookup for string keys (categories, assets)
 */
export function getDistinctColorForString(str: string): string {
  if (!str) return DISTINCT_CHART_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DISTINCT_CHART_COLORS[Math.abs(hash) % DISTINCT_CHART_COLORS.length];
}
