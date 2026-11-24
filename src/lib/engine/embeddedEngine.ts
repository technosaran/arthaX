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
// 2. Tax Regime Comparison Engine (TS Embedded)
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

  const oldTaxAfterRebate = oldTaxable <= 500000 ? 0 : oldBaseTax;
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
