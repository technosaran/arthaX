/**
 * ArthaX Enterprise Money & Fixed-Point Decimal Precision Engine (Mobile Layer)
 * Eliminates IEEE 754 floating-point drift across all mobile financial calculations.
 * Uses exact integer-scaled cents (paise) math with 2 decimal places.
 */

export type MoneyInput = number | string | null | undefined;

export function toCents(val: MoneyInput): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round(val * 100);
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[₹$€£,\s]/g, '').trim();
    if (cleaned === '') return 0;
    const num = Number(cleaned);
    if (isNaN(num) || !isFinite(num)) return 0;
    return Math.round(num * 100);
  }
  return 0;
}

export function fromCents(cents: number): number {
  if (isNaN(cents) || !isFinite(cents)) return 0;
  return Number((cents / 100).toFixed(2));
}

export function addMoney(a: MoneyInput, b: MoneyInput): number {
  return fromCents(toCents(a) + toCents(b));
}

export function subMoney(a: MoneyInput, b: MoneyInput): number {
  return fromCents(toCents(a) - toCents(b));
}

export function mulMoney(a: MoneyInput, factor: number): number {
  if (isNaN(factor) || !isFinite(factor)) return 0;
  return fromCents(Math.round(toCents(a) * factor));
}

export function divMoney(a: MoneyInput, divisor: number): number {
  if (!divisor || isNaN(divisor) || !isFinite(divisor)) return 0;
  return fromCents(Math.round(toCents(a) / divisor));
}

export function sumMoney(amounts: MoneyInput[]): number {
  const totalCents = amounts.reduce<number>((acc, curr) => acc + toCents(curr), 0);
  return fromCents(totalCents);
}

export function roundMoney(val: MoneyInput): number {
  return fromCents(toCents(val));
}

export function percentMoney(amount: MoneyInput, percent: number): number {
  if (!percent || isNaN(percent)) return 0;
  return fromCents(Math.round((toCents(amount) * percent) / 100));
}
