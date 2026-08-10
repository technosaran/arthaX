/**
 * Regional Tax Engine Strategy Pattern Implementation.
 * Implements requirement (SOLID Open-Closed Principle): Strategy Pattern for extensible tax regulation calculation rules.
 */

import { computeIndiaTaxReport } from "./india-tax-engine";

export interface TaxComputationInput {
  financialYear: string;
  regime?: "NEW" | "OLD";
  grossSalary: number;
  investments80C?: number;
  healthInsurance80D?: number;
  nps80CCD1B?: number;
  homeLoanInterest24B?: number;
  hraClaimed?: number;
  otherDeductions?: number;
}

export interface TaxComputationResult {
  financialYear: string;
  regime: "NEW" | "OLD";
  taxableIncome: number;
  taxAmount: number;
  cess: number;
  totalTaxLiability: number;
  effectiveTaxRate: number;
  deductionBreakdown: Record<string, number>;
}

export interface ITaxStrategy {
  readonly jurisdiction: string;
  calculateTax(input: TaxComputationInput): Promise<TaxComputationResult>;
}

export class IndiaTaxStrategy implements ITaxStrategy {
  public readonly jurisdiction = "INDIA";

  public async calculateTax(input: TaxComputationInput): Promise<TaxComputationResult> {
    const report = computeIndiaTaxReport({
      fyStartYear: 2025,
      regime: (input.regime?.toLowerCase() as "new" | "old") || "new",
      incomes: [{ amount: input.grossSalary, category: "Salary" }],
      expenses: [],
      transactions: [],
      investments: [],
      mutualFunds: [],
      bonds: [],
      alternativeAssets: [],
      liabilities: [],
    });

    const totalTaxLiability = input.regime === "OLD" ? report.regimeComparison.old : report.regimeComparison.new;
    const taxableIncome = report.taxHeads.grossIncome;
    const effectiveTaxRate = taxableIncome > 0 ? (totalTaxLiability / taxableIncome) * 100 : 0;

    return {
      financialYear: input.financialYear,
      regime: input.regime || "NEW",
      taxableIncome,
      taxAmount: totalTaxLiability,
      cess: Math.round(totalTaxLiability * 0.04),
      totalTaxLiability,
      effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
      deductionBreakdown: {},
    };
  }
}

export class TaxCalculationContext {
  private strategy: ITaxStrategy;

  constructor(strategy?: ITaxStrategy) {
    this.strategy = strategy || new IndiaTaxStrategy();
  }

  public setStrategy(strategy: ITaxStrategy): void {
    this.strategy = strategy;
  }

  public async compute(input: TaxComputationInput): Promise<TaxComputationResult> {
    return this.strategy.calculateTax(input);
  }
}
