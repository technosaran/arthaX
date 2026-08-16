export type TaxRegime = "old" | "new";

export type TaxEngineInput = {
  fyStartYear: number;
  regime: TaxRegime;
  incomes: Array<{ id?: string; amount?: number | string | null; category?: string | null; date?: string | null }>;
  expenses: Array<{ id?: string; amount?: number | string | null; category?: string | null; date?: string | null }>;
  transactions: Array<{ id?: string; amount?: number | string | null; type?: string | null; category?: string | null; date?: string | null }>;
  investments: Array<{ id?: string; name?: string | null; symbol?: string | null; type?: string | null; quantity?: number | string | null; buy_price?: number | string | null; current_price?: number | string | null; bought_at?: string | null }>;
  mutualFunds: Array<{ id?: string; fund_name?: string | null; units?: number | string | null; avg_nav?: number | string | null; current_nav?: number | string | null; created_at?: string | null }>;
  bonds: Array<{ id?: string; bond_name?: string | null; quantity?: number | string | null; purchase_price?: number | string | null; current_price?: number | string | null; current_value?: number | string | null; created_at?: string | null }>;
  alternativeAssets: Array<{ id?: string; name?: string | null; category?: string | null; purchase_price?: number | string | null; current_value?: number | string | null; created_at?: string | null }>;
  liabilities: Array<{ id?: string; name?: string | null; remaining_amount?: number | string | null; monthly_payment?: number | string | null }>;
};

export type TaxRuleVersion = {
  version: string;
  fyStartYear: number;
  standardDeductionOld: number;
  standardDeductionNew: number;
  cessRate: number;
  stcgTaxRate: number;
  ltcgTaxRate: number;
  sec87aThresholdNew?: number;
  sec87aMaxRebateNew?: number;
  sec87aThresholdOld?: number;
  sec87aMaxRebateOld?: number;
  oldRegimeSlabs: Array<{ upto: number | null; rate: number }>;
  newRegimeSlabs: Array<{ upto: number | null; rate: number }>;
  deductionLimits: Record<string, number>;
};

export const INDIA_TAX_RULES: TaxRuleVersion[] = [
  {
    version: "FY2024-25-v1",
    fyStartYear: 2024,
    standardDeductionOld: 50000,
    standardDeductionNew: 75000,
    cessRate: 0.04,
    stcgTaxRate: 0.20,
    ltcgTaxRate: 0.125,
    sec87aThresholdNew: 700000,
    sec87aMaxRebateNew: 25000,
    sec87aThresholdOld: 500000,
    sec87aMaxRebateOld: 12500,
    oldRegimeSlabs: [
      { upto: 250000, rate: 0 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.2 },
      { upto: null, rate: 0.3 },
    ],
    newRegimeSlabs: [
      { upto: 300000, rate: 0 },
      { upto: 600000, rate: 0.05 },
      { upto: 900000, rate: 0.1 },
      { upto: 1200000, rate: 0.15 },
      { upto: 1500000, rate: 0.2 },
      { upto: null, rate: 0.3 },
    ],
    deductionLimits: {
      "80C": 150000,
      "80D": 25000,
      "80CCD(1B)": 50000,
    },
  },
  {
    version: "FY2025-26-v1",
    fyStartYear: 2025,
    standardDeductionOld: 50000,
    standardDeductionNew: 75000,
    cessRate: 0.04,
    stcgTaxRate: 0.20,
    ltcgTaxRate: 0.125,
    sec87aThresholdNew: 1200000,
    sec87aMaxRebateNew: 60000,
    sec87aThresholdOld: 500000,
    sec87aMaxRebateOld: 12500,
    oldRegimeSlabs: [
      { upto: 250000, rate: 0 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.2 },
      { upto: null, rate: 0.3 },
    ],
    newRegimeSlabs: [
      { upto: 400000, rate: 0 },
      { upto: 800000, rate: 0.05 },
      { upto: 1200000, rate: 0.1 },
      { upto: 1600000, rate: 0.15 },
      { upto: 2000000, rate: 0.2 },
      { upto: 2400000, rate: 0.25 },
      { upto: null, rate: 0.3 },
    ],
    deductionLimits: {
      "80C": 150000,
      "80D": 25000,
      "80CCD(1B)": 50000,
    },
  },
];

const INCOME_CATEGORY_MATCHERS = {
  salary: ["salary", "payroll", "bonus", "stipend"],
  houseProperty: ["rent", "house", "property"],
  otherSources: ["interest", "dividend", "gift", "misc", "freelance"],
};

const DEDUCTION_CATEGORY_MAP: Record<string, string[]> = {
  "80C": ["epf", "ppf", "elss", "lic", "life insurance", "tuition", "principal", "home loan principal", "ssy", "sukanya", "nsc", "tax saver fd", "80c"],
  "80D": ["health insurance", "medical insurance", "mediclaim", "80d"],
  "80CCD(1B)": ["nps", "pension", "80ccd"],
  "10(13A)": ["hra", "house rent", "rent paid"],
};

const TAX_PAID_CATEGORY_MAP = {
  tds: ["tds", "tax deducted"],
  tcs: ["tcs", "tax collected"],
  advanceTax: ["advance tax", "self assessment tax"],
  cgst: ["cgst"],
  sgst: ["sgst"],
  igst: ["igst"],
  gst: ["gst", "cgst", "sgst", "igst"],
};

function toAmount(v: number | string | null | undefined) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function normalize(s: string | null | undefined) {
  return (s || "").toLowerCase();
}

function categoryHasAny(category: string | null | undefined, terms: string[]) {
  const c = normalize(category);
  return terms.some((term) => c.includes(term));
}

function fallsInFY(date: string | null | undefined, fyStartYear: number) {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  // Convert timestamp to IST (+05:30) date parts for precise FY boundary check
  const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth(); // 0-indexed: 3 = April, 2 = March

  if (month >= 3) {
    return year === fyStartYear;
  } else {
    return year === fyStartYear + 1;
  }
}

function pickRule(fyStartYear: number) {
  const exact = INDIA_TAX_RULES.find((r) => r.fyStartYear === fyStartYear);
  if (exact) return exact;
  return INDIA_TAX_RULES[INDIA_TAX_RULES.length - 1];
}

function calcSlabTax(income: number, slabs: Array<{ upto: number | null; rate: number }>) {
  if (income <= 0) return 0;
  let remaining = income;
  let previousLimit = 0;
  let tax = 0;
  for (const slab of slabs) {
    const upper = slab.upto;
    const taxableInSlab = upper === null ? remaining : Math.max(0, Math.min(remaining, upper - previousLimit));
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    if (remaining <= 0) break;
    if (upper !== null) previousLimit = upper;
  }
  return tax;
}

function getHoldingDays(date: string | null | undefined) {
  if (!date) return 0;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getCurrentFYStartYear(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  return m >= 3 ? y : y - 1;
}

export function formatFYLabel(fyStartYear: number) {
  const shortEnd = String(fyStartYear + 1).slice(2);
  return `FY ${fyStartYear}-${shortEnd}`;
}

export function getTaxCalendar(fyStartYear: number) {
  const y = fyStartYear;
  return [
    { dueDate: `15 Jun ${y}`, label: "Advance Tax Q1 (15%)" },
    { dueDate: `15 Sep ${y}`, label: "Advance Tax Q2 (45% cumulative)" },
    { dueDate: `15 Dec ${y}`, label: "Advance Tax Q3 (75% cumulative)" },
    { dueDate: `15 Mar ${y + 1}`, label: "Advance Tax Q4 (100% cumulative)" },
    { dueDate: `31 Jul ${y + 1}`, label: "ITR filing (non-audit taxpayers)" },
  ];
}

export function computeIndiaTaxReport(input: TaxEngineInput) {
  const { fyStartYear, regime } = input;
  const rule = pickRule(fyStartYear);

  const incomesInFY = input.incomes.filter((x) => fallsInFY(x.date ?? null, fyStartYear));
  const expensesInFY = input.expenses.filter((x) => fallsInFY(x.date ?? null, fyStartYear));
  const txnsInFY = input.transactions.filter((x) => fallsInFY(x.date ?? null, fyStartYear));

  const salaryIncome = incomesInFY
    .filter((x) => categoryHasAny(x.category, INCOME_CATEGORY_MATCHERS.salary))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const housePropertyIncome = incomesInFY
    .filter((x) => categoryHasAny(x.category, INCOME_CATEGORY_MATCHERS.houseProperty))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const housePropertyExpense = expensesInFY
    .filter((x) => categoryHasAny(x.category, ["home loan interest", "house maintenance", "property tax"]))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const otherSourcesIncome = incomesInFY
    .filter((x) => categoryHasAny(x.category, INCOME_CATEGORY_MATCHERS.otherSources))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const uncategorizedIncome = incomesInFY
    .filter(
      (x) =>
        !categoryHasAny(x.category, INCOME_CATEGORY_MATCHERS.salary) &&
        !categoryHasAny(x.category, INCOME_CATEGORY_MATCHERS.houseProperty) &&
        !categoryHasAny(x.category, INCOME_CATEGORY_MATCHERS.otherSources)
    )
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const capitalGainsRows: Array<{ assetClass: string; name: string; type: "STCG" | "LTCG"; gain: number; sourceId?: string }> = [];

  for (const stock of input.investments) {
    const qty = toAmount(stock.quantity);
    const buy = toAmount(stock.buy_price);
    const current = toAmount(stock.current_price || stock.buy_price);
    const gain = qty * (current - buy);
    const holdingDays = getHoldingDays(stock.bought_at || null);
    capitalGainsRows.push({
      assetClass: normalize(stock.type).includes("crypto") ? "Crypto" : "Equity",
      name: stock.symbol || stock.name || "Investment",
      type: holdingDays > 365 ? "LTCG" : "STCG",
      gain,
      sourceId: stock.id,
    });
  }

  for (const mf of input.mutualFunds) {
    const units = toAmount(mf.units);
    const avg = toAmount(mf.avg_nav);
    const current = toAmount(mf.current_nav || mf.avg_nav);
    const gain = units * (current - avg);
    const holdingDays = getHoldingDays(mf.created_at || null);
    capitalGainsRows.push({
      assetClass: "Mutual Funds",
      name: mf.fund_name || "Mutual Fund",
      type: holdingDays > 365 ? "LTCG" : "STCG",
      gain,
      sourceId: mf.id,
    });
  }

  for (const b of input.bonds) {
    const qty = toAmount(b.quantity);
    const buy = toAmount(b.purchase_price);
    const current = toAmount(b.current_value || qty * toAmount(b.current_price));
    const gain = current - qty * buy;
    const holdingDays = getHoldingDays(b.created_at || null);
    capitalGainsRows.push({
      assetClass: "Bonds",
      name: b.bond_name || "Bond",
      type: holdingDays > 365 ? "LTCG" : "STCG",
      gain,
      sourceId: b.id,
    });
  }

  for (const a of input.alternativeAssets) {
    const gain = toAmount(a.current_value) - toAmount(a.purchase_price);
    const holdingDays = getHoldingDays(a.created_at || null);
    capitalGainsRows.push({
      assetClass: a.category || "Alt Assets",
      name: a.name || "Asset",
      type: holdingDays > 365 ? "LTCG" : "STCG",
      gain,
      sourceId: a.id,
    });
  }

  const stcg = capitalGainsRows.filter((x) => x.type === "STCG").reduce((s, x) => s + x.gain, 0);
  const ltcg = capitalGainsRows.filter((x) => x.type === "LTCG").reduce((s, x) => s + x.gain, 0);

  const deductionBreakdown = Object.entries(rule.deductionLimits).map(([code, limit]) => {
    const used = expensesInFY
      .filter((x) => categoryHasAny(x.category, DEDUCTION_CATEGORY_MAP[code] || []))
      .reduce((s, x) => s + toAmount(x.amount), 0);
    return {
      code,
      limit,
      used,
      eligible: Math.min(used, limit),
    };
  });

  const totalDeductions = deductionBreakdown.reduce((s, x) => s + x.eligible, 0);

  const tds = txnsInFY
    .filter((x) => x.type === "expense" && categoryHasAny(x.category, TAX_PAID_CATEGORY_MAP.tds))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const tcs = txnsInFY
    .filter((x) => x.type === "expense" && categoryHasAny(x.category, TAX_PAID_CATEGORY_MAP.tcs))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const advanceTax = txnsInFY
    .filter((x) => x.type === "expense" && categoryHasAny(x.category, TAX_PAID_CATEGORY_MAP.advanceTax))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const gst = txnsInFY
    .filter((x) => x.type === "expense" && categoryHasAny(x.category, TAX_PAID_CATEGORY_MAP.gst))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const cgst = txnsInFY
    .filter((x) => x.type === "expense" && categoryHasAny(x.category, TAX_PAID_CATEGORY_MAP.cgst))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const sgst = txnsInFY
    .filter((x) => x.type === "expense" && categoryHasAny(x.category, TAX_PAID_CATEGORY_MAP.sgst))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const igst = txnsInFY
    .filter((x) => x.type === "expense" && categoryHasAny(x.category, TAX_PAID_CATEGORY_MAP.igst))
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const grossIncome = salaryIncome + (housePropertyIncome - housePropertyExpense) + otherSourcesIncome + uncategorizedIncome + stcg + ltcg;

  // 1. Separate Special Rate Income
  const LTCG_EXEMPTION = 125000;
  const taxableLtcg = Math.max(0, ltcg - LTCG_EXEMPTION);
  const taxableStcg = Math.max(0, stcg);
  
  // 2. Compute Normal Income
  const normalIncomeOld = Math.max(0, (grossIncome - stcg - ltcg) - rule.standardDeductionOld - totalDeductions);
  const normalIncomeNew = Math.max(0, (grossIncome - stcg - ltcg) - rule.standardDeductionNew);
  
  // 3. Compute Base Tax
  const oldNormalTax = calcSlabTax(normalIncomeOld, rule.oldRegimeSlabs);
  const newNormalTax = calcSlabTax(normalIncomeNew, rule.newRegimeSlabs);
  
  const ltcgTaxRate = rule.ltcgTaxRate;
  const stcgTaxRate = rule.stcgTaxRate;
  
  const specialTax = (taxableLtcg * ltcgTaxRate) + (taxableStcg * stcgTaxRate);
  
  const oldTaxBeforeRebate = oldNormalTax + specialTax;
  const newTaxBeforeRebate = newNormalTax + specialTax;

  const totalTaxableOld = normalIncomeOld + taxableLtcg + taxableStcg;
  const totalTaxableNew = normalIncomeNew + taxableLtcg + taxableStcg;

  // 4. Section 87A Tax Rebate with Marginal Relief
  const compute87ARebateWithMarginalRelief = (
    taxableIncome: number,
    taxBeforeRebate: number,
    threshold: number,
    maxRebate: number
  ): number => {
    if (taxableIncome <= 0 || taxBeforeRebate <= 0) return 0;
    if (taxableIncome <= threshold) {
      return Math.min(taxBeforeRebate, maxRebate);
    }
    const excessIncome = taxableIncome - threshold;
    if (taxBeforeRebate > excessIncome) {
      const marginalTaxPayable = excessIncome;
      const rebateAmount = taxBeforeRebate - marginalTaxPayable;
      return Math.max(0, Math.min(rebateAmount, maxRebate));
    }
    return 0;
  };

  const sec87aThresholdNew = rule.sec87aThresholdNew ?? 700000;
  const sec87aMaxRebateNew = rule.sec87aMaxRebateNew ?? 25000;
  const sec87aThresholdOld = rule.sec87aThresholdOld ?? 500000;
  const sec87aMaxRebateOld = rule.sec87aMaxRebateOld ?? 12500;

  const oldRebate = compute87ARebateWithMarginalRelief(totalTaxableOld, oldTaxBeforeRebate, sec87aThresholdOld, sec87aMaxRebateOld);
  const newRebate = compute87ARebateWithMarginalRelief(totalTaxableNew, newTaxBeforeRebate, sec87aThresholdNew, sec87aMaxRebateNew);

  let oldTax = Math.max(0, oldTaxBeforeRebate - oldRebate);
  let newTax = Math.max(0, newTaxBeforeRebate - newRebate);

  // 5. Surcharge and Surcharge Marginal Relief
  const applySurcharge = (baseTax: number, totalIncome: number, isNewRegime: boolean) => {
    if (totalIncome <= 5000000) return baseTax;
    
    let surchargeRate = 0;
    if (totalIncome > 5000000 && totalIncome <= 10000000) surchargeRate = 0.10;
    else if (totalIncome > 10000000 && totalIncome <= 20000000) surchargeRate = 0.15;
    else if (totalIncome > 20000000) surchargeRate = isNewRegime ? 0.25 : 0.25;

    const taxWithSurcharge = baseTax * (1 + surchargeRate);
    
    let threshold = 5000000;
    let prevSurchargeRate = 0;
    if (totalIncome > 20000000) { threshold = 20000000; prevSurchargeRate = 0.15; }
    else if (totalIncome > 10000000) { threshold = 10000000; prevSurchargeRate = 0.10; }
    
    const excessIncome = totalIncome - threshold;
    const assumedTaxAtThreshold = baseTax * (threshold / totalIncome); 
    const taxAtThresholdWithPrevSurcharge = assumedTaxAtThreshold * (1 + prevSurchargeRate);
    const maxAllowedTax = taxAtThresholdWithPrevSurcharge + excessIncome;

    return Math.min(taxWithSurcharge, maxAllowedTax);
  };

  oldTax = applySurcharge(oldTax, totalTaxableOld, false);
  newTax = applySurcharge(newTax, totalTaxableNew, true);

  // 6. Cess
  const oldTaxWithCess = oldTax * (1 + rule.cessRate);
  const newTaxWithCess = newTax * (1 + rule.cessRate);
  const selectedTaxBeforePaid = regime === "old" ? oldTaxWithCess : newTaxWithCess;

  const totalTaxPaid = tds + tcs + advanceTax;

  const liabilitiesTotal = input.liabilities.reduce((s, l) => s + toAmount(l.remaining_amount), 0);
  const liabilitiesEmi = input.liabilities.reduce((s, l) => s + toAmount(l.monthly_payment), 0);

  const accountLikeAssets = txnsInFY
    .filter((x) => x.type === "income")
    .reduce((s, x) => s + toAmount(x.amount), 0) - txnsInFY
    .filter((x) => x.type === "expense")
    .reduce((s, x) => s + toAmount(x.amount), 0);

  const investmentValue = input.investments.reduce((s, x) => s + toAmount(x.quantity) * toAmount(x.current_price || x.buy_price), 0);
  const mfValue = input.mutualFunds.reduce((s, x) => s + toAmount(x.units) * toAmount(x.current_nav || x.avg_nav), 0);
  const bondValue = input.bonds.reduce((s, x) => s + toAmount(x.current_value || toAmount(x.quantity) * toAmount(x.current_price)), 0);
  const altValue = input.alternativeAssets.reduce((s, x) => s + toAmount(x.current_value), 0);

  const totalAssets = Math.max(0, accountLikeAssets) + investmentValue + mfValue + bondValue + altValue;

  const expenseByCategory = txnsInFY
    .filter((x) => x.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      const key = t.category || "Others";
      acc[key] = (acc[key] || 0) + toAmount(t.amount);
      return acc;
    }, {});

  const spendingCategories = Object.entries(expenseByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7);

  const fyTotalIncome = txnsInFY.filter((x) => x.type === "income").reduce((s, x) => s + toAmount(x.amount), 0);
  const fyTotalExpense = txnsInFY.filter((x) => x.type === "expense").reduce((s, x) => s + toAmount(x.amount), 0);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed

  const curMonthTxns = txnsInFY.filter((x) => {
    if (!x.date) return false;
    const d = new Date(x.date);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });
  const monthlyIncome = curMonthTxns.filter((x) => x.type === "income").reduce((s, x) => s + toAmount(x.amount), 0);
  const monthlyExpense = curMonthTxns.filter((x) => x.type === "expense").reduce((s, x) => s + toAmount(x.amount), 0);

  const qStartMonth = Math.floor(curMonth / 3) * 3;
  const curQuarterTxns = txnsInFY.filter((x) => {
    if (!x.date) return false;
    const d = new Date(x.date);
    return d.getFullYear() === curYear && d.getMonth() >= qStartMonth && d.getMonth() < qStartMonth + 3;
  });
  const quarterlyIncome = curQuarterTxns.filter((x) => x.type === "income").reduce((s, x) => s + toAmount(x.amount), 0);
  const quarterlyExpense = curQuarterTxns.filter((x) => x.type === "expense").reduce((s, x) => s + toAmount(x.amount), 0);

  const regimeComparison = {
    old: oldTaxWithCess,
    new: newTaxWithCess,
    recommended: oldTaxWithCess <= newTaxWithCess ? "old" : "new",
    savingsVsOther: Math.abs(oldTaxWithCess - newTaxWithCess),
  } as const;

  return {
    fiscal: {
      fyStartYear,
      label: formatFYLabel(fyStartYear),
      ruleVersion: rule.version,
      taxRegime: regime,
      taxCalendar: getTaxCalendar(fyStartYear),
    },
    taxHeads: {
      salaryIncome,
      housePropertyIncome: housePropertyIncome - housePropertyExpense,
      capitalGains: { stcg, ltcg },
      otherSourcesIncome: otherSourcesIncome + uncategorizedIncome,
      grossIncome,
    },
    deductions: {
      items: deductionBreakdown,
      totalEligible: totalDeductions,
    },
    taxPayment: {
      tds,
      tcs,
      advanceTax,
      gst,
      gstBreakdown: { cgst, sgst, igst },
      totalTaxPaid,
      taxPayable: Math.max(0, selectedTaxBeforePaid - totalTaxPaid),
      taxRefundEstimate: Math.max(0, totalTaxPaid - selectedTaxBeforePaid),
    },
    regimeComparison,
    capitalGainsRows,
    reports: {
      monthly: { income: monthlyIncome, expense: monthlyExpense, pnl: monthlyIncome - monthlyExpense },
      quarterly: { income: quarterlyIncome, expense: quarterlyExpense, pnl: quarterlyIncome - quarterlyExpense },
      annual: { income: fyTotalIncome, expense: fyTotalExpense, pnl: fyTotalIncome - fyTotalExpense },
      balanceSheet: { totalAssets, totalLiabilities: liabilitiesTotal, netWorth: totalAssets - liabilitiesTotal },
      spendingCategories,
      assetAllocation: [
        { label: "Equity & Crypto", value: investmentValue },
        { label: "Mutual Funds", value: mfValue },
        { label: "Bonds", value: bondValue },
        { label: "Alt Assets", value: altValue },
      ],
      liabilities: { totalOutstanding: liabilitiesTotal, monthlyEmi: liabilitiesEmi },
      familyConsolidated: {
        supported: true,
        note: "Family-level rollups are based on available shared transactions in this account context.",
      },
    },
    audit: {
      incomeRows: incomesInFY.map((x) => x.id).filter(Boolean),
      expenseRows: expensesInFY.map((x) => x.id).filter(Boolean),
      transactionRows: txnsInFY.map((x) => x.id).filter(Boolean),
      capitalGainSourceRows: capitalGainsRows.map((x) => x.sourceId).filter(Boolean),
      assumptions: [
        "Capital gains are mark-to-market approximations from holdings.",
        "Deduction eligibility is inferred from category labels.",
        "Use this report as a high-level planning aid, not as a statutory filing output.",
      ],
    },
  };
}

export type TaxHarvestingItem = {
  id: string;
  name: string;
  assetClass: string;
  isLtcg: boolean;
  holdingDays: number;
  investedValue: number;
  currentValue: number;
  unrealizedPnl: number;
  harvestType: "Loss Harvest" | "Gain Harvest (LTCG Exemption)" | "Neutral";
  potentialTaxSavings: number;
};

export type TaxHarvestingResult = {
  stcgRealized: number;
  ltcgRealized: number;
  initialTaxPayable: number;
  unusedLtcgExemption: number;
  items: TaxHarvestingItem[];
  totalLossHarvestable: number;
  totalGainHarvestableTaxFree: number;
  maxPotentialTaxSavings: number;
};

export function computeTaxLossHarvesting(input: TaxEngineInput): TaxHarvestingResult {
  const report = computeIndiaTaxReport(input);
  const stcgRealized = report.taxHeads.capitalGains.stcg;
  const ltcgRealized = report.taxHeads.capitalGains.ltcg;

  // Indian Tax Act 2025: STCG @ 20%, LTCG @ 12.5% above 1.25L exemption
  const LTCG_EXEMPTION = 125000;
  const rule = pickRule(input.fyStartYear);
  const STCG_RATE = rule.stcgTaxRate;
  const LTCG_RATE = rule.ltcgTaxRate;

  const initialStcgTax = Math.max(0, stcgRealized) * STCG_RATE;
  const initialLtcgTax = Math.max(0, ltcgRealized - LTCG_EXEMPTION) * LTCG_RATE;
  const initialTaxPayable = initialStcgTax + initialLtcgTax;

  const unusedLtcgExemption = Math.max(0, LTCG_EXEMPTION - Math.max(0, ltcgRealized));

  const items: TaxHarvestingItem[] = [];

  // 1. Process Stock / Equity Investments
  for (const stock of input.investments) {
    const qty = toAmount(stock.quantity);
    const buy = toAmount(stock.buy_price);
    const current = toAmount(stock.current_price || stock.buy_price);
    const investedValue = qty * buy;
    const currentValue = qty * current;
    const unrealizedPnl = currentValue - investedValue;
    const holdingDays = getHoldingDays(stock.bought_at || null);
    const isLtcg = holdingDays > 365;
    const assetClass = normalize(stock.type).includes("crypto") ? "Crypto" : "Equity";

    let harvestType: TaxHarvestingItem["harvestType"] = "Neutral";
    let potentialTaxSavings = 0;

    if (unrealizedPnl < 0 && assetClass !== "Crypto") {
      harvestType = "Loss Harvest";
      potentialTaxSavings = Math.abs(unrealizedPnl) * (isLtcg ? LTCG_RATE : STCG_RATE);
    } else if (unrealizedPnl > 0 && isLtcg && unusedLtcgExemption > 0) {
      harvestType = "Gain Harvest (LTCG Exemption)";
      potentialTaxSavings = Math.min(unrealizedPnl, unusedLtcgExemption) * LTCG_RATE;
    }

    items.push({
      id: stock.id || `stock-${stock.symbol || stock.name}`,
      name: stock.symbol || stock.name || "Stock Holding",
      assetClass,
      isLtcg,
      holdingDays,
      investedValue,
      currentValue,
      unrealizedPnl,
      harvestType,
      potentialTaxSavings,
    });
  }

  // 2. Process Mutual Funds
  for (const mf of input.mutualFunds) {
    const units = toAmount(mf.units);
    const avg = toAmount(mf.avg_nav);
    const current = toAmount(mf.current_nav || mf.avg_nav);
    const investedValue = units * avg;
    const currentValue = units * current;
    const unrealizedPnl = currentValue - investedValue;
    const holdingDays = getHoldingDays(mf.created_at || null);
    const isLtcg = holdingDays > 365;

    let harvestType: TaxHarvestingItem["harvestType"] = "Neutral";
    let potentialTaxSavings = 0;

    if (unrealizedPnl < 0) {
      harvestType = "Loss Harvest";
      potentialTaxSavings = Math.abs(unrealizedPnl) * (isLtcg ? LTCG_RATE : STCG_RATE);
    } else if (unrealizedPnl > 0 && isLtcg && unusedLtcgExemption > 0) {
      harvestType = "Gain Harvest (LTCG Exemption)";
      potentialTaxSavings = Math.min(unrealizedPnl, unusedLtcgExemption) * LTCG_RATE;
    }

    items.push({
      id: mf.id || `mf-${mf.fund_name}`,
      name: mf.fund_name || "Mutual Fund",
      assetClass: "Mutual Funds",
      isLtcg,
      holdingDays,
      investedValue,
      currentValue,
      unrealizedPnl,
      harvestType,
      potentialTaxSavings,
    });
  }

  // 3. Process Bonds
  for (const b of input.bonds) {
    const qty = toAmount(b.quantity);
    const buy = toAmount(b.purchase_price);
    const current = toAmount(b.current_value || qty * toAmount(b.current_price));
    const investedValue = qty * buy;
    const currentValue = current;
    const unrealizedPnl = currentValue - investedValue;
    const holdingDays = getHoldingDays(b.created_at || null);
    const isLtcg = holdingDays > 365;

    let harvestType: TaxHarvestingItem["harvestType"] = "Neutral";
    let potentialTaxSavings = 0;

    if (unrealizedPnl < 0) {
      harvestType = "Loss Harvest";
      potentialTaxSavings = Math.abs(unrealizedPnl) * (isLtcg ? LTCG_RATE : STCG_RATE);
    }

    items.push({
      id: b.id || `bond-${b.bond_name}`,
      name: b.bond_name || "Bond Holding",
      assetClass: "Bonds",
      isLtcg,
      holdingDays,
      investedValue,
      currentValue,
      unrealizedPnl,
      harvestType,
      potentialTaxSavings,
    });
  }

  // 4. Process Alternative Assets
  for (const a of input.alternativeAssets) {
    const investedValue = toAmount(a.purchase_price);
    const currentValue = toAmount(a.current_value);
    const unrealizedPnl = currentValue - investedValue;
    const holdingDays = getHoldingDays(a.created_at || null);
    const isLtcg = holdingDays > 365;

    let harvestType: TaxHarvestingItem["harvestType"] = "Neutral";
    let potentialTaxSavings = 0;

    if (unrealizedPnl < 0) {
      harvestType = "Loss Harvest";
      potentialTaxSavings = Math.abs(unrealizedPnl) * (isLtcg ? LTCG_RATE : STCG_RATE);
    }

    items.push({
      id: a.id || `alt-${a.name}`,
      name: a.name || "Alternative Asset",
      assetClass: a.category || "Alt Assets",
      isLtcg,
      holdingDays,
      investedValue,
      currentValue,
      unrealizedPnl,
      harvestType,
      potentialTaxSavings,
    });
  }

  const totalLossHarvestable = items
    .filter((x) => x.harvestType === "Loss Harvest")
    .reduce((s, x) => s + Math.abs(x.unrealizedPnl), 0);

  const totalGainHarvestableTaxFree = items
    .filter((x) => x.harvestType === "Gain Harvest (LTCG Exemption)")
    .reduce((s, x) => s + x.unrealizedPnl, 0);

  const maxPotentialTaxSavings = items.reduce((s, x) => s + x.potentialTaxSavings, 0);

  return {
    stcgRealized,
    ltcgRealized,
    initialTaxPayable,
    unusedLtcgExemption,
    items,
    totalLossHarvestable,
    totalGainHarvestableTaxFree,
    maxPotentialTaxSavings,
  };
}
