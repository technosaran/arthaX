import { describe, it, expect } from "vitest";
import {
  executeDebtPayoffTS,
  executeStressTestTS,
  executeNetWorthTS,
  executeFireTS,
  executeRebalancingTS,
} from "@/lib/engine/embeddedEngine";

describe("ArthaX Advanced Embedded Financial Engines Suite (DebtPayoff & StressTesting)", () => {
  describe("DebtPayoffEngine (TS Embedded)", () => {
    it("simulates debt payoff and correctly calculates Avalanche vs Snowball savings", () => {
      const debts = [
        {
          id: "card_1",
          name: "HDFC Credit Card",
          principal: 100000,
          interest_rate_apr: 36,
          minimum_payment: 5000,
        },
        {
          id: "loan_1",
          name: "Personal Loan",
          principal: 200000,
          interest_rate_apr: 14,
          minimum_payment: 6000,
        },
        {
          id: "card_2",
          name: "ICICI Card",
          principal: 30000,
          interest_rate_apr: 42,
          minimum_payment: 2000,
        },
      ];

      const res = executeDebtPayoffTS({ debts, monthly_extra_payment: 5000 });

      expect(res.debts_count).toBe(3);
      expect(Number(res.total_debt)).toBe(330000);
      expect(res.strategies.avalanche).toBeDefined();
      expect(res.strategies.snowball).toBeDefined();
      expect(res.strategies.minimum_only).toBeDefined();

      const avalanche = res.strategies.avalanche!;
      const snowball = res.strategies.snowball!;
      const minOnly = res.strategies.minimum_only!;

      // Avalanche must incur less or equal total interest compared to Snowball
      expect(Number(avalanche.total_interest_paid)).toBeLessThanOrEqual(Number(snowball.total_interest_paid));
      // Accelerated payoff must be faster than minimum payments only
      expect(avalanche.months_to_debt_free).toBeLessThan(minOnly.months_to_debt_free);
      expect(snowball.months_to_debt_free).toBeLessThan(minOnly.months_to_debt_free);
      expect(Number(avalanche.interest_saved)).toBeGreaterThan(0);
      expect(["AVALANCHE", "SNOWBALL"]).toContain(res.recommended_strategy);
    });

    it("handles empty debt list gracefully without error", () => {
      const res = executeDebtPayoffTS({ debts: [] });
      expect(res.debts_count).toBe(0);
      expect(res.total_debt).toBe("0.00");
      expect(res.recommended_strategy).toBe("NONE");
    });
  });

  describe("FinancialStressTestEngine (TS Embedded)", () => {
    it("computes multi-scenario shock resilience and returns a 0-100 score", () => {
      const inputs = {
        liquid_cash: 600000, // 6 months of mandatory expenses
        semi_liquid_assets: 2500000,
        monthly_income: 150000,
        monthly_mandatory_expenses: 70000,
        monthly_discretionary_expenses: 30000,
        total_debt: 200000,
        emergency_shock_amount: 300000,
      };

      const res = executeStressTestTS(inputs);

      expect(res.resilience_score).toBeGreaterThanOrEqual(0);
      expect(res.resilience_score).toBeLessThanOrEqual(100);
      expect(["FORTIFIED", "ROBUST", "VULNERABLE", "CRITICAL"]).toContain(res.resilience_tier);
      expect(res.baseline).toBeDefined();
      expect(res.scenarios).toBeDefined();

      const scenarios = res.scenarios;
      expect(scenarios.job_loss_6_months.survives_without_selling_assets).toBe(true);
      expect(scenarios.job_loss_6_months.months_of_cash_runway).toBeGreaterThan(6);
      expect(Number(scenarios.market_crash_40_pct.portfolio_loss)).toBe(1000000);
      expect(scenarios.emergency_medical_shock.covered_by_cash).toBe(true);
    });

    it("identifies critical vulnerability when liquid cash is inadequate", () => {
      const inputs = {
        liquid_cash: 25000,
        semi_liquid_assets: 50000,
        monthly_income: 80000,
        monthly_mandatory_expenses: 60000,
        monthly_discretionary_expenses: 20000,
        total_debt: 600000,
        emergency_shock_amount: 200000,
      };

      const res = executeStressTestTS(inputs);

      expect(res.resilience_score).toBeLessThan(60);
      expect(["VULNERABLE", "CRITICAL"]).toContain(res.resilience_tier);
      expect(res.scenarios.job_loss_6_months.survives_without_selling_assets).toBe(false);
      expect(res.scenarios.emergency_medical_shock.covered_by_cash).toBe(false);
      expect(Number(res.scenarios.emergency_medical_shock.forced_investment_liquidation)).toBeGreaterThan(0);
    });
  });
});
