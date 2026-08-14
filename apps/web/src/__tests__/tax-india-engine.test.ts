import { computeIndiaTaxReport, formatFYLabel, getCurrentFYStartYear } from "@/lib/tax/india-tax-engine";

describe("india-tax-engine", () => {
  it("computes FY label and current FY correctly", () => {
    expect(formatFYLabel(2025)).toBe("FY 2025-26");
    expect(getCurrentFYStartYear(new Date("2026-02-01T00:00:00.000Z"))).toBe(2025);
    expect(getCurrentFYStartYear(new Date("2026-04-01T00:00:00.000Z"))).toBe(2026);
  });

  it("computes tax heads, deductions, and payable amounts", () => {
    const report = computeIndiaTaxReport({
      fyStartYear: 2025,
      regime: "new",
      incomes: [
        { id: "i1", amount: 1200000, category: "Salary", date: "2025-07-10" },
        { id: "i2", amount: 120000, category: "Interest", date: "2025-08-01" },
      ],
      expenses: [
        { id: "e1", amount: 100000, category: "EPF", date: "2025-08-15" },
        { id: "e2", amount: 12000, category: "Health Insurance", date: "2025-09-01" },
      ],
      transactions: [
        { id: "t1", amount: 50000, type: "expense", category: "TDS", date: "2025-08-20" },
        { id: "t2", amount: 25000, type: "expense", category: "Advance Tax", date: "2025-12-20" },
      ],
      investments: [{ id: "s1", type: "stock", symbol: "ABC", quantity: 10, buy_price: 100, current_price: 130, bought_at: "2024-01-01" }],
      mutualFunds: [],
      bonds: [],
      alternativeAssets: [],
      liabilities: [{ id: "l1", remaining_amount: 100000, monthly_payment: 5000 }],
    });

    expect(report.taxHeads.salaryIncome).toBe(1200000);
    expect(report.taxHeads.otherSourcesIncome).toBe(120000);
    expect(report.deductions.totalEligible).toBe(112000);
    expect(report.taxPayment.totalTaxPaid).toBe(75000);
    expect(report.taxPayment.taxPayable).toBeGreaterThanOrEqual(0);
    expect(report.regimeComparison.recommended === "old" || report.regimeComparison.recommended === "new").toBe(true);
    expect(report.audit.incomeRows).toContain("i1");
  });
});
