import { describe, it, expect } from "vitest";
import { executeTaxRegimesTS } from "@/lib/engine/embeddedEngine";

describe("TypeScript Embedded Tax Regimes Engine", () => {
  it("computes Section 87A Marginal Relief (AY 2025-26 / Budget 2024) and Corporate NPS", () => {
    // AY 2025-26 (Budget 2024): Gross 7,85,000 -> Taxable 7,10,000 -> Excess 10,000 -> 10,400 w/ cess
    const res = executeTaxRegimesTS({
      assessment_year: "2025-2026",
      gross_income: 785000,
      deductions_80c: 150000,
    });

    expect(res.newRegime.taxableIncome).toBe(710000);
    expect(res.newRegime.baseIncomeTax).toBe(21000);
    expect(res.newRegime.section87aMarginalRelief).toBe(11000);
    expect(res.newRegime.taxAfterRebate).toBe(10000);
    expect(res.newRegime.totalTax).toBe(10400);

    // With Corporate NPS
    const resNps = executeTaxRegimesTS({
      assessment_year: "2025-2026",
      gross_income: 6000000,
      nps_80ccd_2: 200000,
    });

    expect(resNps.newRegime.corporateNpsDeduction).toBe(200000);
    expect(resNps.oldRegime.corporateNpsDeduction).toBe(200000);
    expect(resNps.newRegime.surcharge).toBeGreaterThan(0);
  });

  it("computes FY 2026-27 (AY 2027-28) Income-tax Act 2025 slabs, ₹12L 87A rebate, marginal relief, and custom overrides", () => {
    // 12,75,000 gross -> 12,00,000 taxable -> 60,000 base tax fully rebated u/s 87A => 0 tax
    const zeroTax = executeTaxRegimesTS({
      assessment_year: "2027-2028",
      gross_income: 1275000,
    });
    expect(zeroTax.newRegime.taxableIncome).toBe(1200000);
    expect(zeroTax.newRegime.baseIncomeTax).toBe(60000);
    expect(zeroTax.newRegime.section87aRebate).toBe(60000);
    expect(zeroTax.newRegime.totalTax).toBe(0);

    // 12,85,000 gross -> 12,10,000 taxable -> 87A marginal relief caps tax at excess 10,000 + 4% cess = 10,400
    const marginal = executeTaxRegimesTS({
      assessment_year: "2027-2028",
      gross_income: 1285000,
    });
    expect(marginal.newRegime.baseIncomeTax).toBe(61500);
    expect(marginal.newRegime.section87aMarginalRelief).toBe(51500);
    expect(marginal.newRegime.taxAfterRebate).toBe(10000);
    expect(marginal.newRegime.totalTax).toBe(10400);

    // Custom rule override for a future year works without code changes
    const futureOverride = executeTaxRegimesTS({
      assessment_year: "2029-2030",
      gross_income: 1275000,
      custom_rules: {
        newRegime: {
          standardDeduction: 100000,
        },
      },
    });
    expect(futureOverride.assessmentYear).toBe("2029-2030");
    expect(futureOverride.newRegime.standardDeduction).toBe(100000);
    expect(futureOverride.newRegime.taxableIncome).toBe(1175000);
    expect(futureOverride.newRegime.totalTax).toBe(0);
  });
});
