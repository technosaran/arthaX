import { safeAdd, safeSub, safeMul, safeDiv, safeRound, formatMoney } from "@/lib/money-math";

describe("Money Math Precision Utility", () => {
  test("eliminates floating point addition drift (0.1 + 0.2)", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(safeAdd(0.1, 0.2)).toBe(0.3);
  });

  test("handles subtraction, multiplication, and division safely", () => {
    expect(safeSub(10.55, 0.05)).toBe(10.5);
    expect(safeMul(19.99, 3)).toBe(59.97);
    expect(safeDiv(100, 3)).toBe(33.33);
    expect(safeDiv(100, 0)).toBe(0);
  });

  test("formats INR and USD currency cleanly", () => {
    expect(formatMoney(1234.56, "INR")).toContain("₹1,234.56");
    expect(formatMoney(1234.56, "USD")).toContain("$1,234.56");
  });

  test("handles NaN and non-finite numbers safely", () => {
    expect(safeRound(NaN)).toBe(0);
    expect(safeAdd(NaN, 10)).toBe(10);
  });
});
