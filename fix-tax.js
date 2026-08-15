const fs = require('fs');
let code = fs.readFileSync('apps/web/src/lib/tax/india-tax-engine.ts', 'utf8');

// 1. Add FY2026-27 rule
if (!code.includes('FY2026-27-v1')) {
  const ruleToCopy = code.substring(code.indexOf('version: "FY2025-26-v1"') - 6, code.indexOf('deductionLimits: {') + 100);
  const newRule = ruleToCopy.replace('FY2025-26-v1', 'FY2026-27-v1').replace('fyStartYear: 2025', 'fyStartYear: 2026');
  code = code.replace(/\s+\}\s*\];\s*const INCOME_CATEGORY/, '  },\n  {\n    version: "FY2026-27-v1",\n    fyStartYear: 2026,\n    standardDeductionOld: 50000,\n    standardDeductionNew: 75000,\n    cessRate: 0.04,\n    sec87aThresholdNew: 1200000,\n    sec87aMaxRebateNew: 60000,\n    sec87aThresholdOld: 500000,\n    sec87aMaxRebateOld: 12500,\n    oldRegimeSlabs: [\n      { upto: 250000, rate: 0 },\n      { upto: 500000, rate: 0.05 },\n      { upto: 1000000, rate: 0.2 },\n      { upto: null, rate: 0.3 },\n    ],\n    newRegimeSlabs: [\n      { upto: 400000, rate: 0 },\n      { upto: 800000, rate: 0.05 },\n      { upto: 1200000, rate: 0.1 },\n      { upto: 1600000, rate: 0.15 },\n      { upto: 2000000, rate: 0.2 },\n      { upto: 2400000, rate: 0.25 },\n      { upto: null, rate: 0.3 },\n    ],\n    deductionLimits: {\n      "80C": 150000,\n      "80D": 25000,\n      "80CCD(1B)": 50000,\n    }\n  }\n];\n\nconst INCOME_CATEGORY');
}

// 2. Replace the tax computation logic (Lines ~338-380)
const regex = /const grossIncome = [\s\S]*?const selectedTaxBeforePaid = [^;]+;/m;
const replacement = `const grossIncome = salaryIncome + (housePropertyIncome - housePropertyExpense) + otherSourcesIncome + uncategorizedIncome + stcg + ltcg;

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
  
  const ltcgTaxRate = fyStartYear >= 2024 ? 0.125 : 0.10;
  const stcgTaxRate = fyStartYear >= 2024 ? 0.20 : 0.15;
  
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

  const sec87aThresholdNew = rule.sec87aThresholdNew ?? (fyStartYear >= 2025 ? 1200000 : 700000);
  const sec87aMaxRebateNew = rule.sec87aMaxRebateNew ?? (fyStartYear >= 2025 ? 60000 : 25000);
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
  const selectedTaxBeforePaid = regime === "old" ? oldTaxWithCess : newTaxWithCess;`;

code = code.replace(regex, replacement);
fs.writeFileSync('apps/web/src/lib/tax/india-tax-engine.ts', code);
console.log('Tax engine updated successfully.');
