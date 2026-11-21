/**
 * ArthaX Enterprise Money & Fixed-Point Decimal Precision Utility
 * Eliminates IEEE 754 floating-point drift across all backend financial routes.
 * Uses integer-scaled cents (paise) math with 2 decimal places.
 */

export type MoneyInput = number | string | null | undefined;

/**
 * Thrown when a monetary input fails strict financial validation.
 */
export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyError";
  }
}

export interface MoneyValidationOptions {
  allowNegative?: boolean;
  maxLimit?: number;
  minLimit?: number;
  fieldName?: string;
  maxDecimals?: number;
}

const DEFAULT_MAX_LIMIT = 100_000_000_000; // 100 Billion max limit

/**
 * Strict validator for monetary inputs prior to persistence or mission-critical ledger ops.
 * Rejects null, undefined, NaN, Infinity, non-numeric strings, bad signs, and overflow.
 * Returns the exact 2-decimal rounded number.
 */
export function validateMonetaryAmount(
  val: unknown,
  options?: MoneyValidationOptions
): number {
  const fieldName = options?.fieldName || "Monetary amount";
  const allowNegative = options?.allowNegative ?? false;
  const maxLimit = options?.maxLimit ?? DEFAULT_MAX_LIMIT;
  const minLimit = options?.minLimit ?? (allowNegative ? -DEFAULT_MAX_LIMIT : 0);

  if (val === null || val === undefined) {
    throw new InvalidMoneyError(`${fieldName} cannot be null or undefined`);
  }

  let num: number;
  if (typeof val === "number") {
    if (isNaN(val)) {
      throw new InvalidMoneyError(`${fieldName} cannot be NaN`);
    }
    if (!isFinite(val)) {
      throw new InvalidMoneyError(`${fieldName} cannot be infinite`);
    }
    num = val;
  } else if (typeof val === "string") {
    const trimmed = val.replace(/[₹$€£,\s]/g, "").trim();
    if (trimmed === "") {
      throw new InvalidMoneyError(`${fieldName} cannot be empty`);
    }
    // Strict numeric check: optional leading minus, digits, optional single dot with up to 4 decimal places
    const validNumericPattern = /^-?\d+(\.\d+)?$/;
    if (!validNumericPattern.test(trimmed)) {
      throw new InvalidMoneyError(`${fieldName} contains invalid characters or malformed format: "${val}"`);
    }
    num = Number(trimmed);
    if (isNaN(num) || !isFinite(num)) {
      throw new InvalidMoneyError(`${fieldName} parsed to invalid number: "${val}"`);
    }
  } else {
    throw new InvalidMoneyError(`${fieldName} must be a number or string, received ${typeof val}`);
  }

  if (!allowNegative && num < 0) {
    throw new InvalidMoneyError(`${fieldName} cannot be negative (received ${num})`);
  }

  if (num < minLimit) {
    throw new InvalidMoneyError(`${fieldName} (${num}) is below allowed minimum (${minLimit})`);
  }

  if (num > maxLimit) {
    throw new InvalidMoneyError(`${fieldName} (${num}) exceeds maximum allowed limit (${maxLimit})`);
  }

  // Safe integer paise math validation
  const cents = Math.round(num * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new InvalidMoneyError(`${fieldName} exceeds safe integer numeric precision`);
  }
  return fromCents(cents);
}

/**
 * Converts a monetary value to integer cents/paise with strict validation.
 * Throws InvalidMoneyError on invalid input or integer overflow.
 */
export function toCentsStrict(val: unknown, fieldName = "Monetary amount"): number {
  const valid = validateMonetaryAmount(val, { fieldName, allowNegative: true });
  const cents = Math.round(valid * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new InvalidMoneyError(`${fieldName} integer paise value exceeds safe integer range`);
  }
  return cents;
}

/**
 * Safe aliases for paise precision
 */
export const toPaise = toCentsStrict;
export const fromPaise = fromCents;

/**
 * Strict division of monetary values using integer paise arithmetic.
 * Throws InvalidMoneyError on division by zero or invalid inputs.
 */
export function divMoneyStrict(
  a: unknown,
  divisor: unknown,
  fieldName = "Division operation"
): number {
  const centsA = BigInt(toCentsStrict(a, `${fieldName} (numerator)`));
  const centsDiv = BigInt(toCentsStrict(divisor, `${fieldName} (denominator)`));

  if (centsDiv === BigInt(0)) {
    throw new InvalidMoneyError(`${fieldName}: Division by zero is prohibited`);
  }

  // Exact integer scaling: (centsA * BigInt(100)) / centsDiv
  const divCents = (centsA * BigInt(100)) / centsDiv;
  const numCents = Number(divCents);
  if (!Number.isSafeInteger(numCents)) {
    throw new InvalidMoneyError(`${fieldName}: Division result exceeds safe integer precision`);
  }
  return fromCents(numCents);
}

/**
 * Strict percentage calculation: (part / total) * 100
 * Uses integer paise arithmetic and DOES NOT clamp legitimate financial percentages (e.g. >100% ROI or negative returns).
 * Throws InvalidMoneyError if total is zero or inputs are malformed.
 */
export function percentMoneyStrict(
  part: unknown,
  total: unknown,
  fieldName = "Percentage operation",
  options?: { clamp?: boolean }
): number {
  const validPart = validateMonetaryAmount(part, { fieldName: `${fieldName} (part)`, allowNegative: true });
  const validTotal = validateMonetaryAmount(total, { fieldName: `${fieldName} (total)`, allowNegative: true });

  if (validTotal === 0) {
    throw new InvalidMoneyError(`${fieldName}: Total cannot be zero for percentage calculation`);
  }

  // Exact integer paise arithmetic: (part * 10000) / total
  const partPaise = BigInt(Math.round(validPart * 100));
  const totPaise = BigInt(Math.round(validTotal * 100));
  const pctScaled = Number((partPaise * BigInt(10000)) / totPaise) / 100;

  if (options?.clamp) {
    return Math.max(0, Math.min(100, pctScaled));
  }
  return pctScaled;
}

/**
 * Strict Decimal addition: a + b using safe integer paise arithmetic.
 */
export function addMoneyStrict(a: unknown, b: unknown): number {
  const centsA = toCentsStrict(a, "Operand A");
  const centsB = toCentsStrict(b, "Operand B");
  const sum = centsA + centsB;
  if (!Number.isSafeInteger(sum)) {
    throw new InvalidMoneyError("Addition result exceeds safe integer precision");
  }
  return fromCents(sum);
}

/**
 * Strict Decimal subtraction: a - b using safe integer paise arithmetic.
 */
export function subMoneyStrict(a: unknown, b: unknown): number {
  const centsA = toCentsStrict(a, "Operand A");
  const centsB = toCentsStrict(b, "Operand B");
  const diff = centsA - centsB;
  if (!Number.isSafeInteger(diff)) {
    throw new InvalidMoneyError("Subtraction result exceeds safe integer precision");
  }
  return fromCents(diff);
}

/**
 * Strict Decimal multiplication: a * factor using safe integer paise arithmetic.
 */
export function mulMoneyStrict(a: unknown, factor: unknown): number {
  const centsA = BigInt(toCentsStrict(a, "Operand A"));
  const factorCents = BigInt(toCentsStrict(factor, "Factor"));
  const prodCents = (centsA * factorCents) / BigInt(100);
  const numCents = Number(prodCents);
  if (!Number.isSafeInteger(numCents)) {
    throw new InvalidMoneyError("Multiplication result exceeds safe integer precision");
  }
  return fromCents(numCents);
}

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
 * Clamped between 0 and 100 by default for standard UI progress/budget widgets.
 * Pass { clamp: false } or use percentMoneyStrict() for true unclamped financial percentage changes (ROI/PnL).
 */
export function percentMoney(part: MoneyInput, total: MoneyInput, options?: { clamp?: boolean }): number {
  const tot = parseCleanNumber(total);
  if (tot <= 0) return 0;
  const p = parseCleanNumber(part);
  const pct = (p / tot) * 100;
  const rounded = Math.round(pct * 100) / 100;
  if (options?.clamp === false) {
    return rounded;
  }
  const clamped = Math.max(0, Math.min(100, rounded));
  return clamped;
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
