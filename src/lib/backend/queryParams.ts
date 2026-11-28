export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

/**
 * Safely parses an integer query parameter within [min, max], returning `fallback`
 * whenever the input is missing, non-numeric, or non-finite (preventing NaN ranges).
 */
export function parseIntParam(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validates and parses a YYYY-MM month query parameter (months 01..12).
 */
export function parseMonthParam(
  raw: string | null | undefined
): { valid: boolean; value: string | null } {
  if (!raw || !raw.trim()) return { valid: true, value: null };
  const trimmed = raw.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    return { valid: false, value: null };
  }
  return { valid: true, value: trimmed };
}

/**
 * Computes inclusive start/end and exclusive next-month start ISO date bounds for YYYY-MM.
 */
export function getMonthBounds(monthStr: string): {
  start: string;
  end: string;
  nextMonthStart: string;
  lastDay: number;
} {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthNumStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${monthStr}-01`;
  const end = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  const nextMonthStart =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return { start, end, nextMonthStart, lastDay };
}
