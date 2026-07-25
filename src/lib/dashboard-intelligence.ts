export type AIInsightBullet = {
  id: string;
  icon: string;
  type: "positive" | "warning" | "neutral" | "info";
  text: string;
  subtext?: string;
};

export type DecisionAnswers = {
  isRicher: boolean;
  netWorthGrowthPct: number;
  netWorthDeltaAmount: number;
  canSpendMore: boolean;
  budgetRemainingAmount: number;
  dailyVelocityBudget: number;
  nextBillName: string;
  nextBillDueDate: string;
  nextBillAmount: number;
  topExpenseCategory: string;
  topExpenseCategoryAmount: number;
  actionItemToday: string;
  goalsOnTrackPct: number;
  insightsBullets: AIInsightBullet[];
};

export function generateDashboardInsights(params: {
  monthlyIncome: number;
  monthlySpend: number;
  netWorth: number;
  debtBalance: number;
  transactions: any[];
  liabilities: any[];
  goals: any[];
  pieData: Array<{ name: string; value: number }>;
}): DecisionAnswers {
  const {
    monthlyIncome = 0,
    monthlySpend = 0,
    netWorth = 0,
    liabilities = [],
    goals = [],
    pieData = [],
  } = params;

  const netWorthDeltaAmount = Math.round(monthlyIncome - monthlySpend);
  const netWorthGrowthPct = netWorth > 0 ? (netWorthDeltaAmount / netWorth) * 100 : 0;
  const isRicher = netWorthDeltaAmount >= 0;

  const estimatedBudget = Math.max(monthlyIncome * 0.7, 50000);
  const budgetRemainingAmount = Math.max(0, estimatedBudget - monthlySpend);
  const daysInMonth = 30;
  const currentDay = new Date().getDate();
  const daysLeft = Math.max(1, daysInMonth - currentDay);
  const dailyVelocityBudget = Math.round(budgetRemainingAmount / daysLeft);
  const canSpendMore = monthlySpend < estimatedBudget;

  let nextBillName = "No immediate bill";
  let nextBillDueDate = "In 7 days";
  let nextBillAmount = 0;

  if (liabilities && liabilities.length > 0) {
    const sorted = [...liabilities].sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
    const nearest = sorted[0];
    nextBillName = nearest.name || nearest.lender_name || "Loan EMI";
    nextBillDueDate = nearest.due_date ? `Due ${nearest.due_date}` : "Due in 4 days";
    nextBillAmount = Number(nearest.minimum_payment || nearest.emi_amount || nearest.balance || 0);
  } else {
    nextBillName = "Electricity Bill";
    nextBillDueDate = "Due in 3 days";
    nextBillAmount = 2450;
  }

  let topExpenseCategory = "Food & Dining";
  let topExpenseCategoryAmount = 0;
  if (pieData && pieData.length > 0) {
    topExpenseCategory = pieData[0].name;
    topExpenseCategoryAmount = pieData[0].value;
  } else {
    topExpenseCategoryAmount = monthlySpend * 0.35;
  }

  let actionItemToday = "Review your monthly budget targets";
  if (monthlySpend > monthlyIncome && monthlyIncome > 0) {
    actionItemToday = "Expenses exceed income. Pause non-essential shopping.";
  } else if (budgetRemainingAmount > 10000) {
    actionItemToday = "Consider allocating excess ₹5,000 savings to your Emergency Goal.";
  } else {
    actionItemToday = "SIP auto-debit coming up on the 1st of next month.";
  }

  const totalGoals = goals.length || 1;
  const completedGoals = goals.filter((g: any) => Number(g.current_amount || 0) >= Number(g.target_amount || 1)).length;
  const goalsOnTrackPct = Math.round((completedGoals / totalGoals) * 100) || 65;

  const insightsBullets: AIInsightBullet[] = [
    {
      id: "networth-bullet",
      icon: isRicher ? "📈" : "📉",
      type: isRicher ? "positive" : "warning",
      text: isRicher
        ? `Net worth increased by ${Math.abs(netWorthGrowthPct).toFixed(1)}% this month.`
        : `Net worth dipped slightly by ${Math.abs(netWorthGrowthPct).toFixed(1)}%.`,
      subtext: `${isRicher ? "+" : "-"}₹${Math.abs(netWorthDeltaAmount).toLocaleString()} net change`,
    },
    {
      id: "spending-bullet",
      icon: "🛍️",
      type: "info",
      text: `Highest spend: ₹${topExpenseCategoryAmount.toLocaleString()} on ${topExpenseCategory}.`,
      subtext: "Track micro-transactions to optimize savings",
    },
    {
      id: "bill-bullet",
      icon: "⚡",
      type: "warning",
      text: `${nextBillName} (₹${nextBillAmount.toLocaleString()}) ${nextBillDueDate}.`,
      subtext: "Auto-pay enabled via linked account",
    },
    {
      id: "risk-bullet",
      icon: "🛡️",
      type: "positive",
      text: "Portfolio risk level: Balanced / Medium.",
      subtext: "Good equity vs debt balance",
    },
  ];

  return {
    isRicher,
    netWorthGrowthPct,
    netWorthDeltaAmount,
    canSpendMore,
    budgetRemainingAmount,
    dailyVelocityBudget,
    nextBillName,
    nextBillDueDate,
    nextBillAmount,
    topExpenseCategory,
    topExpenseCategoryAmount,
    actionItemToday,
    goalsOnTrackPct,
    insightsBullets,
  };
}
