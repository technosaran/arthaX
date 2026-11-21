import { describe, it, expect } from "vitest";
import {
  validateMonetaryAmount,
  InvalidMoneyError,
  toCentsStrict,
  toPaise,
  fromPaise,
  divMoneyStrict,
  percentMoneyStrict,
  percentMoney,
  addMoneyStrict,
  subMoneyStrict,
  mulMoneyStrict,
} from "@/utils/money";

describe("Strict Financial Precision & Validation Suite", () => {
  describe("validateMonetaryAmount", () => {
    it("accepts valid positive numbers and strings", () => {
      expect(validateMonetaryAmount(1500.5)).toBe(1500.5);
      expect(validateMonetaryAmount("₹ 10,500.25")).toBe(10500.25);
      expect(validateMonetaryAmount("$123.456")).toBe(123.46); // rounds to 2 decimals
      expect(validateMonetaryAmount("0")).toBe(0);
      expect(validateMonetaryAmount(0)).toBe(0);
    });

    it("rejects null, undefined, empty strings, and non-primitives", () => {
      expect(() => validateMonetaryAmount(null)).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount(undefined)).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount("")).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount("   ")).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount({})).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount([])).toThrow(InvalidMoneyError);
    });

    it("rejects NaN, Infinity, and -Infinity", () => {
      expect(() => validateMonetaryAmount(NaN)).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount(Infinity)).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount(-Infinity)).toThrow(InvalidMoneyError);
    });

    it("rejects malformed number strings with bad characters", () => {
      expect(() => validateMonetaryAmount("12.34.56")).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount("abc123")).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount("--50")).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount("100e10")).toThrow(InvalidMoneyError);
    });

    it("enforces non-negative constraint by default and allows negative when specified", () => {
      expect(() => validateMonetaryAmount(-50)).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount("-100.50")).toThrow(InvalidMoneyError);
      expect(validateMonetaryAmount(-50, { allowNegative: true })).toBe(-50);
      expect(validateMonetaryAmount("-100.50", { allowNegative: true })).toBe(-100.5);
    });

    it("rejects amounts exceeding safety limits and safe integer bounds", () => {
      expect(() => validateMonetaryAmount(200_000_000_000)).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount(5000, { maxLimit: 1000 })).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount(5, { minLimit: 10 })).toThrow(InvalidMoneyError);
    });
  });

  describe("Strict Arithmetic & Integer Paise Precision", () => {
    it("toCentsStrict and toPaise convert reliably and throw on invalid inputs", () => {
      expect(toCentsStrict(125.75)).toBe(12575);
      expect(toPaise("₹ 1,000.00")).toBe(100000);
      expect(fromPaise(100000)).toBe(1000);
      expect(() => toCentsStrict(NaN)).toThrow(InvalidMoneyError);
    });

    it("divMoneyStrict rejects division by zero and calculates exact integer paise quotient", () => {
      expect(divMoneyStrict(100, 4)).toBe(25);
      expect(divMoneyStrict(100, 3)).toBe(33.33);
      expect(() => divMoneyStrict(100, 0)).toThrow(InvalidMoneyError);
      expect(() => divMoneyStrict(100, "0")).toThrow(InvalidMoneyError);
      expect(() => divMoneyStrict("invalid", 5)).toThrow(InvalidMoneyError);
    });

    it("percentMoneyStrict DOES NOT clamp legitimate financial percentages (>100% ROI or negative returns)", () => {
      // 150% investment gain
      expect(percentMoneyStrict(150, 100)).toBe(150);
      expect(percentMoneyStrict(250, 100)).toBe(250);
      // -20% portfolio drop
      expect(percentMoneyStrict(-20, 100)).toBe(-20);
      // Clamping is only applied when explicitly requested
      expect(percentMoneyStrict(150, 100, undefined, { clamp: true })).toBe(100);
      expect(percentMoneyStrict(-20, 100, undefined, { clamp: true })).toBe(0);
      // Rejects total = 0
      expect(() => percentMoneyStrict(50, 0)).toThrow(InvalidMoneyError);
    });

    it("percentMoney supports unclamped financial percentages via { clamp: false } while preserving UI defaults", () => {
      expect(percentMoney(150, 100)).toBe(100); // UI default clamped
      expect(percentMoney(150, 100, { clamp: false })).toBe(150); // Unclamped financial percentage
      expect(percentMoney(-25, 100, { clamp: false })).toBe(-25); // Unclamped negative return
    });

    it("addMoneyStrict, subMoneyStrict, and mulMoneyStrict work with safe integer precision", () => {
      expect(addMoneyStrict(0.1, 0.2)).toBe(0.3);
      expect(subMoneyStrict(100.55, 50.25)).toBe(50.3);
      expect(mulMoneyStrict(100, 0.18)).toBe(18);
      expect(mulMoneyStrict(1500.5, 3)).toBe(4501.5);
      expect(() => addMoneyStrict(NaN, 50)).toThrow(InvalidMoneyError);
      expect(() => subMoneyStrict("bad", 10)).toThrow(InvalidMoneyError);
    });
  });
});
