export type HealthFactor = {
  name: string;
  score: number;
  weight: number;
  status: "Excellent" | "Good" | "Fair" | "Attention";
  description: string;
};

export type FinancialHealthResult = {
  overallScore: number;
  tier: "Excellent" | "Good" | "Fair" | "Needs Attention";
  factors: HealthFactor[];
  aiSuggestions: string[];
};

export function calculateFinancialHealthScore(params: {
  monthlyIncome: number;
  monthlySpend: number;
  netWorth: number;
  debtBalance: number;
  cashBalance: number;
  investmentBalance: number;
  budgetLimit?: number;
  goalsCount?: number;
  activeGoalsAchievedPct?: number;
}): FinancialHealthResult {
  const {
    monthlyIncome = 0, monthlySpend = 0, netWorth = 0,
    debtBalance = 0, cashBalance = 0, investmentBalance = 0,
    budgetLimit = 0, goalsCount = 0, activeGoalsAchievedPct = 50,
  } = params;

  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlySpend) / monthlyIncome) * 100 : 0;
  const savingsRateScore = savingsRate >= 40 ? 100 : savingsRate >= 25 ? 80 : savingsRate >= 10 ? 60 : savingsRate >= 0 ? 40 : 20;

  const monthlyBurn = monthlySpend > 0 ? monthlySpend : 30000;
  const runwayMonths = cashBalance / monthlyBurn;
  const emergencyScore = runwayMonths >= 6 ? 100 : runwayMonths >= 3 ? 75 : runwayMonths >= 1 ? 50 : 25;

  const totalAssets = Math.max(1, netWorth + debtBalance);
  const debtRatio = (debtBalance / totalAssets) * 100;
  const debtScore = debtRatio <= 10 ? 100 : debtRatio <= 30 ? 80 : debtRatio <= 50 ? 60 : 30;

  const invRatio = totalAssets > 0 ? (investmentBalance / totalAssets) * 100 : 0;
  const investmentScore = invRatio >= 50 ? 100 : invRatio >= 30 ? 80 : invRatio >= 15 ? 60 : 30;

  let budgetScore = 75;
  if (budgetLimit > 0) {
    const usage = (monthlySpend / budgetLimit) * 100;
    budgetScore = usage <= 80 ? 100 : usage <= 100 ? 80 : 40;
  }

  const goalScore = goalsCount > 0 ? Math.min(100, Math.max(30, activeGoalsAchievedPct)) : 70;

  const overallScore = Math.min(100, Math.max(0, Math.round(
    savingsRateScore * 0.25 + emergencyScore * 0.2 + debtScore * 0.2 +
    investmentScore * 0.15 + budgetScore * 0.1 + goalScore * 0.1
  )));

  const tier: FinancialHealthResult["tier"] = overallScore >= 85 ? "Excellent" : overallScore >= 70 ? "Good" : overallScore >= 55 ? "Fair" : "Needs Attention";

  const getStatus = (s: number): HealthFactor["status"] => s >= 80 ? "Excellent" : s >= 65 ? "Good" : s >= 50 ? "Fair" : "Attention";

  const factors: HealthFactor[] = [
    { name: "Savings Rate", score: savingsRateScore, weight: 25, status: getStatus(savingsRateScore), description: `Savings rate is ${Math.max(0, savingsRate).toFixed(1)}%.` },
    { name: "Emergency Fund", score: emergencyScore, weight: 20, status: getStatus(emergencyScore), description: `${runwayMonths.toFixed(1)} months of runway.` },
    { name: "Debt Ratio", score: debtScore, weight: 20, status: getStatus(debtScore), description: `Debt-to-Asset ratio is ${debtRatio.toFixed(1)}%.` },
    { name: "Investments", score: investmentScore, weight: 15, status: getStatus(investmentScore), description: `${invRatio.toFixed(1)}% allocated to growth assets.` },
    { name: "Budget Control", score: budgetScore, weight: 10, status: getStatus(budgetScore), description: budgetLimit > 0 ? "Spending within targets." : "Set budget targets." },
    { name: "Goal Progress", score: Math.round(goalScore), weight: 10, status: getStatus(goalScore), description: `${goalsCount} financial goals active.` },
  ];

  const aiSuggestions: string[] = [];
  if (debtRatio <= 15) aiSuggestions.push("Your debt is low. Maintaining minimal leverage accelerates compounding.");
  else aiSuggestions.push("Consider prepaying high-interest debt to improve your overall debt ratio.");

  if (savingsRate < 25) aiSuggestions.push("Increase your mutual fund SIP by ₹5,000 for better long-term growth.");
  else aiSuggestions.push("Great savings momentum! Maintain systematic investments across asset classes.");

  if (runwayMonths < 6) aiSuggestions.push(`Build your emergency fund to 6 months (target: ₹${(monthlyBurn * 6).toLocaleString()}).`);

  return { overallScore, tier, factors, aiSuggestions };
}
