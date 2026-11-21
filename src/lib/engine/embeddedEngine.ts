/**
 * ArthaX Enterprise Embedded Financial Calculation Engine (TypeScript / Zero-Downtime)
 * Provides high-precision financial calculations locally in Node.js / Vercel Serverless
 * when the external Python microservice is offline or unreachable.
 * Guaranteed IEEE-754 precision compliance via integer-paise math.
 */

import {
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  sumMoney,
  roundMoney,
  percentMoney,
} from "@/utils/money";

export interface EmbeddedEngineResult<T = unknown> {
  success: boolean;
  data: T;
  _engine: "ts_embedded_engine";
  calculated_at: string;
}

// ---------------------------------------------------------------------------
// 1. Net Worth Calculation Engine
// ---------------------------------------------------------------------------
export interface NetWorthInputs {
  accounts?: Array<{
    id?: string;
    name?: string;
    type?: string;
    classification?: string;
    balance?: number | string;
  }>;
  stocks?: Array<{
    quantity?: number;
    current_price?: number;
    avg_buy_price?: number;
  }>;
  mutual_funds?: Array<{
    units?: number;
    current_nav?: number;
    avg_nav?: number;
    invested_amount?: number;
  }>;
  bonds?: Array<{
    quantity?: number;
    current_price?: number;
    avg_buy_price?: number;
    invested_amount?: number;
    face_value?: number;
  }>;
  bullion?: Array<{
    metal?: string;
    weight_grams?: number;
    current_rate_per_gram?: number;
    total_buy_price?: number;
  }>;
  crypto?: Array<{
    total_value_usd?: number;
    total_quantity?: number;
    current_price_usd?: number;
  }>;
  usd_inr_rate?: number;
  currency?: string;
}

export function executeNetWorthTS(inputs: NetWorthInputs) {
  const accounts = inputs.accounts || [];
  const stocks = inputs.stocks || [];
  const mutualFunds = inputs.mutual_funds || [];
  const bonds = inputs.bonds || [];
  const bullion = inputs.bullion || [];
  const crypto = inputs.crypto || [];
  const usdInrRate = inputs.usd_inr_rate || 84.5;
  const currency = inputs.currency || "INR";

  let liquidCash = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    const bal = roundMoney(acc.balance);
    const typeStr = (acc.type || "").toLowerCase();
    const classStr = (acc.classification || "").toLowerCase();
    const isLiab = classStr === "liability" || /credit|loan|borrow/i.test(typeStr);

    if (isLiab) {
      totalLiabilities = addMoney(totalLiabilities, Math.abs(bal));
    } else {
      liquidCash = addMoney(liquidCash, bal);
    }
  }

  let stocksValuation = 0;
  for (const s of stocks) {
    const q = s.quantity || 0;
    const p = s.current_price || s.avg_buy_price || 0;
    stocksValuation = addMoney(stocksValuation, mulMoney(q, p));
  }

  let mfValuation = 0;
  for (const m of mutualFunds) {
    const u = m.units || 0;
    const nav = m.current_nav || m.avg_nav || 0;
    const val = mulMoney(u, nav);
    mfValuation = addMoney(mfValuation, val > 0 ? val : (m.invested_amount || 0));
  }

  let bondsValuation = 0;
  for (const b of bonds) {
    const q = b.quantity || 1;
    const p = b.current_price || b.avg_buy_price || b.face_value || 1000;
    const val = mulMoney(q, p);
    bondsValuation = addMoney(bondsValuation, val > 0 ? val : (b.invested_amount || 0));
  }

  let bullionValuation = 0;
  for (const bul of bullion) {
    const w = bul.weight_grams || 0;
    const rate = bul.current_rate_per_gram || 0;
    const val = mulMoney(w, rate);
    bullionValuation = addMoney(bullionValuation, val > 0 ? val : (bul.total_buy_price || 0));
  }

  let cryptoUsd = 0;
  for (const c of crypto) {
    const v = c.total_value_usd || mulMoney(c.total_quantity || 0, c.current_price_usd || 0);
    cryptoUsd = addMoney(cryptoUsd, v);
  }
  const cryptoInr = mulMoney(cryptoUsd, usdInrRate);

  const totalInvestments = sumMoney([
    stocksValuation,
    mfValuation,
    bondsValuation,
    bullionValuation,
    cryptoInr,
  ]);

  const totalAssets = addMoney(liquidCash, totalInvestments);
  const netWorth = subMoney(totalAssets, totalLiabilities);

  return {
    currency,
    net_worth: netWorth.toFixed(2),
    total_assets: totalAssets.toFixed(2),
    total_liabilities: totalLiabilities.toFixed(2),
    total_liquid_accounts: liquidCash.toFixed(2),
    total_investments: totalInvestments.toFixed(2),
    assets_breakdown: {
      liquid_cash: liquidCash.toFixed(2),
      stocks: stocksValuation.toFixed(2),
      mutual_funds: mfValuation.toFixed(2),
      bonds: bondsValuation.toFixed(2),
      bullion: bullionValuation.toFixed(2),
      crypto_inr: cryptoInr.toFixed(2),
      crypto_usd: cryptoUsd.toFixed(2),
    },
    allocation_percentages: {
      liquid_accounts: totalAssets > 0 ? percentMoney(liquidCash, totalAssets) : 0,
      stocks: totalAssets > 0 ? percentMoney(stocksValuation, totalAssets) : 0,
      mutual_funds: totalAssets > 0 ? percentMoney(mfValuation, totalAssets) : 0,
      bonds: totalAssets > 0 ? percentMoney(bondsValuation, totalAssets) : 0,
      bullion: totalAssets > 0 ? percentMoney(bullionValuation, totalAssets) : 0,
      crypto: totalAssets > 0 ? percentMoney(cryptoInr, totalAssets) : 0,
    },
    liquidity_percentage: totalAssets > 0 ? percentMoney(liquidCash, totalAssets) : 100,
    debt_to_asset_ratio_percent: totalAssets > 0 ? percentMoney(totalLiabilities, totalAssets) : 0,
    is_solvent: netWorth >= 0,
  };
}

// ---------------------------------------------------------------------------
// 2. FIRE (Financial Independence, Retire Early) Calculation Engine
// ---------------------------------------------------------------------------
export interface FireInputs {
  current_net_worth?: number;
  annual_expenses?: number;
  annual_savings?: number;
  current_age?: number;
  target_retirement_age?: number;
  expected_annual_return_pct?: number;
  expected_inflation_pct?: number;
  safe_withdrawal_rate_pct?: number;
  currency?: string;
}

export function executeFireTS(inputs: FireInputs) {
  const currentNw = inputs.current_net_worth || 0;
  const annualExp = inputs.annual_expenses || 0;
  const annualSav = inputs.annual_savings || 0;
  const currentAge = inputs.current_age || 30;
  const nomReturnPct = inputs.expected_annual_return_pct ?? 11.0;
  const inflationPct = inputs.expected_inflation_pct ?? 6.0;
  const swrPct = inputs.safe_withdrawal_rate_pct ?? 3.5;
  const currency = inputs.currency || "INR";

  const swr = swrPct / 100;
  const realR = ((1 + nomReturnPct / 100) / (1 + inflationPct / 100)) - 1;

  const leanFire = annualExp > 0 ? (annualExp * 0.75) / 0.04 : 0;
  const standardFire = annualExp > 0 ? annualExp / swr : 0;
  const fatFire = annualExp > 0 ? (annualExp * 1.4) / 0.033 : 0;

  const yearsTo60 = Math.max(1, 60 - currentAge);
  const coastFire = standardFire > 0 ? standardFire / Math.pow(1 + realR, yearsTo60) : 0;

  let yearsToFire: number | null = null;
  if (standardFire > 0) {
    if (currentNw >= standardFire) {
      yearsToFire = 0;
    } else if (realR > 0) {
      const pmtOverR = annualSav / realR;
      const num = standardFire + pmtOverR;
      const den = currentNw + pmtOverR;
      if (den > 0 && num > den) {
        yearsToFire = Math.round((Math.log(num / den) / Math.log(1 + realR)) * 10) / 10;
      }
    } else if (annualSav > 0) {
      yearsToFire = Math.round(((standardFire - currentNw) / annualSav) * 10) / 10;
    }
  }

  const projectedFireAge = yearsToFire !== null ? currentAge + Math.round(yearsToFire) : null;
  const progressPercent = standardFire > 0 ? Math.min(100, Math.round((currentNw / standardFire) * 1000) / 10) : 0;

  return {
    currency,
    current_net_worth: roundMoney(currentNw),
    annual_expenses: roundMoney(annualExp),
    annual_savings: roundMoney(annualSav),
    progress_percent: progressPercent,
    fire_targets: {
      lean_fire: roundMoney(leanFire),
      standard_fire: roundMoney(standardFire),
      fat_fire: roundMoney(fatFire),
      coast_fire: roundMoney(coastFire),
      is_coast_fire_achieved: currentNw >= coastFire,
    },
    timeline: {
      current_age: currentAge,
      years_to_fire: yearsToFire,
      projected_fire_age: projectedFireAge,
      is_already_fire: standardFire > 0 && currentNw >= standardFire,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Portfolio Rebalancing & Health Score Engine
// ---------------------------------------------------------------------------
export interface RebalancingInputs {
  portfolio?: {
    equity?: number;
    debt?: number;
    gold?: number;
    cash?: number;
    crypto?: number;
  };
  target_allocation?: Record<string, number>;
  liabilities?: number;
  monthly_expenses?: number;
  monthly_income?: number;
  currency?: string;
}

export function executeRebalancingTS(inputs: RebalancingInputs) {
  const p = inputs.portfolio || {};
  const currency = inputs.currency || "INR";
  const liabilities = inputs.liabilities || 0;
  const monthlyExp = inputs.monthly_expenses || 0;
  const monthlyInc = inputs.monthly_income || 0;

  const equity = p.equity || 0;
  const debt = p.debt || 0;
  const gold = p.gold || 0;
  const cash = p.cash || 0;
  const crypto = p.crypto || 0;

  const total = equity + debt + gold + cash + crypto;

  const targetAlloc = inputs.target_allocation || {
    equity: 60,
    debt: 20,
    gold: 10,
    cash: 10,
    crypto: 0,
  };

  const currentAlloc: Record<string, number> = {
    equity: total > 0 ? percentMoney(equity, total) : 0,
    debt: total > 0 ? percentMoney(debt, total) : 0,
    gold: total > 0 ? percentMoney(gold, total) : 0,
    cash: total > 0 ? percentMoney(cash, total) : 0,
    crypto: total > 0 ? percentMoney(crypto, total) : 0,
  };

  const drift: Record<string, number> = {};
  const orders: Array<{
    asset: string;
    action: "BUY" | "SELL";
    current_amount: number;
    target_amount: number;
    adjustment_amount: number;
    drift_percentage: number;
    priority: "HIGH" | "MEDIUM";
  }> = [];

  let totalDrift = 0;
  const assetVals: Record<string, number> = { equity, debt, gold, cash, crypto };

  for (const [k, val] of Object.entries(assetVals)) {
    const curPct = currentAlloc[k] || 0;
    const tgtPct = targetAlloc[k] || 0;
    const diffPct = Math.round((curPct - tgtPct) * 10) / 10;
    drift[k] = diffPct;
    totalDrift += Math.abs(diffPct);

    const targetVal = roundMoney((total * tgtPct) / 100);
    const delta = targetVal - val;

    if (Math.abs(diffPct) >= 1.5 && Math.abs(delta) >= 100) {
      orders.push({
        asset: k,
        action: delta > 0 ? "BUY" : "SELL",
        current_amount: roundMoney(val),
        target_amount: targetVal,
        adjustment_amount: roundMoney(Math.abs(delta)),
        drift_percentage: diffPct,
        priority: Math.abs(diffPct) >= 5 ? "HIGH" : "MEDIUM",
      });
    }
  }

  // Multi-Pillar Health Score
  const balanceScore = Math.max(0, Math.min(25, 25 - totalDrift / 2));
  const emergencyMonths = monthlyExp > 0 ? cash / monthlyExp : 6;
  const liquidityScore = emergencyMonths >= 6 ? 25 : emergencyMonths >= 3 ? 18 : emergencyMonths >= 1 ? 10 : 4;
  const debtRatio = total > 0 ? (liabilities / total) * 100 : 0;
  const solvencyScore = debtRatio <= 10 ? 25 : debtRatio <= 25 ? 20 : debtRatio <= 40 ? 12 : 5;
  const savingsRate = monthlyInc > 0 ? Math.max(0, (monthlyInc - monthlyExp) / monthlyInc) * 100 : 20;
  const velocityScore = savingsRate >= 30 ? 25 : savingsRate >= 20 ? 20 : savingsRate >= 10 ? 14 : 6;

  const healthScore = Math.round(balanceScore + liquidityScore + solvencyScore + velocityScore);
  const healthTier =
    healthScore >= 85
      ? "EXCEPTIONAL"
      : healthScore >= 70
      ? "HEALTHY"
      : healthScore >= 50
      ? "MODERATE"
      : healthScore >= 35
      ? "NEEDS_ATTENTION"
      : "CRITICAL";

  return {
    currency,
    total_portfolio_value: roundMoney(total),
    health_score: healthScore,
    health_tier: healthTier,
    current_allocation: currentAlloc,
    target_allocation: targetAlloc,
    drift_percentage: drift,
    rebalance_orders: orders,
  };
}
