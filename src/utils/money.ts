/**
 * ArthaX Enterprise Money & Fixed-Point Decimal Precision Utility
 * Eliminates IEEE 754 floating-point drift across all backend financial routes.
 * Uses integer-scaled cents (paise) math with 2 decimal places.
 */

export type MoneyInput = number | string | null | undefined;

/**
 * Safely parses any numeric, string, or nullish input into a clean number.
 * Strips currency symbols (₹, $, €, £), commas, and whitespace.
 * Returns 0 if input is NaN, Infinity, null, or unparseable.
 */
export function parseCleanNumber(val: MoneyInput): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) return 0;
    return val;
  }
  if (typeof val === "string") {
    const cleaned = val
      .replace(/[₹$€£,\s]/g, "")
      .trim();
    if (!cleaned) return 0;
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed) || !isFinite(parsed)) return 0;
    return parsed;
  }
  return 0;
}

/**
 * Converts a monetary number to integer cents/paise (scaled by 100).
 * Uses Math.round to avoid sub-cent floating point imprecision.
 */
export function toCents(val: MoneyInput): number {
  const num = parseCleanNumber(val);
  return Math.round(num * 100);
}

/**
 * Converts integer cents/paise back to a 2-decimal number.
 */
export function fromCents(cents: number): number {
  if (isNaN(cents) || !isFinite(cents)) return 0;
  // Fix -0 to +0
  const res = cents / 100;
  return Object.is(res, -0) ? 0 : res;
}

/**
 * Exact Decimal addition: a + b
 */
export function addMoney(a: MoneyInput, b: MoneyInput): number {
  const centsA = toCents(a);
  const centsB = toCents(b);
  return fromCents(centsA + centsB);
}

/**
 * Exact Decimal subtraction: a - b
 */
export function subMoney(a: MoneyInput, b: MoneyInput): number {
  const centsA = toCents(a);
  const centsB = toCents(b);
  return fromCents(centsA - centsB);
}

/**
 * Exact Decimal multiplication: a * factor
 * Quantized to 2 decimal places.
 */
export function mulMoney(a: MoneyInput, factor: MoneyInput): number {
  const valA = parseCleanNumber(a);
  const fact = parseCleanNumber(factor);
  const cents = Math.round(valA * fact * 100);
  return fromCents(cents);
}

/**
 * Exact Decimal division: a / divisor
 * Quantized to 2 decimal places. Returns 0 if divisor is 0.
 */
export function divMoney(a: MoneyInput, divisor: MoneyInput): number {
  const div = parseCleanNumber(divisor);
  if (div === 0) return 0;
  const valA = parseCleanNumber(a);
  const cents = Math.round((valA / div) * 100);
  return fromCents(cents);
}

/**
 * Sums an array of monetary values without floating-point drift.
 */
export function sumMoney(vals: MoneyInput[]): number {
  if (!Array.isArray(vals) || vals.length === 0) return 0;
  const totalCents = vals.reduce<number>((acc: number, curr: MoneyInput) => acc + toCents(curr), 0);
  return fromCents(totalCents);
}

/**
 * Rounds a number strictly to 2 decimal places.
 */
export function roundMoney(val: MoneyInput): number {
  return fromCents(toCents(val));
}

/**
 * Calculates percentage: (part / total) * 100
 * Clamped between 0 and 100, rounded to 2 decimal places.
 */
export function percentMoney(part: MoneyInput, total: MoneyInput): number {
  const tot = parseCleanNumber(total);
  if (tot <= 0) return 0;
  const p = parseCleanNumber(part);
  const pct = (p / tot) * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  return Math.round(clamped * 100) / 100;
}

/**
 * Formats a monetary number in Indian standard currency format (Lakhs / Crores).
 */
export function formatINR(val: MoneyInput): string {
  const num = roundMoney(val);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a monetary number in USD currency format.
 */
export function formatUSD(val: MoneyInput): string {
  const num = roundMoney(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
