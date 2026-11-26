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
import {
  TaxRuleOverride,
  TaxSlab,
  calculateProgressiveSlabTax,
  resolveTaxYearPreset,
} from "@/utils/taxRules";

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
// 2. Tax Regime Comparison Engine (TS Embedded — Dynamic FY & Budget Rules)
// ---------------------------------------------------------------------------
export interface TaxRegimesInputs {
  gross_income: number;
  assessment_year?: string;
  custom_rules?: TaxRuleOverride | null;
  deductions_80c?: number;
  deductions_80d?: number;
  nps_80ccd_1b?: number;
  nps_80ccd_2?: number;
  home_loan_interest_24b?: number;
  hra_exemption?: number;
  other_deductions?: number;
}

function computeSurchargeWithMarginalRelief(
  taxableIncome: number,
  baseTax: number,
  slabs: TaxSlab[],
  isNewRegime: boolean
): number {
  if (taxableIncome <= 5000000 || baseTax <= 0) return 0;

  let nominalRate = 0.1;
  let threshold = 5000000;
  let priorSurchargeRateAtThreshold = 0;

  if (taxableIncome <= 10000000) {
    nominalRate = 0.1;
    threshold = 5000000;
    priorSurchargeRateAtThreshold = 0;
  } else if (taxableIncome <= 20000000) {
    nominalRate = 0.15;
    threshold = 10000000;
    priorSurchargeRateAtThreshold = 0.1;
  } else if (taxableIncome <= 50000000) {
    nominalRate = 0.25;
    threshold = 20000000;
    priorSurchargeRateAtThreshold = 0.15;
  } else {
    nominalRate = isNewRegime ? 0.25 : 0.37;
    threshold = 50000000;
    priorSurchargeRateAtThreshold = 0.25;
  }

  const taxAtThreshold = calculateProgressiveSlabTax(threshold, slabs);
  const priorSurcharge = taxAtThreshold * priorSurchargeRateAtThreshold;
  const maxPayable = taxAtThreshold + priorSurcharge + (taxableIncome - threshold);
  const nominalSurcharge = baseTax * nominalRate;
  const totalUnderNominal = baseTax + nominalSurcharge;

  if (totalUnderNominal > maxPayable) {
    const relief = totalUnderNominal - maxPayable;
    return roundMoney(Math.max(0, nominalSurcharge - relief));
  }
  return roundMoney(nominalSurcharge);
}

export function executeTaxRegimesTS(inputs: TaxRegimesInputs) {
  const preset = resolveTaxYearPreset(inputs.assessment_year, inputs.custom_rules);
  const { newRegime: newRules, oldRegime: oldRules } = preset.rules;

  const gross = Math.max(0, inputs.gross_income || 0);
  const nps2 = Math.max(0, inputs.nps_80ccd_2 || 0);

  // --- New Regime (Section 115BAC / Income-tax Act, 2025) ---
  const newStdDed = newRules.standardDeduction;
  const newTaxable = Math.max(0, gross - newStdDed - nps2);
  const newBaseTax = calculateProgressiveSlabTax(newTaxable, newRules.slabs);

  let newRebate87a = 0;
  let newMarginalRelief87a = 0;
  let newTaxAfterRebate = newBaseTax;

  if (newTaxable <= newRules.rebate87aMaxIncome) {
    newRebate87a = Math.min(newBaseTax, newRules.rebate87aMaxAmount);
    newTaxAfterRebate = Math.max(0, roundMoney(newBaseTax - newRebate87a));
  } else if (newRules.marginalRelief87a) {
    const excessOverThreshold = newTaxable - newRules.rebate87aMaxIncome;
    if (newBaseTax > excessOverThreshold) {
      newMarginalRelief87a = roundMoney(newBaseTax - excessOverThreshold);
      newTaxAfterRebate = roundMoney(excessOverThreshold);
    }
  }

  const newSurcharge = computeSurchargeWithMarginalRelief(
    newTaxable,
    newTaxAfterRebate,
    newRules.slabs,
    true
  );
  const newCess = roundMoney((newTaxAfterRebate + newSurcharge) * 0.04);
  const newTotalTax = roundMoney(newTaxAfterRebate + newSurcharge + newCess);

  // --- Old Regime ---
  const oldStdDed = oldRules.standardDeduction;
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
  const oldBaseTax = calculateProgressiveSlabTax(oldTaxable, oldRules.slabs);

  let oldRebate87a = 0;
  let oldTaxAfterRebate = oldBaseTax;
  if (oldTaxable <= oldRules.rebate87aMaxIncome) {
    oldRebate87a = Math.min(oldBaseTax, oldRules.rebate87aMaxAmount);
    oldTaxAfterRebate = Math.max(0, roundMoney(oldBaseTax - oldRebate87a));
  }

  const oldSurcharge = computeSurchargeWithMarginalRelief(
    oldTaxable,
    oldTaxAfterRebate,
    oldRules.slabs,
    false
  );
  const oldCess = roundMoney((oldTaxAfterRebate + oldSurcharge) * 0.04);
  const oldTotalTax = roundMoney(oldTaxAfterRebate + oldSurcharge + oldCess);

  const savingsAmount = Math.abs(oldTotalTax - newTotalTax);
  const recommendedRegime: "NEW_REGIME" | "OLD_REGIME" | "EQUAL" =
    newTotalTax < oldTotalTax ? "NEW_REGIME" : oldTotalTax < newTotalTax ? "OLD_REGIME" : "EQUAL";

  return {
    assessmentYear: preset.assessmentYear,
    financialYear: preset.financialYear,
    rulesVersion: preset.rulesVersion,
    statuteReference: preset.statuteReference,
    recommendedRegime,
    savingsAmount: roundMoney(savingsAmount),
    newRegime: {
      grossIncome: roundMoney(gross),
      standardDeduction: newStdDed,
      corporateNpsDeduction: roundMoney(nps2),
      taxableIncome: roundMoney(newTaxable),
      baseIncomeTax: roundMoney(newBaseTax),
      section87aRebate: roundMoney(newRebate87a),
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
      section87aRebate: roundMoney(oldRebate87a),
      taxAfterRebate: roundMoney(oldTaxAfterRebate),
      surcharge: oldSurcharge,
      cess: oldCess,
      totalTax: oldTotalTax,
    },
  };
}
