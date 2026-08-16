import { useMemo } from 'react';

export interface FireAssumptions {
  inflationRate?: number; // percentage, default 6
  marketReturnRate?: number; // percentage, default 12
  safeWithdrawalRate?: number; // percentage, default 4
  currentAge?: number; // default 30
}

export interface FireCalculatorParams {
  currentNetWorth: number;
  monthlySavings: number;
  monthlyExpenses: number;
  assumptions?: FireAssumptions;
}

export interface Projection {
  age: number;
  year: number;
  netWorth: number;
  targetFireNumber: number;
}

export interface FireCalculatorResult {
  projections: Projection[];
  fireAge: number | null;
  fireYear: number | null;
}

export function useFireCalculator({
  currentNetWorth,
  monthlySavings,
  monthlyExpenses,
  assumptions = {},
}: FireCalculatorParams): FireCalculatorResult {
  const {
    inflationRate = 6,
    marketReturnRate = 12,
    safeWithdrawalRate = 4,
    currentAge = 30,
  } = assumptions;

  return useMemo(() => {
    const projections: Projection[] = [];
    let fireAge: number | null = null;
    let fireYear: number | null = null;

    let netWorth = currentNetWorth;
    let currentMonthlyExpenses = monthlyExpenses;
    const startYear = new Date().getFullYear();

    for (let age = currentAge; age <= 85; age++) {
      const year = startYear + (age - currentAge);
      
      const targetFireNumber = (currentMonthlyExpenses * 12) / (safeWithdrawalRate / 100);

      projections.push({
        age,
        year,
        netWorth,
        targetFireNumber,
      });

      if (fireAge === null && netWorth >= targetFireNumber) {
        fireAge = age;
        fireYear = year;
      }

      // Calculate for next year
      const investmentReturn = netWorth * (marketReturnRate / 100);
      const annualSavings = monthlySavings * 12;
      netWorth = netWorth + investmentReturn + annualSavings;
      
      // Update monthly expenses for next year due to inflation
      currentMonthlyExpenses = currentMonthlyExpenses * (1 + inflationRate / 100);
    }

    return {
      projections,
      fireAge,
      fireYear,
    };
  }, [
    currentNetWorth,
    monthlySavings,
    monthlyExpenses,
    inflationRate,
    marketReturnRate,
    safeWithdrawalRate,
    currentAge,
  ]);
}
