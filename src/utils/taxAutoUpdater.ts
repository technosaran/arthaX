import { getCachedData, setCachedData } from "@/utils/redis";
import { logger } from "@/utils/logger";
import {
  TaxRuleOverride,
  TaxRuleOverrideSchema,
  TaxRuleSet,
  TaxSlab,
  getCurrentIndianAssessmentYear,
  getFiscalYearDateRange,
  resolveTaxYearPreset,
} from "@/utils/taxRules";

export interface AutoTaxUpdateRecord {
  assessmentYear: string;
  financialYear: string;
  source: "feed" | "gemini_search" | "builtin";
  checkedAt: string;
  updated: boolean;
  rulesVersion: string;
  statuteReference: string;
  citations: string[];
  override: TaxRuleOverride | null;
}

const AUTO_CHECK_TTL_SECONDS = 24 * 60 * 60; // Check at most once per day automatically
const autoMemoryCache = new Map<string, { expiresAt: number; record: AutoTaxUpdateRecord }>();

export function resetAutoTaxCache(): void {
  autoMemoryCache.clear();
}

function getAutoCacheKey(ay: string): string {
  return `arthax:tax_rules:auto:v1:${ay}`;
}

function isValidProgressiveSlabs(slabs: TaxSlab[] | undefined): boolean {
  if (!slabs || slabs.length < 2) return false;
  let prev = 0;
  for (let i = 0; i < slabs.length; i++) {
    const s = slabs[i];
    if (s.rate < 0 || s.rate > 0.6) return false;
    if (i === slabs.length - 1) {
      if (s.upTo !== null) return false;
    } else {
      if (s.upTo === null || s.upTo <= prev) return false;
      prev = s.upTo;
    }
  }
  return true;
}

function validateSafeOverride(raw: unknown): TaxRuleOverride | null {
  const parsed = TaxRuleOverrideSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ov = parsed.data;
  if (ov.newRegime?.slabs && !isValidProgressiveSlabs(ov.newRegime.slabs)) return null;
  if (ov.oldRegime?.slabs && !isValidProgressiveSlabs(ov.oldRegime.slabs)) return null;
  return ov;
}

function rulesDifferMaterially(base: TaxRuleSet, merged: TaxRuleSet): boolean {
  return JSON.stringify(base) !== JSON.stringify(merged);
}

async function fetchFromFeedUrl(
  feedUrl: string,
  assessmentYear: string
): Promise<{ override: TaxRuleOverride; citations: string[] } | null> {
  try {
    const res = await fetch(feedUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const candidate =
      (json?.years && typeof json.years === "object"
        ? (json.years as Record<string, unknown>)[assessmentYear]
        : undefined) ??
      (json?.[assessmentYear] !== undefined ? json[assessmentYear] : undefined) ??
      json?.current ??
      json;
    const valid = validateSafeOverride(candidate);
    return valid ? { override: valid, citations: [feedUrl] } : null;
  } catch {
    return null;
  }
}

async function fetchFromGeminiGroundedSearch(
  assessmentYear: string,
  financialYear: string
): Promise<{ override: TaxRuleOverride; citations: string[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Search official Government of India Income Tax Department / Union Budget / Finance Act announcements for Indian financial year ${financialYear} (Assessment Year ${assessmentYear}).
Return ONLY a valid JSON object (no markdown fences) matching this exact structure for ${financialYear} individual resident rules:
{
  "rulesVersion": "string naming latest Finance Act / Budget / Income-tax Act in force for FY ${financialYear}",
  "statuteReference": "string citation",
  "equity": { "ltcgThresholdDays": 365, "stcgRate": 0.20, "ltcgRate": 0.125, "ltcgExemptionLimit": 125000 },
  "bullion": { "ltcgThresholdDays": 730, "ltcgRate": 0.125 },
  "bondsListed": { "ltcgThresholdDays": 365, "ltcgRate": 0.125 },
  "cryptoVda": { "flatRate": 0.30, "cessRate": 0.04, "allowLossSetoff": false },
  "newRegime": {
    "standardDeduction": 75000,
    "rebate87aMaxIncome": 1200000,
    "rebate87aMaxAmount": 60000,
    "marginalRelief87a": true,
    "slabs": [
      { "upTo": 400000, "rate": 0 },
      { "upTo": 800000, "rate": 0.05 },
      { "upTo": 1200000, "rate": 0.10 },
      { "upTo": 1600000, "rate": 0.15 },
      { "upTo": 2000000, "rate": 0.20 },
      { "upTo": 2400000, "rate": 0.25 },
      { "upTo": null, "rate": 0.30 }
    ]
  }
}
All rates must be decimals (e.g. 0.125 for 12.5%, 0.20 for 20%) and amounts in INR.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
        }),
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx === -1 || endIdx <= startIdx) return null;

    const parsedJson = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    const valid = validateSafeOverride(parsedJson);
    if (!valid) return null;

    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const citations: string[] = Array.isArray(chunks)
      ? chunks
          .map((c: { web?: { uri?: string } }) => c?.web?.uri)
          .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//.test(u))
          .slice(0, 5)
      : [];

    return { override: valid, citations };
  } catch (err) {
    logger.warn("Grounded tax rule auto-check failed, keeping statutory rules", "TaxAutoUpdater", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Reads cached auto-updated tax rule overrides for the current fiscal year (0ms if in memory).
 */
export async function getCachedAutoTaxRecord(
  assessmentYear: string = getCurrentIndianAssessmentYear()
): Promise<AutoTaxUpdateRecord | null> {
  const mem = autoMemoryCache.get(assessmentYear);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.record;
  }

  const redisCached = await getCachedData<AutoTaxUpdateRecord>(getAutoCacheKey(assessmentYear));
  if (redisCached) {
    autoMemoryCache.set(assessmentYear, {
      expiresAt: Date.now() + AUTO_CHECK_TTL_SECONDS * 1000,
      record: redisCached,
    });
    return redisCached;
  }
  return null;
}

/**
 * Automatically checks for updated Indian statutory tax rates/slabs for the current fiscal year
 * from either TAX_RULES_FEED_URL or Gemini Google Search Grounding (cached 24h in Redis/memory).
 */
export async function checkAndAutoUpdateTaxRules(options?: {
  force?: boolean;
  assessmentYear?: string;
}): Promise<AutoTaxUpdateRecord> {
  const ay = options?.assessmentYear || getCurrentIndianAssessmentYear();
  const { financialYear } = getFiscalYearDateRange(ay);
  const baselinePreset = resolveTaxYearPreset(ay);

  if (!options?.force) {
    const cached = await getCachedAutoTaxRecord(ay);
    if (cached) return cached;
  }

  let candidate: { override: TaxRuleOverride; citations: string[]; source: "feed" | "gemini_search" } | null =
    null;

  if (process.env.TAX_RULES_FEED_URL) {
    const feedRes = await fetchFromFeedUrl(process.env.TAX_RULES_FEED_URL, ay);
    if (feedRes) candidate = { ...feedRes, source: "feed" };
  }

  if (!candidate && process.env.GEMINI_API_KEY) {
    const geminiRes = await fetchFromGeminiGroundedSearch(ay, financialYear);
    if (geminiRes) candidate = { ...geminiRes, source: "gemini_search" };
  }

  const nowIso = new Date().toISOString();
  let record: AutoTaxUpdateRecord;

  if (candidate) {
    const mergedPreset = resolveTaxYearPreset(ay, candidate.override);
    const updated = rulesDifferMaterially(baselinePreset.rules, mergedPreset.rules);
    record = {
      assessmentYear: ay,
      financialYear,
      source: candidate.source,
      checkedAt: nowIso,
      updated,
      rulesVersion: mergedPreset.rulesVersion,
      statuteReference: mergedPreset.statuteReference,
      citations: candidate.citations,
      override: updated ? candidate.override : null,
    };
  } else {
    record = {
      assessmentYear: ay,
      financialYear,
      source: "builtin",
      checkedAt: nowIso,
      updated: false,
      rulesVersion: baselinePreset.rulesVersion,
      statuteReference: baselinePreset.statuteReference,
      citations: [],
      override: null,
    };
  }

  autoMemoryCache.set(ay, {
    expiresAt: Date.now() + AUTO_CHECK_TTL_SECONDS * 1000,
    record,
  });
  await setCachedData(getAutoCacheKey(ay), record, AUTO_CHECK_TTL_SECONDS);

  if (record.updated) {
    logger.info(`Auto-updated Indian tax rules for AY ${ay}`, "TaxAutoUpdater", {
      source: record.source,
      rulesVersion: record.rulesVersion,
    });
  }

  return record;
}
