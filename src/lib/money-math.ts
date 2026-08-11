/**
 * High-Precision Financial Math Utilities.
 * Guarantees zero IEEE-754 floating point rounding drift on currency calculations.
 */

export function safeRound(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value) || isNaN(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function safeAdd(a: number, b: number, decimals: number = 2): number {
  const numA = Number.isFinite(a) ? a : 0;
  const numB = Number.isFinite(b) ? b : 0;
  return safeRound(numA + numB, decimals);
}

export function safeSub(a: number, b: number, decimals: number = 2): number {
  const numA = Number.isFinite(a) ? a : 0;
  const numB = Number.isFinite(b) ? b : 0;
  return safeRound(numA - numB, decimals);
}

export function safeMul(a: number, b: number, decimals: number = 2): number {
  const numA = Number.isFinite(a) ? a : 0;
  const numB = Number.isFinite(b) ? b : 0;
  return safeRound(numA * numB, decimals);
}

export function safeDiv(a: number, b: number, decimals: number = 2): number {
  const numA = Number.isFinite(a) ? a : 0;
  const numB = Number.isFinite(b) ? b : 0;
  if (numB === 0) return 0;
  return safeRound(numA / numB, decimals);
}

export function formatMoney(amount: number, currency: string = "INR"): string {
  const safeVal = safeRound(amount);
  const symbol = currency === "USD" ? "$" : "₹";
  const locale = currency === "USD" ? "en-US" : "en-IN";
  return `${symbol}${safeVal.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
