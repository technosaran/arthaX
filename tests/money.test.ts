import { describe, it, expect } from "vitest";
import {
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  sumMoney,
  roundMoney,
  percentMoney,
  toCents,
  fromCents,
  formatINR,
} from "@/utils/money";

describe("Money & Decimal Precision Arithmetic Suite", () => {
  it("eliminates classic floating-point rounding errors (0.1 + 0.2 = 0.30)", () => {
    // In IEEE 754 float: 0.1 + 0.2 === 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);
    // With Money precision:
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it("accurately handles subtraction and avoids negative zero", () => {
    expect(subMoney(100.55, 50.25)).toBe(50.3);
    expect(subMoney(0.3, 0.3)).toBe(0);
    expect(Object.is(subMoney(0.3, 0.3), -0)).toBe(false);
  });

  it("handles string numeric inputs safely", () => {
    expect(addMoney("15000.50", "2500.25")).toBe(17500.75);
    expect(subMoney("₹ 10,000.00", "₹ 2,500.50")).toBe(7499.5);
  });

  it("safely handles null, undefined, NaN, and invalid strings by defaulting to 0", () => {
    expect(addMoney(null, 50)).toBe(50);
    expect(addMoney(undefined, "100")).toBe(100);
    expect(addMoney(NaN, 20)).toBe(20);
    expect(addMoney("invalid", 35)).toBe(35);
  });

  it("sums array of monetary amounts with zero precision loss", () => {
    const items = [19.99, 5.01, 10.5, 0.05, 100.25, 0.2];
    expect(sumMoney(items)).toBe(136.0);
  });

  it("multiplies and divides accurately with standard 2-decimal rounding", () => {
    // 100 * 0.18 = 18.00
    expect(mulMoney(100, 0.18)).toBe(18);
    // 100 / 3 = 33.33
    expect(divMoney(100, 3)).toBe(33.33);
    // Division by zero safely returns 0
    expect(divMoney(100, 0)).toBe(0);
  });

  it("computes financial percentages accurately and clamps between 0-100", () => {
    expect(percentMoney(25, 100)).toBe(25);
    expect(percentMoney(33.33, 100)).toBe(33.33);
    expect(percentMoney(150, 100)).toBe(100);
    expect(percentMoney(-10, 100)).toBe(0);
    expect(percentMoney(50, 0)).toBe(0);
  });

  it("converts to and from integer cents/paise reliably", () => {
    expect(toCents(125.75)).toBe(12575);
    expect(toCents("125.75")).toBe(12575);
    expect(fromCents(12575)).toBe(125.75);
  });

  it("formats Indian Rupees correctly using standard lakh/crore commas", () => {
    expect(formatINR(150000)).toBe("₹1,50,000.00");
    expect(formatINR(12345678.9)).toBe("₹1,23,45,678.90");
  });

  it("handles half-up rounding in divMoneyStrict and non-currency rates in mulMoneyStrict", async () => {
    const { divMoneyStrict, mulMoneyStrict } = await import("@/utils/money");
    // 5 / 3 = 1.6666... rounds half-up to 1.67
    expect(divMoneyStrict(5, 3)).toBe(1.67);
    // 4 / 3 = 1.3333... rounds half-up to 1.33
    expect(divMoneyStrict(4, 3)).toBe(1.33);

    // 100,000 * 0.125 (Budget 2024 12.5% LTCG) = 12,500.00 (not distorted to 13,000.00)
    expect(mulMoneyStrict(100_000, 0.125)).toBe(12500);
    // 10,000 * 0.0003 (0.03% brokerage) = 3.00
    expect(mulMoneyStrict(10_000, 0.0003)).toBe(3);
  });
});
