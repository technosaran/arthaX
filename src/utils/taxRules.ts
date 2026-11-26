import { z } from "zod";

export interface TaxSlab {
  /** Upper limit in INR for this slab, or null for the top open-ended bracket. */
  upTo: number | null;
  /** Marginal tax rate as decimal (e.g., 0.05 for 5%). */
  rate: number;
}

export interface TaxRegimeRules {
  standardDeduction: number;
  rebate87aMaxIncome: number;
  rebate87aMaxAmount: number;
  marginalRelief87a: boolean;
  slabs: TaxSlab[];
}

export interface TaxRuleSet {
  equity: {
    ltcgThresholdDays: number;
    stcgRate: number;
    ltcgRate: number;
    ltcgExemptionLimit: number;
  };
  bullion: {
    ltcgThresholdDays: number;
    ltcgRate: number;
  };
  bondsListed: {
    ltcgThresholdDays: number;
    ltcgRate: number;
  };
  cryptoVda: {
    flatRate: number;
    cessRate: number;
    effectiveRate: number;
    allowLossSetoff: boolean;
  };
  newRegime: TaxRegimeRules;
  oldRegime: TaxRegimeRules;
}

export interface TaxYearPreset {
  assessmentYear: string;
  financialYear: string;
  label: string;
  shortLabel: string;
  rulesVersion: string;
  statuteReference: string;
  effectiveFrom: string;
  isProjected?: boolean;
  rules: TaxRuleSet;
}

export interface TaxRuleOverride {
  label?: string;
  rulesVersion?: string;
  statuteReference?: string;
  equity?: Partial<TaxRuleSet["equity"]>;
  bullion?: Partial<TaxRuleSet["bullion"]>;
  bondsListed?: Partial<TaxRuleSet["bondsListed"]>;
  cryptoVda?: Partial<TaxRuleSet["cryptoVda"]>;
  newRegime?: Partial<TaxRegimeRules>;
  oldRegime?: Partial<TaxRegimeRules>;
}

export type TaxRuleOverridesMap = Record<string, TaxRuleOverride>;

export const TaxSlabSchema = z.object({
  upTo: z.number().positive().nullable(),
  rate: z.number().min(0).max(1),
});

export const TaxRegimeOverrideSchema = z.object({
  standardDeduction: z.number().min(0).max(10_000_000).optional(),
  rebate87aMaxIncome: z.number().min(0).max(100_000_000).optional(),
  rebate87aMaxAmount: z.number().min(0).max(10_000_000).optional(),
  marginalRelief87a: z.boolean().optional(),
  slabs: z.array(TaxSlabSchema).min(1).max(20).optional(),
});

const rateField = z.number().min(0).max(1).optional();
const daysField = z.number().int().min(1).max(3650).optional();

export const TaxRuleOverrideSchema = z.object({
  label: z.string().max(120).optional(),
  rulesVersion: z.string().max(160).optional(),
  statuteReference: z.string().max(200).optional(),
  equity: z
    .object({
      ltcgThresholdDays: daysField,
      stcgRate: rateField,
      ltcgRate: rateField,
      ltcgExemptionLimit: z.number().min(0).max(100_000_000).optional(),
    })
    .optional(),
  bullion: z.object({ ltcgThresholdDays: daysField, ltcgRate: rateField }).optional(),
  bondsListed: z.object({ ltcgThresholdDays: daysField, ltcgRate: rateField }).optional(),
  cryptoVda: z
    .object({
      flatRate: rateField,
      cessRate: z.number().min(0).max(0.5).optional(),
      effectiveRate: rateField,
      allowLossSetoff: z.boolean().optional(),
    })
    .optional(),
  newRegime: TaxRegimeOverrideSchema.optional(),
  oldRegime: TaxRegimeOverrideSchema.optional(),
});

export const TaxRuleOverridesMapSchema = z.record(z.string(), TaxRuleOverrideSchema);

const OLD_REGIME_STANDARD: TaxRegimeRules = {
  standardDeduction: 50000,
  rebate87aMaxIncome: 500000,
  rebate87aMaxAmount: 12500,
  marginalRelief87a: false,
  slabs: [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: null, rate: 0.3 },
  ],
};

const BUDGET_2025_NEW_REGIME: TaxRegimeRules = {
  standardDeduction: 75000,
  rebate87aMaxIncome: 1200000,
  rebate87aMaxAmount: 60000,
  marginalRelief87a: true,
  slabs: [
    { upTo: 400000, rate: 0 },
    { upTo: 800000, rate: 0.05 },
    { upTo: 1200000, rate: 0.1 },
    { upTo: 1600000, rate: 0.15 },
    { upTo: 2000000, rate: 0.2 },
    { upTo: 2400000, rate: 0.25 },
    { upTo: null, rate: 0.3 },
  ],
};

const CRYPTO_VDA_DEFAULT: TaxRuleSet["cryptoVda"] = {
  flatRate: 0.3,
  cessRate: 0.04,
  effectiveRate: 0.312,
  allowLossSetoff: false,
};

const POST_BUDGET_2024_CAP_GAINS: Pick<TaxRuleSet, "equity" | "bullion" | "bondsListed" | "cryptoVda"> = {
  equity: {
    ltcgThresholdDays: 365,
    stcgRate: 0.2,
    ltcgRate: 0.125,
    ltcgExemptionLimit: 125000,
  },
  bullion: { ltcgThresholdDays: 730, ltcgRate: 0.125 },
  bondsListed: { ltcgThresholdDays: 365, ltcgRate: 0.125 },
  cryptoVda: CRYPTO_VDA_DEFAULT,
};

export const STATUTORY_TAX_PRESETS: Record<string, TaxYearPreset> = {
  "2024-2025": {
    assessmentYear: "2024-2025",
    financialYear: "2023-2024",
    label: "FY 2023–24 (AY 2024–25)",
    shortLabel: "FY 23–24",
    rulesVersion: "Finance Act, 2023 (Pre-Budget 2024)",
    statuteReference: "Income-tax Act, 1961 (FY 2023–24)",
    effectiveFrom: "2023-04-01",
    rules: {
      equity: {
        ltcgThresholdDays: 365,
        stcgRate: 0.15,
        ltcgRate: 0.1,
        ltcgExemptionLimit: 100000,
      },
      bullion: { ltcgThresholdDays: 1095, ltcgRate: 0.2 },
      bondsListed: { ltcgThresholdDays: 365, ltcgRate: 0.1 },
      cryptoVda: CRYPTO_VDA_DEFAULT,
      newRegime: {
        standardDeduction: 50000,
        rebate87aMaxIncome: 700000,
        rebate87aMaxAmount: 25000,
        marginalRelief87a: true,
        slabs: [
          { upTo: 300000, rate: 0 },
          { upTo: 600000, rate: 0.05 },
          { upTo: 900000, rate: 0.1 },
          { upTo: 1200000, rate: 0.15 },
          { upTo: 1500000, rate: 0.2 },
          { upTo: null, rate: 0.3 },
        ],
      },
      oldRegime: OLD_REGIME_STANDARD,
    },
  },
  "2025-2026": {
    assessmentYear: "2025-2026",
    financialYear: "2024-2025",
    label: "FY 2024–25 (AY 2025–26)",
    shortLabel: "FY 24–25",
    rulesVersion: "Union Budget 2024 (Finance (No. 2) Act, 2024)",
    statuteReference: "Income-tax Act, 1961 (post 23 Jul 2024 reform)",
    effectiveFrom: "2024-07-23",
    rules: {
      ...POST_BUDGET_2024_CAP_GAINS,
      newRegime: {
        standardDeduction: 75000,
        rebate87aMaxIncome: 700000,
        rebate87aMaxAmount: 25000,
        marginalRelief87a: true,
        slabs: [
          { upTo: 300000, rate: 0 },
          { upTo: 700000, rate: 0.05 },
          { upTo: 1000000, rate: 0.1 },
          { upTo: 1200000, rate: 0.15 },
          { upTo: 1500000, rate: 0.2 },
          { upTo: null, rate: 0.3 },
        ],
      },
      oldRegime: OLD_REGIME_STANDARD,
    },
  },
  "2026-2027": {
    assessmentYear: "2026-2027",
    financialYear: "2025-2026",
    label: "FY 2025–26 (AY 2026–27)",
    shortLabel: "FY 25–26",
    rulesVersion: "Union Budget 2025 (Finance Act, 2025)",
    statuteReference: "Income-tax Act, 1961 (Sec 115BAC & Sec 87A ₹12L Rebate)",
    effectiveFrom: "2025-04-01",
    rules: {
      ...POST_BUDGET_2024_CAP_GAINS,
      newRegime: BUDGET_2025_NEW_REGIME,
      oldRegime: OLD_REGIME_STANDARD,
    },
  },
  "2027-2028": {
    assessmentYear: "2027-2028",
    financialYear: "2026-2027",
    label: "Tax Year 2026–27 (AY 2027–28)",
    shortLabel: "FY 26–27",
    rulesVersion: "Income-tax Act, 2025 & Union Budget 2026",
    statuteReference: "Income-tax Act, 2025 (effective 1 Apr 2026)",
    effectiveFrom: "2026-04-01",
    rules: {
      ...POST_BUDGET_2024_CAP_GAINS,
      newRegime: BUDGET_2025_NEW_REGIME,
      oldRegime: OLD_REGIME_STANDARD,
    },
  },
};

export const LATEST_STATUTORY_AY = "2027-2028";

/**
 * Normalizes strings like "2026-27", "2026-2027", or "AY 2026-27" into "2026-2027".
 */
export function normalizeAssessmentYear(raw?: string | null): string {
  if (!raw) return getCurrentIndianAssessmentYear();
  const cleaned = raw.replace(/^(AY|FY)\s*/i, "").trim();
  const shortMatch = cleaned.match(/^(\d{4})-(\d{2})$/);
  if (shortMatch) {
    const startYear = parseInt(shortMatch[1], 10);
    return `${startYear}-${startYear + 1}`;
  }
  const fullMatch = cleaned.match(/^(\d{4})-(\d{4})$/);
  return fullMatch ? `${fullMatch[1]}-${fullMatch[2]}` : getCurrentIndianAssessmentYear();
}

/**
 * Returns the current Indian Assessment Year based on the April-March fiscal calendar.
 */
export function getCurrentIndianAssessmentYear(now: Date = new Date()): string {
  const fyStart = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const ayStart = fyStart + 1;
  return `${ayStart}-${ayStart + 1}`;
}

/**
 * Returns inclusive YYYY-MM-DD fiscal year window corresponding to an Assessment Year.
 */
export function getFiscalYearDateRange(assessmentYear: string): {
  financialYear: string;
  start: string;
  end: string;
} {
  const ayStart = parseInt(normalizeAssessmentYear(assessmentYear).slice(0, 4), 10);
  const fyStart = ayStart - 1;
  return {
    financialYear: `${fyStart}-${ayStart}`,
    start: `${fyStart}-04-01`,
    end: `${ayStart}-03-31`,
  };
}

function mergeRegimeRules(
  base: TaxRegimeRules,
  override?: Partial<TaxRegimeRules>
): TaxRegimeRules {
  return {
    ...base,
    ...override,
    slabs: (override?.slabs ?? base.slabs).map((s) => ({ ...s })),
  };
}

export function mergeTaxRules(base: TaxRuleSet, override?: TaxRuleOverride | null): TaxRuleSet {
  const cryptoMerged = { ...base.cryptoVda, ...override?.cryptoVda };
  if (
    override?.cryptoVda &&
    (override.cryptoVda.flatRate !== undefined || override.cryptoVda.cessRate !== undefined) &&
    override.cryptoVda.effectiveRate === undefined
  ) {
    cryptoMerged.effectiveRate = Number(
      (cryptoMerged.flatRate * (1 + cryptoMerged.cessRate)).toFixed(4)
    );
  }

  return {
    equity: { ...base.equity, ...override?.equity },
    bullion: { ...base.bullion, ...override?.bullion },
    bondsListed: { ...base.bondsListed, ...override?.bondsListed },
    cryptoVda: cryptoMerged,
    newRegime: mergeRegimeRules(base.newRegime, override?.newRegime),
    oldRegime: mergeRegimeRules(base.oldRegime, override?.oldRegime),
  };
}

/**
 * Resolves the active statutory or carried-forward preset for any Assessment Year,
 * merging optional user-customized overrides on top.
 */
export function resolveTaxYearPreset(
  assessmentYear?: string | null,
  customOverride?: TaxRuleOverride | null
): TaxYearPreset & { isCustomized: boolean } {
  const normalizedAy = normalizeAssessmentYear(assessmentYear);
  const direct = STATUTORY_TAX_PRESETS[normalizedAy];

  let basePreset: TaxYearPreset;
  if (direct) {
    basePreset = direct;
  } else {
    const ayStart = parseInt(normalizedAy.slice(0, 4), 10);
    const template =
      ayStart < 2024 ? STATUTORY_TAX_PRESETS["2024-2025"] : STATUTORY_TAX_PRESETS[LATEST_STATUTORY_AY];
    const fyStart = ayStart - 1;
    const fyShort = `${fyStart}–${String(ayStart).slice(-2)}`;
    const ayShort = `${ayStart}–${String(ayStart + 1).slice(-2)}`;

    basePreset = {
      assessmentYear: normalizedAy,
      financialYear: `${fyStart}-${ayStart}`,
      label: `Tax Year ${fyShort} (AY ${ayShort})`,
      shortLabel: `FY ${String(fyStart).slice(-2)}–${String(ayStart).slice(-2)}`,
      rulesVersion: `${template.rulesVersion} (Auto-carried forward — editable)`,
      statuteReference: template.statuteReference,
      effectiveFrom: `${fyStart}-04-01`,
      isProjected: true,
      rules: template.rules,
    };
  }

  const isCustomized = Boolean(customOverride && Object.keys(customOverride).length > 0);
  return {
    ...basePreset,
    label: customOverride?.label?.trim() || basePreset.label,
    statuteReference: customOverride?.statuteReference?.trim() || basePreset.statuteReference,
    rulesVersion: customOverride?.rulesVersion?.trim()
      ? customOverride.rulesVersion.trim()
      : isCustomized
      ? `${basePreset.rulesVersion} + Auto-Updated`
      : basePreset.rulesVersion,
    rules: mergeTaxRules(basePreset.rules, customOverride),
    isCustomized,
  };
}

/**
 * Resolves ONLY the active current Indian fiscal/assessment year preset (auto-rolling over every April 1).
 */
export function getCurrentTaxYearPreset(
  customOverride?: TaxRuleOverride | null,
  now: Date = new Date()
): TaxYearPreset & { isCustomized: boolean } {
  return resolveTaxYearPreset(getCurrentIndianAssessmentYear(now), customOverride);
}

/**
 * Lists all available Fiscal / Assessment Years sorted newest-first.
 */
export function getAvailableTaxYears(
  now: Date = new Date(),
  customOverrides?: TaxRuleOverridesMap | null
): Array<TaxYearPreset & { isCustomized: boolean }> {
  const keys = new Set<string>(Object.keys(STATUTORY_TAX_PRESETS));
  keys.add(getCurrentIndianAssessmentYear(now));

  if (customOverrides) {
    for (const k of Object.keys(customOverrides)) {
      keys.add(normalizeAssessmentYear(k));
    }
  }

  return Array.from(keys)
    .sort((a, b) => b.localeCompare(a))
    .map((ay) => resolveTaxYearPreset(ay, customOverrides?.[ay]));
}

/**
 * Computes progressive income tax across ordered slab brackets.
 */
export function calculateProgressiveSlabTax(taxableIncome: number, slabs: TaxSlab[]): number {
  if (taxableIncome <= 0 || !slabs.length) return 0;

  let totalTax = 0;
  let prevCap = 0;

  for (const slab of slabs) {
    if (taxableIncome <= prevCap) break;
    const upper = slab.upTo === null ? Infinity : slab.upTo;
    totalTax += Math.max(0, Math.min(taxableIncome, upper) - prevCap) * slab.rate;
    if (slab.upTo === null) break;
    prevCap = slab.upTo;
  }

  return Math.round(totalTax * 100) / 100;
}
