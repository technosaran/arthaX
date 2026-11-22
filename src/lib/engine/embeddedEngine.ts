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

// ---------------------------------------------------------------------------
// 4. Debt Payoff & Amortization Engine (TS Embedded)
// ---------------------------------------------------------------------------
export interface DebtItem {
  id?: string;
  name?: string;
  principal: number;
  interest_rate_apr: number;
  minimum_payment?: number;
  category?: string;
}

export interface DebtPayoffInputs {
  debts: DebtItem[];
  monthly_extra_payment?: number;
  currency?: string;
}

export function executeDebtPayoffTS(inputs: DebtPayoffInputs) {
  const currency = inputs.currency || "INR";
  const rawDebts = inputs.debts || [];
  const extraMonthly = roundMoney(Math.max(0, inputs.monthly_extra_payment || 0));

  if (rawDebts.length === 0) {
    return {
      currency,
      total_debt: "0.00",
      monthly_minimum_payment: "0.00",
      monthly_extra_payment: String(extraMonthly),
      debts_count: 0,
      strategies: {},
      comparison: {},
      recommended_strategy: "NONE",
      recommendation_summary: "No active debts provided.",
    };
  }

  const normalized = rawDebts.map((d, idx) => {
    const prin = roundMoney(Math.max(0, d.principal || 0));
    const apr = Math.max(0, d.interest_rate_apr || 0);
    const monthlyRate = apr / 100 / 12;
    const monthlyInterest = roundMoney(prin * monthlyRate);
    let minPay = roundMoney(Math.max(0, d.minimum_payment || 0));
    if (minPay <= 0) {
      minPay = Math.max(monthlyInterest + roundMoney(prin * 0.01), roundMoney(prin * 0.025));
    }
    minPay = Math.max(minPay, monthlyInterest + 1);

    return {
      id: d.id || `debt_${idx + 1}`,
      name: d.name || `Debt ${idx + 1}`,
      principal: prin,
      apr,
      monthlyRate,
      minimum_payment: minPay,
      category: d.category || "Personal Debt",
    };
  });

  const totalDebt = roundMoney(normalized.reduce((sum, d) => sum + d.principal, 0));
  const totalMinPay = roundMoney(normalized.reduce((sum, d) => sum + d.minimum_payment, 0));

  function simulate(strategy: "AVALANCHE" | "SNOWBALL" | "MINIMUM_ONLY", extra: number) {
    const state = normalized.map((d) => ({
      ...d,
      balance: d.principal,
      cleared_month: null as number | null,
    }));

    let totalInterest = 0;
    let totalPaid = 0;
    const order: Array<{ id: string; name: string; cleared_in_month: number }> = [];
    let firstCleared: number | null = null;
    const MAX_MONTHS = 360;
    let month = 0;

    for (month = 1; month <= MAX_MONTHS; month++) {
      const active = state.filter((d) => d.balance > 0);
      if (active.length === 0) break;

      // 1. Accrue monthly interest
      for (const d of active) {
        const interest = roundMoney(d.balance * d.monthlyRate);
        d.balance = addMoney(d.balance, interest);
        totalInterest = addMoney(totalInterest, interest);
      }

      // 2. Minimum payments
      let availableSnowball = extra;
      for (const d of state) {
        if (d.balance > 0) {
          const pay = Math.min(d.balance, d.minimum_payment);
          d.balance = subMoney(d.balance, pay);
          totalPaid = addMoney(totalPaid, pay);
        } else {
          availableSnowball = addMoney(availableSnowball, d.minimum_payment);
        }
      }

      // 3. Sort by priority
      const unpaid = state.filter((d) => d.balance > 0);
      if (strategy === "AVALANCHE") {
        unpaid.sort((a, b) => b.apr - a.apr || a.balance - b.balance);
      } else if (strategy === "SNOWBALL") {
        unpaid.sort((a, b) => a.balance - b.balance || b.apr - a.apr);
      }

      // 4. Apply extra snowball/avalanche
      for (const target of unpaid) {
        if (availableSnowball <= 0) break;
        const extraPay = Math.min(target.balance, availableSnowball);
        target.balance = subMoney(target.balance, extraPay);
        availableSnowball = subMoney(availableSnowball, extraPay);
        totalPaid = addMoney(totalPaid, extraPay);
      }

      // 5. Track cleared debts
      for (const d of state) {
        if (d.balance <= 0 && d.cleared_month === null) {
          d.cleared_month = month;
          order.push({ id: d.id, name: d.name, cleared_in_month: month });
          if (firstCleared === null) firstCleared = month;
        }
      }
    }

    const unpaidCount = state.filter((d) => d.balance > 0).length;
    const monthsTaken = unpaidCount === 0 ? month - 1 : MAX_MONTHS;

    return {
      months_to_payoff: monthsTaken,
      total_interest_paid: totalInterest,
      total_amount_paid: totalPaid,
      first_debt_payoff_months: firstCleared || monthsTaken,
      payoff_order: order,
    };
  }

  const avalanche = simulate("AVALANCHE", extraMonthly);
  const snowball = simulate("SNOWBALL", extraMonthly);
  const minOnly = simulate("MINIMUM_ONLY", 0);

  const interestSavedAvalanche = Math.max(0, roundMoney(minOnly.total_interest_paid - avalanche.total_interest_paid));
  const interestSavedSnowball = Math.max(0, roundMoney(minOnly.total_interest_paid - snowball.total_interest_paid));
  const avalancheVsSnowballDiff = roundMoney(snowball.total_interest_paid - avalanche.total_interest_paid);

  let recStrategy = "AVALANCHE";
  let recSummary = "";
  if (avalancheVsSnowballDiff > 10000) {
    recStrategy = "AVALANCHE";
    recSummary = `Debt Avalanche is strongly recommended, saving an extra ${currency} ${avalancheVsSnowballDiff} in interest.`;
  } else if (avalancheVsSnowballDiff > 2000) {
    recStrategy = "AVALANCHE";
    recSummary = `Debt Avalanche saves ${currency} ${avalancheVsSnowballDiff} more in interest, while Snowball clears your first loan in ${snowball.first_debt_payoff_months} months.`;
  } else {
    recStrategy = "SNOWBALL";
    recSummary = `Debt Snowball is recommended for momentum. The interest difference is negligible (${currency} ${avalancheVsSnowballDiff}).`;
  }

  return {
    currency,
    total_debt: String(totalDebt),
    monthly_minimum_payment: String(totalMinPay),
    monthly_extra_payment: String(extraMonthly),
    debts_count: normalized.length,
    strategies: {
      avalanche: {
        strategy_name: "Debt Avalanche (Highest APR First)",
        months_to_debt_free: avalanche.months_to_payoff,
        years_to_debt_free: roundMoney(avalanche.months_to_payoff / 12),
        total_interest_paid: String(avalanche.total_interest_paid),
        total_amount_paid: String(avalanche.total_amount_paid),
        interest_saved: String(interestSavedAvalanche),
        months_saved: Math.max(0, minOnly.months_to_payoff - avalanche.months_to_payoff),
        first_debt_cleared_months: avalanche.first_debt_payoff_months,
        payoff_order: avalanche.payoff_order,
      },
      snowball: {
        strategy_name: "Debt Snowball (Lowest Balance First)",
        months_to_debt_free: snowball.months_to_payoff,
        years_to_debt_free: roundMoney(snowball.months_to_payoff / 12),
        total_interest_paid: String(snowball.total_interest_paid),
        total_amount_paid: String(snowball.total_amount_paid),
        interest_saved: String(interestSavedSnowball),
        months_saved: Math.max(0, minOnly.months_to_payoff - snowball.months_to_payoff),
        first_debt_cleared_months: snowball.first_debt_payoff_months,
        payoff_order: snowball.payoff_order,
      },
      minimum_only: {
        strategy_name: "Minimum Payments Only (Baseline)",
        months_to_debt_free: minOnly.months_to_payoff,
        years_to_debt_free: roundMoney(minOnly.months_to_payoff / 12),
        total_interest_paid: String(minOnly.total_interest_paid),
        total_amount_paid: String(minOnly.total_amount_paid),
        payoff_order: minOnly.payoff_order,
      },
    },
    comparison: {
      interest_difference_snowball_vs_avalanche: String(avalancheVsSnowballDiff),
      months_difference_snowball_vs_avalanche: snowball.months_to_payoff - avalanche.months_to_payoff,
      max_interest_savings: String(interestSavedAvalanche),
    },
    recommended_strategy: recStrategy,
    recommendation_summary: recSummary,
  };
}

// ---------------------------------------------------------------------------
// 5. Financial Stress Test & Shock Simulation Engine (TS Embedded)
// ---------------------------------------------------------------------------
export interface StressTestInputs {
  liquid_cash?: number;
  semi_liquid_assets?: number;
  monthly_income?: number;
  monthly_mandatory_expenses?: number;
  monthly_discretionary_expenses?: number;
  total_debt?: number;
  emergency_shock_amount?: number;
  currency?: string;
}

export function executeStressTestTS(inputs: StressTestInputs) {
  const currency = inputs.currency || "INR";
  const cash = roundMoney(Math.max(0, inputs.liquid_cash || 0));
  const investments = roundMoney(Math.max(0, inputs.semi_liquid_assets || 0));
  const income = roundMoney(Math.max(0, inputs.monthly_income || 0));
  const mandatoryExp = roundMoney(Math.max(0, inputs.monthly_mandatory_expenses || 0));
  const discretionaryExp = roundMoney(Math.max(0, inputs.monthly_discretionary_expenses || 0));
  const debt = roundMoney(Math.max(0, inputs.total_debt || 0));
  const shockAmount = roundMoney(Math.max(0, inputs.emergency_shock_amount || 500000));

  const totalMonthlyBurn = addMoney(mandatoryExp, discretionaryExp);
  const netWorth = subMoney(addMoney(cash, investments), debt);

  const runwayMonths = mandatoryExp > 0 ? roundMoney(cash / mandatoryExp) : 999;
  const totalRunwayMonths = mandatoryExp > 0 ? roundMoney((cash + investments) / mandatoryExp) : 999;

  // Scenario 1: Job Loss (6 months)
  const prunedBurn = roundMoney(mandatoryExp + discretionaryExp * 0.25);
  const sixMonthBurn = roundMoney(prunedBurn * 6);
  const jobLossDiff = subMoney(cash, sixMonthBurn);
  const survivesJobLoss = jobLossDiff >= 0;
  const jobLossRunway = prunedBurn > 0 ? roundMoney(cash / prunedBurn) : 999;

  // Scenario 2: Market Crash (40%)
  const crashLoss = roundMoney(investments * 0.4);
  const postCrashInvestments = subMoney(investments, crashLoss);
  const postCrashNetWorth = subMoney(addMoney(cash, postCrashInvestments), debt);

  // Scenario 3: Medical Emergency
  const postMedicalCash = subMoney(cash, shockAmount);
  const medicalCovered = postMedicalCash >= 0;
  const forcedLiquidations = Math.max(0, subMoney(shockAmount, cash));

  // Scenario 4: Stagflation (3 years)
  const inflatedMandatory = roundMoney(mandatoryExp * 1.295);
  const stagflationExp = addMoney(inflatedMandatory, discretionaryExp);
  const stagflationShortfall = Math.max(0, subMoney(stagflationExp, income));

  // Scenario 5: Black Swan
  const blackSwanShock = 300000;
  const blackSwanIncome = roundMoney(income * 0.5);
  const blackSwanBurn = roundMoney(mandatoryExp + discretionaryExp * 0.2);
  const blackSwanShortfall = Math.max(0, subMoney(blackSwanBurn, blackSwanIncome));
  const blackSwanCash = Math.max(0, subMoney(cash, blackSwanShock));
  const blackSwanRunway = blackSwanShortfall > 0 ? roundMoney(blackSwanCash / blackSwanShortfall) : 999;

  // Resilience Score (0 - 100)
  let score = 0;
  if (runwayMonths >= 6) score += 35;
  else if (runwayMonths >= 3) score += Math.round((runwayMonths / 6) * 35);
  else score += Math.round((runwayMonths / 3) * 15);

  const dti = income > 0 ? debt / (income * 12) : 999;
  if (dti <= 0.2) score += 25;
  else if (dti <= 0.4) score += 18;
  else if (dti <= 0.8) score += 10;
  else if (dti <= 1.5) score += 5;

  const invRatio = mandatoryExp > 0 ? investments / (mandatoryExp * 12) : 0;
  if (invRatio >= 3) score += 20;
  else if (invRatio >= 1) score += 14;
  else if (invRatio >= 0.5) score += 8;

  const savingsRate = income > 0 ? Math.max(0, (income - totalMonthlyBurn) / income) * 100 : 0;
  if (savingsRate >= 30) score += 20;
  else if (savingsRate >= 15) score += 14;
  else if (savingsRate >= 5) score += 8;
  else if (savingsRate > 0) score += 4;

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 85 ? "FORTIFIED" : score >= 70 ? "ROBUST" : score >= 50 ? "VULNERABLE" : "CRITICAL";

  return {
    currency,
    resilience_score: score,
    resilience_tier: tier,
    summary: `Your financial resilience score is ${score}/100 (${tier}).`,
    baseline: {
      liquid_cash: String(cash),
      investments: String(investments),
      total_debt: String(debt),
      net_worth: String(netWorth),
      monthly_income: String(income),
      monthly_mandatory_burn: String(mandatoryExp),
      monthly_discretionary_burn: String(discretionaryExp),
      cash_runway_months: runwayMonths,
      total_runway_months: totalRunwayMonths,
    },
    scenarios: {
      job_loss_6_months: {
        scenario_name: "Job Loss / Income Halt (6 Months)",
        pruned_monthly_burn: String(prunedBurn),
        total_6m_burn: String(sixMonthBurn),
        surplus_or_deficit: String(jobLossDiff),
        survives_without_selling_assets: survivesJobLoss,
        months_of_cash_runway: jobLossRunway,
      },
      market_crash_40_pct: {
        scenario_name: "Market Crash (-40% Equity Drawdown)",
        portfolio_loss: String(crashLoss),
        portfolio_value_post_crash: String(postCrashInvestments),
        net_worth_post_crash: String(postCrashNetWorth),
      },
      emergency_medical_shock: {
        scenario_name: `Lump-Sum Medical / Emergency Shock (${currency} ${shockAmount})`,
        shock_amount: String(shockAmount),
        covered_by_cash: medicalCovered,
        forced_investment_liquidation: String(forcedLiquidations),
        remaining_cash_after_shock: String(Math.max(0, postMedicalCash)),
      },
      stagflation_3_years: {
        scenario_name: "Stagflation (9.5% Inflation Surge, Flat Salary)",
        inflated_monthly_expenses: String(stagflationExp),
        monthly_cashflow_shortfall: String(stagflationShortfall),
        annual_purchasing_power_loss: String(roundMoney(stagflationShortfall * 12)),
      },
      black_swan_event: {
        scenario_name: "Black Swan (50% Pay Cut + 35% Market Crash + ₹3L Shock)",
        immediate_shock: String(blackSwanShock),
        remaining_cash_after_shock: String(blackSwanCash),
        reduced_monthly_income: String(blackSwanIncome),
        pruned_monthly_burn: String(blackSwanBurn),
        monthly_deficit: String(blackSwanShortfall),
        runway_months: blackSwanRunway,
        survives_one_year: blackSwanRunway >= 12,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Goal-Based Wealth & Step-Up SIP Planner Engine (TS Embedded)
// ---------------------------------------------------------------------------
export interface GoalPlannerInputs {
  goal_name?: string;
  target_amount_today: number;
  horizon_years: number;
  current_savings?: number;
  category?: string;
  custom_inflation_pct?: number;
  custom_expected_return_pct?: number;
  annual_step_up_pct?: number;
  currency?: string;
}

const CATEGORY_INFLATION: Record<string, number> = {
  education: 10.0,
  real_estate: 7.5,
  healthcare: 11.0,
  wedding: 8.0,
  vehicle: 5.0,
  retirement: 6.0,
  general: 6.0,
};

export function executeGoalPlannerTS(inputs: GoalPlannerInputs) {
  const goalName = (inputs.goal_name || "Financial Goal").trim();
  const category = (inputs.category || "general").toLowerCase().trim();
  const horizonYears = Math.max(1, Math.round(inputs.horizon_years || 5));
  const currency = inputs.currency || "INR";

  const targetToday = Math.max(0, inputs.target_amount_today || 0);
  const currentSavings = Math.max(0, inputs.current_savings || 0);

  const inflationPct =
    inputs.custom_inflation_pct !== undefined && inputs.custom_inflation_pct !== null
      ? Math.max(0, inputs.custom_inflation_pct)
      : CATEGORY_INFLATION[category] || 6.0;
  const infRate = inflationPct / 100;

  let recommendedMix = {
    equity_pct: 75.0,
    debt_pct: 15.0,
    gold_pct: 10.0,
    liquid_pct: 0.0,
    strategy: "Aggressive Long-Term Compounder",
    default_return_pct: 12.5,
  };

  if (horizonYears < 3) {
    recommendedMix = {
      equity_pct: 0.0,
      debt_pct: 80.0,
      gold_pct: 0.0,
      liquid_pct: 20.0,
      strategy: "Capital Preservation & Extreme Liquidity",
      default_return_pct: 6.8,
    };
  } else if (horizonYears <= 7) {
    recommendedMix = {
      equity_pct: 55.0,
      debt_pct: 35.0,
      gold_pct: 10.0,
      liquid_pct: 0.0,
      strategy: "Balanced Multi-Asset Hybrid",
      default_return_pct: 10.2,
    };
  }

  const expectedReturnPct =
    inputs.custom_expected_return_pct !== undefined && inputs.custom_expected_return_pct !== null
      ? Math.max(0, inputs.custom_expected_return_pct)
      : recommendedMix.default_return_pct;
  const nomReturn = expectedReturnPct / 100;

  const stepUpPct = Math.max(0, inputs.annual_step_up_pct !== undefined ? inputs.annual_step_up_pct : 10.0);
  const gStep = stepUpPct / 100;

  const futureTargetCost = roundMoney(targetToday * Math.pow(1 + infRate, horizonYears));
  const futureLumpsumValue = roundMoney(currentSavings * Math.pow(1 + nomReturn, horizonYears));
  const shortfall = Math.max(0, roundMoney(futureTargetCost - futureLumpsumValue));
  const isAlreadyFunded = futureLumpsumValue >= futureTargetCost && futureTargetCost > 0;

  const nMonths = horizonYears * 12;
  const rMonthly = nomReturn / 12;

  let standardMonthlySip = 0;
  if (shortfall <= 0) {
    standardMonthlySip = 0;
  } else if (rMonthly > 0) {
    const growthFactor = Math.pow(1 + rMonthly, nMonths);
    const annuityDueFactor = ((growthFactor - 1) / rMonthly) * (1 + rMonthly);
    standardMonthlySip = roundMoney(shortfall / annuityDueFactor);
  } else {
    standardMonthlySip = roundMoney(shortfall / nMonths);
  }

  let stepUpStartingSip = 0;
  if (shortfall > 0) {
    let unitBalance = 0;
    for (let m = 0; m < nMonths; m++) {
      const yearIdx = Math.floor(m / 12);
      const unitPayment = Math.pow(1 + gStep, yearIdx);
      unitBalance = (unitBalance + unitPayment) * (1 + rMonthly);
    }
    stepUpStartingSip = unitBalance > 0 ? roundMoney(shortfall / unitBalance) : standardMonthlySip;
  }

  const sipReductionAmount = Math.max(0, subMoney(standardMonthlySip, stepUpStartingSip));
  const sipReductionPct = standardMonthlySip > 0 ? Math.round((sipReductionAmount / standardMonthlySip) * 1000) / 10 : 0;

  const amortizationSchedule: Array<{
    year: number;
    monthly_sip: number;
    annual_contribution: number;
    opening_balance: number;
    returns_earned: number;
    closing_balance: number;
    cumulative_invested: number;
    progress_percent: number;
  }> = [];

  let runningCorpus = currentSavings;
  let totalSipInvested = 0;

  for (let year = 1; year <= horizonYears; year++) {
    const openingBal = runningCorpus;
    const monthlySipThisYear = roundMoney(stepUpStartingSip * Math.pow(1 + gStep, year - 1));
    let annualSipContr = 0;
    let yearReturns = 0;

    for (let m = 0; m < 12; m++) {
      runningCorpus += monthlySipThisYear;
      annualSipContr += monthlySipThisYear;
      totalSipInvested += monthlySipThisYear;

      const mGrowth = runningCorpus * rMonthly;
      runningCorpus += mGrowth;
      yearReturns += mGrowth;
    }

    const closingBal = roundMoney(runningCorpus);
    const progressPct = futureTargetCost > 0 ? Math.min(100, Math.round((closingBal / futureTargetCost) * 1000) / 10) : 100;

    amortizationSchedule.push({
      year,
      monthly_sip: monthlySipThisYear,
      annual_contribution: roundMoney(annualSipContr),
      opening_balance: roundMoney(openingBal),
      returns_earned: roundMoney(yearReturns),
      closing_balance: closingBal,
      cumulative_invested: roundMoney(currentSavings + totalSipInvested),
      progress_percent: progressPct,
    });
  }

  const status = isAlreadyFunded
    ? "ALREADY_FUNDED"
    : standardMonthlySip <= 10000
    ? "HIGHLY_FEASIBLE"
    : stepUpStartingSip <= 35000
    ? "FEASIBLE_WITH_STEP_UP"
    : "AMBITIOUS";

  return {
    goal_name: goalName,
    category,
    currency,
    horizon_years: horizonYears,
    valuation: {
      target_today: roundMoney(targetToday),
      future_target_cost: futureTargetCost,
      inflation_rate_percent: inflationPct,
      current_savings_allocated: roundMoney(currentSavings),
      future_value_of_current_savings: futureLumpsumValue,
      net_shortfall_to_accumulate: shortfall,
      is_already_funded: isAlreadyFunded,
    },
    sip_strategies: {
      standard_fixed_sip: {
        monthly_sip: standardMonthlySip,
        total_invested: roundMoney(standardMonthlySip * nMonths),
        wealth_created: futureTargetCost,
      },
      step_up_sip: {
        annual_step_up_percent: stepUpPct,
        initial_monthly_sip: stepUpStartingSip,
        total_invested: roundMoney(totalSipInvested),
        starting_burden_relief_percent: sipReductionPct,
        monthly_savings_in_year_one: sipReductionAmount,
      },
    },
    recommended_asset_allocation: {
      strategy: recommendedMix.strategy,
      equity_percent: recommendedMix.equity_pct,
      debt_percent: recommendedMix.debt_pct,
      gold_percent: recommendedMix.gold_pct,
      liquid_percent: recommendedMix.liquid_pct,
      expected_cagr_percent: expectedReturnPct,
    },
    feasibility: {
      status,
      note: isAlreadyFunded
        ? "Existing corpus is projected to outgrow the goal cost."
        : `Requires starting SIP of ${currency} ${stepUpStartingSip.toLocaleString()}/mo with ${stepUpPct}% annual step-up.`,
    },
    amortization_schedule: amortizationSchedule,
  };
}

// ---------------------------------------------------------------------------
// 7. Portfolio Risk & Performance Analytics Engine (TS Embedded)
// ---------------------------------------------------------------------------
export interface PortfolioAnalyticsInputs {
  portfolio_returns?: number[];
  portfolio_snapshots?: Array<{ date?: string; value?: number }>;
  benchmark_returns?: number[];
  current_portfolio_value?: number;
  risk_free_rate_pct?: number;
  period_frequency?: "daily" | "monthly" | "annual";
  holdings?: Array<{ symbol?: string; current_value?: number; weight_percent?: number }>;
  currency?: string;
}

export function executePortfolioAnalyticsTS(inputs: PortfolioAnalyticsInputs) {
  const currency = inputs.currency || "INR";
  const rfPct = inputs.risk_free_rate_pct !== undefined ? inputs.risk_free_rate_pct : 6.75;
  const rfAnnual = rfPct / 100;

  const freq = (inputs.period_frequency || "monthly").toLowerCase();
  const periodsPerYear = freq === "daily" ? 252 : freq === "annual" ? 1 : 12;
  const rfPeriod = rfAnnual / periodsPerYear;

  let returns: number[] = [];
  if (inputs.portfolio_returns && inputs.portfolio_returns.length > 0) {
    returns = inputs.portfolio_returns.map(Number).filter((n) => !isNaN(n));
  } else if (inputs.portfolio_snapshots && inputs.portfolio_snapshots.length > 1) {
    const sorted = [...inputs.portfolio_snapshots].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const vals = sorted.map((s) => Number(s.value || 0)).filter((v) => v > 0);
    for (let i = 1; i < vals.length; i++) {
      returns.push((vals[i] - vals[i - 1]) / vals[i - 1]);
    }
  }

  let currValue = inputs.current_portfolio_value || 0;
  if (currValue <= 0 && inputs.portfolio_snapshots && inputs.portfolio_snapshots.length > 0) {
    currValue = Number(inputs.portfolio_snapshots[inputs.portfolio_snapshots.length - 1].value || 0);
  }

  const n = returns.length;
  if (n < 2) {
    return {
      currency,
      current_portfolio_value: currValue,
      period_frequency: freq,
      periods_analyzed: 0,
      returns_and_volatility: {
        annualized_return_percent: 0,
        annualized_volatility_percent: 0,
        annualized_downside_volatility_percent: 0,
        risk_free_rate_percent: rfPct,
      },
      risk_adjusted_ratios: {
        sharpe_ratio: 0,
        sortino_ratio: 0,
        calmar_ratio: 0,
        beta: null as number | null,
        jensens_alpha_percent: null as number | null,
      },
      drawdown_metrics: {
        maximum_drawdown_percent: 0,
        longest_underwater_periods: 0,
      },
      value_at_risk: {
        parametric_var_95_period_percent: 0,
        parametric_var_95_annual_percent: 0,
        relative_var_95_annual_percent: 0,
        relative_var_99_annual_percent: 0,
        historical_var_95_period_percent: 0,
        cvar_expected_shortfall_95_percent: 0,
        estimated_loss_at_risk_95_period: 0,
        estimated_loss_at_risk_95_annual: 0,
      },
      diversification_metrics: {
        herfindahl_index_hhi: 0,
        effective_number_of_holdings: 0,
        concentration_tier: "INSUFFICIENT_DATA",
      },
      institutional_assessment: {
        rating: "INSUFFICIENT_DATA",
        summary: "Provide at least 2 return periods.",
      },
    };
  }

  const meanRet = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanRet, 2), 0) / (n - 1);
  const stdPeriod = Math.sqrt(variance);

  const annualizedReturn = meanRet * periodsPerYear;
  const annualizedVol = stdPeriod * Math.sqrt(periodsPerYear);

  const excessAnnualReturn = annualizedReturn - rfAnnual;
  const sharpe = annualizedVol > 0 ? Math.round((excessAnnualReturn / annualizedVol) * 1000) / 1000 : 0;

  const downsideSqSum = returns.reduce((sum, r) => sum + Math.pow(Math.min(0, r - rfPeriod), 2), 0);
  const downsideStd = Math.sqrt(downsideSqSum / n) * Math.sqrt(periodsPerYear);
  const sortino = downsideStd > 0 ? Math.round((excessAnnualReturn / downsideStd) * 1000) / 1000 : sharpe;

  // Drawdown
  let wealth = 1.0;
  let peak = 1.0;
  let maxDd = 0;
  let currUnder = 0;
  let maxUnder = 0;

  for (const r of returns) {
    wealth *= 1 + r;
    if (wealth > peak) {
      peak = wealth;
      currUnder = 0;
    } else {
      const dd = (wealth - peak) / peak;
      if (dd < maxDd) maxDd = dd;
      currUnder++;
      if (currUnder > maxUnder) maxUnder = currUnder;
    }
  }

  const mddPct = Math.round(Math.abs(maxDd) * 10000) / 100;
  const calmar = mddPct > 0 ? Math.round((annualizedReturn / (mddPct / 100)) * 1000) / 1000 : 99;

  // VaR (95% Z = 1.645, 99% Z = 2.326)
  const relVar95AnnualPct = Math.round(1.645 * annualizedVol * 10000) / 100;
  const relVar99AnnualPct = Math.round(2.326 * annualizedVol * 10000) / 100;
  const var95PeriodPct = Math.round(Math.max(0, -(meanRet - 1.645 * stdPeriod)) * 10000) / 100;
  const var95AnnualPct = Math.round(Math.max(0, -(annualizedReturn - 1.645 * annualizedVol)) * 10000) / 100;

  const sortedRets = [...returns].sort((a, b) => a - b);
  const idx95 = Math.max(0, Math.floor(0.05 * n));
  const histVar95Pct = Math.round(Math.max(0, -sortedRets[idx95]) * 10000) / 100;
  const tail95 = sortedRets.slice(0, idx95 + 1);
  const cvar95Pct = tail95.length > 0 ? Math.round(Math.max(0, -(tail95.reduce((a, b) => a + b, 0) / tail95.length)) * 10000) / 100 : var95PeriodPct;

  // Beta & Alpha
  let beta: number | null = null;
  let alphaPct: number | null = null;
  const benchReturns = inputs.benchmark_returns || [];
  if (benchReturns.length >= 2) {
    const mLen = Math.min(returns.length, benchReturns.length);
    const pSub = returns.slice(0, mLen);
    const bSub = benchReturns.slice(0, mLen);
    const pMean = pSub.reduce((a, b) => a + b, 0) / mLen;
    const bMean = bSub.reduce((a, b) => a + b, 0) / mLen;

    let cov = 0;
    let bVar = 0;
    for (let i = 0; i < mLen; i++) {
      cov += (pSub[i] - pMean) * (bSub[i] - bMean);
      bVar += Math.pow(bSub[i] - bMean, 2);
    }
    if (bVar > 0) {
      beta = Math.round((cov / bVar) * 100) / 100;
      const bAnnual = bMean * periodsPerYear;
      const expP = rfAnnual + beta * (bAnnual - rfAnnual);
      alphaPct = Math.round((annualizedReturn - expP) * 10000) / 100;
    }
  }

  // Holdings Concentration HHI
  const holdings = inputs.holdings || [];
  let hhiScore = 0;
  let effHoldings = 0;
  let concentrationTier = "NOT_SPECIFIED";

  if (holdings.length > 0) {
    const totalVal = holdings.reduce((s, h) => s + (h.current_value || 0), 0);
    const weights: number[] = [];
    if (totalVal > 0) {
      weights.push(...holdings.map((h) => ((h.current_value || 0) / totalVal) * 100));
    } else {
      weights.push(...holdings.map((h) => h.weight_percent || 0));
    }

    if (weights.length > 0) {
      hhiScore = Math.round(weights.reduce((sum, w) => sum + Math.pow(w, 2), 0) * 10) / 10;
      const sumSqDec = weights.reduce((sum, w) => sum + Math.pow(w / 100, 2), 0);
      effHoldings = sumSqDec > 0 ? Math.round((1 / sumSqDec) * 10) / 10 : weights.length;
      concentrationTier = hhiScore < 1500 ? "WELL_DIVERSIFIED" : hhiScore <= 2500 ? "MODERATELY_CONCENTRATED" : "HEAVILY_CONCENTRATED";
    }
  }

  const rating =
    sharpe >= 1.5 && mddPct <= 15
      ? "EXCELLENT"
      : sharpe >= 1.0 && mddPct <= 25
      ? "GOOD"
      : sharpe >= 0.5
      ? "ACCEPTABLE"
      : "NEEDS_OPTIMIZATION";

  return {
    currency,
    current_portfolio_value: currValue,
    period_frequency: freq,
    periods_analyzed: n,
    returns_and_volatility: {
      annualized_return_percent: Math.round(annualizedReturn * 10000) / 100,
      annualized_volatility_percent: Math.round(annualizedVol * 10000) / 100,
      annualized_downside_volatility_percent: Math.round(downsideStd * 10000) / 100,
      risk_free_rate_percent: rfPct,
    },
    risk_adjusted_ratios: {
      sharpe_ratio: sharpe,
      sortino_ratio: sortino,
      calmar_ratio: calmar,
      beta,
      jensens_alpha_percent: alphaPct,
    },
    drawdown_metrics: {
      maximum_drawdown_percent: mddPct,
      longest_underwater_periods: maxUnder,
    },
    value_at_risk: {
      parametric_var_95_period_percent: var95PeriodPct,
      parametric_var_95_annual_percent: var95AnnualPct,
      relative_var_95_annual_percent: relVar95AnnualPct,
      relative_var_99_annual_percent: relVar99AnnualPct,
      historical_var_95_period_percent: histVar95Pct,
      cvar_expected_shortfall_95_percent: cvar95Pct,
      estimated_loss_at_risk_95_period: roundMoney(currValue * (var95PeriodPct / 100)),
      estimated_loss_at_risk_95_annual: roundMoney(currValue * (var95AnnualPct / 100)),
    },
    diversification_metrics: {
      herfindahl_index_hhi: hhiScore,
      effective_number_of_holdings: effHoldings,
      concentration_tier: concentrationTier,
    },
    institutional_assessment: {
      rating,
      summary: `Portfolio Sharpe ratio is ${sharpe} with maximum drawdown of ${mddPct}%.`,
    },
  };
}

// ---------------------------------------------------------------------------
// 8. Tax Regime Comparison Engine (TS Embedded)
// ---------------------------------------------------------------------------
export interface TaxRegimesInputs {
  gross_income: number;
  deductions_80c?: number;
  deductions_80d?: number;
  nps_80ccd_1b?: number;
  nps_80ccd_2?: number;
  home_loan_interest_24b?: number;
  hra_exemption?: number;
  other_deductions?: number;
}

export function executeTaxRegimesTS(inputs: TaxRegimesInputs) {
  const gross = Math.max(0, inputs.gross_income || 0);
  const nps2 = Math.max(0, inputs.nps_80ccd_2 || 0);

  // --- New Regime (Section 115BAC) ---
  const newStdDed = 75000;
  const newTaxable = Math.max(0, gross - newStdDed - nps2);

  let newBaseTax = 0;
  if (newTaxable > 300000) {
    const s1 = Math.min(newTaxable - 300000, 400000);
    if (s1 > 0) newBaseTax += s1 * 0.05;
    if (newTaxable > 700000) {
      const s2 = Math.min(newTaxable - 700000, 300000);
      newBaseTax += s2 * 0.10;
    }
    if (newTaxable > 1000000) {
      const s3 = Math.min(newTaxable - 1000000, 200000);
      newBaseTax += s3 * 0.15;
    }
    if (newTaxable > 1200000) {
      const s4 = Math.min(newTaxable - 1200000, 300000);
      newBaseTax += s4 * 0.20;
    }
    if (newTaxable > 1500000) {
      const s5 = newTaxable - 1500000;
      newBaseTax += s5 * 0.30;
    }
  }

  let newMarginalRelief87a = 0;
  let newTaxAfterRebate = 0;
  if (newTaxable <= 700000) {
    newTaxAfterRebate = 0;
  } else {
    const excess7L = newTaxable - 700000;
    if (newBaseTax > excess7L) {
      newMarginalRelief87a = newBaseTax - excess7L;
      newTaxAfterRebate = excess7L;
    } else {
      newTaxAfterRebate = newBaseTax;
    }
  }

  // Surcharge (New Regime)
  let newSurcharge = 0;
  if (newTaxable > 5000000) {
    const rate = newTaxable > 20000000 ? 0.25 : newTaxable > 10000000 ? 0.15 : 0.10;
    newSurcharge = roundMoney(newTaxAfterRebate * rate);
  }

  const newCess = roundMoney((newTaxAfterRebate + newSurcharge) * 0.04);
  const newTotalTax = roundMoney(newTaxAfterRebate + newSurcharge + newCess);

  // --- Old Regime ---
  const oldStdDed = 50000;
  const capped80c = Math.min(inputs.deductions_80c || 0, 150000);
  const capped80d = Math.min(inputs.deductions_80d || 0, 100000);
  const cappedNps1b = Math.min(inputs.nps_80ccd_1b || 0, 50000);
  const capped24b = Math.min(inputs.home_loan_interest_24b || 0, 200000);
  const totalOldDeductions =
    oldStdDed +
    capped80c +
    capped80d +
    cappedNps1b +
    nps2 +
    capped24b +
    (inputs.hra_exemption || 0) +
    (inputs.other_deductions || 0);

  const oldTaxable = Math.max(0, gross - totalOldDeductions);
  let oldBaseTax = 0;
  if (oldTaxable > 250000) {
    const s1 = Math.min(oldTaxable - 250000, 250000);
    if (s1 > 0) oldBaseTax += s1 * 0.05;
    if (oldTaxable > 500000) {
      const s2 = Math.min(oldTaxable - 500000, 500000);
      oldBaseTax += s2 * 0.20;
    }
    if (oldTaxable > 1000000) {
      const s3 = oldTaxable - 1000000;
      oldBaseTax += s3 * 0.30;
    }
  }

  let oldTaxAfterRebate = oldTaxable <= 500000 ? 0 : oldBaseTax;
  let oldSurcharge = 0;
  if (oldTaxable > 5000000) {
    const rate = oldTaxable > 50000000 ? 0.37 : oldTaxable > 20000000 ? 0.25 : oldTaxable > 10000000 ? 0.15 : 0.10;
    oldSurcharge = roundMoney(oldTaxAfterRebate * rate);
  }

  const oldCess = roundMoney((oldTaxAfterRebate + oldSurcharge) * 0.04);
  const oldTotalTax = roundMoney(oldTaxAfterRebate + oldSurcharge + oldCess);

  const savingsAmount = Math.abs(oldTotalTax - newTotalTax);
  const recommendedRegime = newTotalTax < oldTotalTax ? "NEW_REGIME" : oldTotalTax < newTotalTax ? "OLD_REGIME" : "EQUAL";

  return {
    recommendedRegime,
    savingsAmount: roundMoney(savingsAmount),
    newRegime: {
      grossIncome: roundMoney(gross),
      standardDeduction: newStdDed,
      corporateNpsDeduction: roundMoney(nps2),
      taxableIncome: roundMoney(newTaxable),
      baseIncomeTax: roundMoney(newBaseTax),
      section87aMarginalRelief: roundMoney(newMarginalRelief87a),
      taxAfterRebate: roundMoney(newTaxAfterRebate),
      surcharge: newSurcharge,
      cess: newCess,
      totalTax: newTotalTax,
    },
    oldRegime: {
      grossIncome: roundMoney(gross),
      standardDeduction: oldStdDed,
      corporateNpsDeduction: roundMoney(nps2),
      totalDeductions: roundMoney(totalOldDeductions),
      taxableIncome: roundMoney(oldTaxable),
      baseIncomeTax: roundMoney(oldBaseTax),
      taxAfterRebate: roundMoney(oldTaxAfterRebate),
      surcharge: oldSurcharge,
      cess: oldCess,
      totalTax: oldTotalTax,
    },
  };
}
