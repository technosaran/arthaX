import { BankParserContext, DefaultBankParserStrategy } from "@/lib/bank-parsers/parser-strategy";
import { TaxCalculationContext, IndiaTaxStrategy } from "@/lib/tax/tax-strategy";

describe("Strategy Pattern Implementations", () => {
  describe("BankParserContext (Strategy Pattern)", () => {
    it("should execute parsing strategy dynamically", async () => {
      const context = new BankParserContext();
      const rawText = "2026-01-01 HDFC BANK DEBIT Salary 50000 150000";

      const result = await context.execute(rawText);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("should allow swapping strategies dynamically", async () => {
      const context = new BankParserContext();
      const customStrategy = new DefaultBankParserStrategy("hdfc");

      context.setStrategy(customStrategy);
      const result = await context.execute("Sample statement text");

      expect(result.bankDetected).toBe("hdfc");
    });
  });

  describe("TaxCalculationContext (Strategy Pattern)", () => {
    it("should compute tax using IndiaTaxStrategy", async () => {
      const context = new TaxCalculationContext(new IndiaTaxStrategy());

      const result = await context.compute({
        financialYear: "2025-2026",
        regime: "NEW",
        grossSalary: 1200000,
      });

      expect(result).toBeDefined();
      expect(result.financialYear).toBe("2025-2026");
      expect(result.regime).toBe("NEW");
      expect(result.totalTaxLiability).toBeGreaterThanOrEqual(0);
    });
  });
});
