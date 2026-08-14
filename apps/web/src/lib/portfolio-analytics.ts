export type AssetClassItem = {
  key: string;
  name: string;
  value: number;
  percentage: number;
  icon: string;
  color: string;
};

export type PortfolioAnalytics = {
  todayPnL: number;
  todayPnLPct: number;
  totalGain: number;
  totalGainPct: number;
  xirrPct: number;
  bestPerformerName: string;
  bestPerformerGainPct: number;
  worstPerformerName: string;
  worstPerformerGainPct: number;
  assetClasses: AssetClassItem[];
};

export function calculatePortfolioAnalytics(params: {
  stockBalance: number;
  mfBalance: number;
  cashBalance: number;
  forexBalance: number;
  cryptoBalance: number;
  bondBalance: number;
  altBalance: number;
  debtBalance: number;
  totalAssets: number;
  investments?: any[];
  mutualFunds?: any[];
}): PortfolioAnalytics {
  const {
    stockBalance = 0,
    mfBalance = 0,
    cashBalance = 0,
    forexBalance = 0,
    cryptoBalance = 0,
    bondBalance = 0,
    altBalance = 0,
    totalAssets = 1,
    investments = [],
    mutualFunds = [],
  } = params;

  let todayPnL = 0;
  investments.forEach((inv: any) => {
    todayPnL += Number(inv.quantity || 0) * Number(inv.day_change || 0);
  });
  mutualFunds.forEach((mf: any) => {
    todayPnL += Number(mf.units || 0) * Number(mf.day_change || 0);
  });

  let realCostBasis = 0;
  investments.forEach((inv: any) => {
    const qty = Number(inv.quantity || 0);
    const buyPrice = Number(inv.buy_price || inv.current_price || 0);
    realCostBasis += qty * buyPrice;
  });
  mutualFunds.forEach((mf: any) => {
    const units = Number(mf.units || 0);
    const avgNav = Number(mf.avg_nav || mf.current_nav || 0);
    realCostBasis += units * avgNav;
  });

  const totalInvValue = stockBalance + mfBalance + bondBalance + cryptoBalance;
  const todayPnLPct = totalInvValue > 0 ? (todayPnL / totalInvValue) * 100 : 0;

  const costBasis = realCostBasis > 0 ? realCostBasis : totalInvValue;
  const totalGain = Math.max(0, totalInvValue - costBasis);
  const totalGainPct = costBasis > 0 ? (totalGain / costBasis) * 100 : 0;
  const xirrPct = totalGainPct > 0 ? Number(totalGainPct.toFixed(2)) : 0;

  let bestPerformerName = "—";
  let bestPerformerGainPct = 0;
  let worstPerformerName = "—";
  let worstPerformerGainPct = 0;

  if (investments.length > 0) {
    const sorted = [...investments].sort((a: any, b: any) => {
      const pA = ((Number(a.current_price || 0) - Number(a.buy_price || 1)) / Math.max(1, Number(a.buy_price || 1))) * 100;
      const pB = ((Number(b.current_price || 0) - Number(b.buy_price || 1)) / Math.max(1, Number(b.buy_price || 1))) * 100;
      return pB - pA;
    });
    if (sorted[0]?.symbol) {
      bestPerformerName = sorted[0].symbol;
      bestPerformerGainPct = ((Number(sorted[0].current_price || 0) - Number(sorted[0].buy_price || 1)) / Math.max(1, Number(sorted[0].buy_price || 1))) * 100;
    }
    const worst = sorted[sorted.length - 1];
    if (worst?.symbol) {
      worstPerformerName = worst.symbol;
      worstPerformerGainPct = ((Number(worst.current_price || 0) - Number(worst.buy_price || 1)) / Math.max(1, Number(worst.buy_price || 1))) * 100;
    }
  }

  const denominator = Math.max(1, totalAssets);

  const rawClasses = [
    { key: "cash", name: "Cash & Savings", value: cashBalance, icon: "💵", color: "#10b981" },
    { key: "stocks", name: "Indian Stocks", value: stockBalance, icon: "📊", color: "#3b82f6" },
    { key: "mf", name: "Mutual Funds", value: mfBalance, icon: "📈", color: "#8b5cf6" },
    { key: "crypto", name: "Crypto Assets", value: cryptoBalance, icon: "⚡", color: "#f97316" },
    { key: "bonds", name: "Bonds & Debentures", value: bondBalance, icon: "🏛️", color: "#06b6d4" },
    { key: "alt", name: "Alternative Assets", value: altBalance, icon: "🏠", color: "#ec4899" },
    { key: "forex", name: "Forex & International", value: forexBalance, icon: "🌍", color: "#14b8a6" },
  ];

  const assetClasses: AssetClassItem[] = rawClasses.map((item) => ({
    ...item,
    percentage: Number(((item.value / denominator) * 100).toFixed(1)),
  }));

  return {
    todayPnL, todayPnLPct, totalGain, totalGainPct, xirrPct,
    bestPerformerName, bestPerformerGainPct, worstPerformerName, worstPerformerGainPct,
    assetClasses,
  };
}
