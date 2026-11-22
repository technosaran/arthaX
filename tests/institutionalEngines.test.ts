import { describe, it, expect } from "vitest";
import {
  executeGoalPlannerTS,
  executePortfolioAnalyticsTS,
  executeTaxRegimesTS,
} from "@/lib/engine/embeddedEngine";

describe("TypeScript Embedded Institutional Engines", () => {
  it("computes Goal Planner with inflation, step-up relief, and amortization schedule", () => {
    const res = executeGoalPlannerTS({
      goal_name: "Higher Education",
      category: "education",
      target_amount_today: 5000000,
      horizon_years: 10,
      current_savings: 500000,
      annual_step_up_pct: 10,
      custom_expected_return_pct: 12,
    });

    expect(res.valuation.future_target_cost).toBeGreaterThan(12900000);
    expect(res.valuation.is_already_funded).toBe(false);

    const stdSip = res.sip_strategies.standard_fixed_sip.monthly_sip;
    const stepUpSip = res.sip_strategies.step_up_sip.initial_monthly_sip;
    expect(stepUpSip).toBeLessThan(stdSip);
    expect(res.sip_strategies.step_up_sip.starting_burden_relief_percent).toBeGreaterThan(25);

    expect(res.amortization_schedule.length).toBe(10);
    expect(res.amortization_schedule[9].progress_percent).toBeGreaterThanOrEqual(99);
  });

  it("handles already funded goal gracefully in Goal Planner", () => {
    const res = executeGoalPlannerTS({
      goal_name: "Emergency Fund",
      category: "general",
      target_amount_today: 300000,
      horizon_years: 5,
      current_savings: 1000000,
    });

    expect(res.valuation.is_already_funded).toBe(true);
    expect(res.sip_strategies.standard_fixed_sip.monthly_sip).toBe(0);
    expect(res.feasibility.status).toBe("ALREADY_FUNDED");
  });

  it("computes Portfolio Analytics Sharpe, Sortino, VaR, and HHI", () => {
    const rets = [0.03, 0.02, -0.01, 0.04, 0.01, -0.02, 0.05, 0.02, 0.03, -0.01, 0.04, 0.02];
    const bench = [0.02, 0.01, -0.015, 0.03, 0.005, -0.025, 0.035, 0.015, 0.02, -0.01, 0.03, 0.015];
    const holdings = [
      { symbol: "TCS", current_value: 300000 },
      { symbol: "INFY", current_value: 300000 },
      { symbol: "HDFCBANK", current_value: 200000 },
      { symbol: "ICICIBANK", current_value: 200000 },
    ];

    const res = executePortfolioAnalyticsTS({
      portfolio_returns: rets,
      benchmark_returns: bench,
      current_portfolio_value: 1000000,
      period_frequency: "monthly",
      risk_free_rate_pct: 6.75,
      holdings,
    });

    expect(res.risk_adjusted_ratios.sharpe_ratio).toBeGreaterThan(1.0);
    expect(res.risk_adjusted_ratios.sortino_ratio).toBeGreaterThanOrEqual(res.risk_adjusted_ratios.sharpe_ratio);
    expect(res.risk_adjusted_ratios.beta).toBeDefined();

    expect(res.drawdown_metrics.maximum_drawdown_percent).toBeGreaterThan(0);
    expect(res.value_at_risk.parametric_var_95_period_percent).toBeGreaterThan(0);
    expect(res.diversification_metrics.herfindahl_index_hhi).toBe(2600);
  });

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
