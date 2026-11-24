import { describe, it, expect } from "vitest";
import { executeTaxRegimesTS } from "@/lib/engine/embeddedEngine";

describe("TypeScript Embedded Tax Regimes Engine", () => {
  it("computes Section 87A Marginal Relief and Corporate NPS in Tax Regimes", () => {
    // Gross income: 7,85,000 -> Taxable: 7,10,000 after 75k standard deduction
    const res = executeTaxRegimesTS({
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
      gross_income: 6000000,
      nps_80ccd_2: 200000,
    });

    expect(resNps.newRegime.corporateNpsDeduction).toBe(200000);
    expect(resNps.oldRegime.corporateNpsDeduction).toBe(200000);
    expect(resNps.newRegime.surcharge).toBeGreaterThan(0);
  });
});
