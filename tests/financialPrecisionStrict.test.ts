import { describe, it, expect } from "vitest";
import {
  validateMonetaryAmount,
  InvalidMoneyError,
  toCentsStrict,
  divMoneyStrict,
  percentMoneyStrict,
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

    it("rejects amounts exceeding safety limits", () => {
      expect(() => validateMonetaryAmount(200_000_000_000)).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount(5000, { maxLimit: 1000 })).toThrow(InvalidMoneyError);
      expect(() => validateMonetaryAmount(5, { minLimit: 10 })).toThrow(InvalidMoneyError);
    });
  });

  describe("Strict Arithmetic Operations", () => {
    it("toCentsStrict converts reliably and throws on invalid inputs", () => {
      expect(toCentsStrict(125.75)).toBe(12575);
      expect(toCentsStrict("₹ 1,000.00")).toBe(100000);
      expect(() => toCentsStrict(NaN)).toThrow(InvalidMoneyError);
    });

    it("divMoneyStrict rejects division by zero and calculates exact quotient", () => {
      expect(divMoneyStrict(100, 4)).toBe(25);
      expect(divMoneyStrict(100, 3)).toBe(33.33);
      expect(() => divMoneyStrict(100, 0)).toThrow(InvalidMoneyError);
      expect(() => divMoneyStrict(100, "0")).toThrow(InvalidMoneyError);
      expect(() => divMoneyStrict("invalid", 5)).toThrow(InvalidMoneyError);
    });

    it("percentMoneyStrict rejects total <= 0 and calculates clean percentages", () => {
      expect(percentMoneyStrict(25, 100)).toBe(25);
      expect(percentMoneyStrict(50, 200)).toBe(25);
      expect(() => percentMoneyStrict(50, 0)).toThrow(InvalidMoneyError);
      expect(() => percentMoneyStrict(50, -100)).toThrow(InvalidMoneyError);
    });

    it("addMoneyStrict, subMoneyStrict, and mulMoneyStrict work reliably", () => {
      expect(addMoneyStrict(0.1, 0.2)).toBe(0.3);
      expect(subMoneyStrict(100.55, 50.25)).toBe(50.3);
      expect(mulMoneyStrict(100, 0.18)).toBe(18);
      expect(() => addMoneyStrict(NaN, 50)).toThrow(InvalidMoneyError);
      expect(() => subMoneyStrict("bad", 10)).toThrow(InvalidMoneyError);
    });
  });
});
