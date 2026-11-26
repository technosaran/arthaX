import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 59, limit: 60, reset: 12345 }),
  checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/utils/redis", () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

import { getAuthenticatedUser } from "@/utils/auth";
import { rateLimit } from "@/utils/rateLimit";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { getCachedData, setCachedData } from "@/utils/redis";
import { GET as getTaxAnalysis, POST as postTaxAnalysis } from "@/app/api/v1/analytics/tax/route";
import { GET as getTaxRules, PUT as putTaxRules, POST as postAutoUpdateTaxRules } from "@/app/api/v1/analytics/tax/rules/route";
import {
  checkAndAutoUpdateTaxRules,
  resetAutoTaxCache,
} from "@/utils/taxAutoUpdater";
import {
  getCurrentIndianAssessmentYear,
  getCurrentTaxYearPreset,
  getFiscalYearDateRange,
  normalizeAssessmentYear,
  resolveTaxYearPreset,
} from "@/utils/taxRules";

const TEST_USER_ID = "user-tax-test-001";
type FromResult = ReturnType<typeof supabaseAdmin.from>;

function createQueryChain(resolvedData: unknown, resolvedError: unknown = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (v: typeof result) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain as unknown as FromResult;
}

describe("Current Tax System & April 1 Auto-Rollover", () => {
  it("auto-advances the active Indian Assessment Year across April 1 boundary", () => {
    expect(getCurrentIndianAssessmentYear(new Date("2026-03-31T12:00:00Z"))).toBe("2026-2027");
    expect(getCurrentIndianAssessmentYear(new Date("2026-04-01T12:00:00Z"))).toBe("2027-2028");
    expect(getCurrentIndianAssessmentYear(new Date("2026-11-26T12:00:00Z"))).toBe("2027-2028");
    expect(getCurrentIndianAssessmentYear(new Date("2027-04-05T12:00:00Z"))).toBe("2028-2029");
  });

  it("resolves current statutory preset (Income-tax Act 2025) and auto-carries forward into future fiscal years", () => {
    expect(normalizeAssessmentYear("AY 2027-28")).toBe("2027-2028");
    expect(getFiscalYearDateRange("2027-2028")).toEqual({
      financialYear: "2026-2027",
      start: "2026-04-01",
      end: "2027-03-31",
    });

    const current = getCurrentTaxYearPreset(null, new Date("2026-11-26T12:00:00Z"));
    expect(current.assessmentYear).toBe("2027-2028");
    expect(current.rulesVersion).toContain("Income-tax Act, 2025");
    expect(current.rules.newRegime.rebate87aMaxIncome).toBe(1200000);
    expect(current.rules.equity.ltcgExemptionLimit).toBe(125000);

    const rolledForward = getCurrentTaxYearPreset(null, new Date("2028-06-15T12:00:00Z"));
    expect(rolledForward.assessmentYear).toBe("2029-2030");
    expect(rolledForward.isProjected).toBe(true);
    expect(rolledForward.rules.newRegime.rebate87aMaxIncome).toBe(1200000);

    const autoUpdated = resolveTaxYearPreset("2027-2028", {
      rulesVersion: "Union Budget 2027",
      equity: { ltcgExemptionLimit: 175000 },
      cryptoVda: { flatRate: 0.2, cessRate: 0.04 },
    });
    expect(autoUpdated.isCustomized).toBe(true);
    expect(autoUpdated.rulesVersion).toBe("Union Budget 2027");
    expect(autoUpdated.rules.equity.ltcgExemptionLimit).toBe(175000);
    expect(autoUpdated.rules.cryptoVda.effectiveRate).toBe(0.208);
  });
});

describe("Self-Updating Tax Rules Engine (Feed & Gemini Grounded Search)", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetAutoTaxCache();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    vi.mocked(getCachedData).mockResolvedValue(null);
    vi.mocked(setCachedData).mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("auto-updates rules from TAX_RULES_FEED_URL when validated by schema", async () => {
    process.env.TAX_RULES_FEED_URL = "https://rules.example.com/india-tax.json";
    delete process.env.GEMINI_API_KEY;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          rulesVersion: "Union Budget 2027 Live Feed",
          statuteReference: "Finance Act, 2027",
          equity: { ltcgExemptionLimit: 200000, ltcgRate: 0.125 },
        },
      }),
    });

    const record = await checkAndAutoUpdateTaxRules({ force: true, assessmentYear: "2027-2028" });
    expect(record.source).toBe("feed");
    expect(record.updated).toBe(true);
    expect(record.rulesVersion).toBe("Union Budget 2027 Live Feed");
    expect(record.override?.equity?.ltcgExemptionLimit).toBe(200000);
    expect(setCachedData).toHaveBeenCalled();
  });

  it("auto-updates via Gemini Google Search grounding and rejects invalid slab shapes", async () => {
    delete process.env.TAX_RULES_FEED_URL;
    process.env.GEMINI_API_KEY = "test-gemini-key";

    // Valid grounded JSON update
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    rulesVersion: "Finance Act 2027 (Search Verified)",
                    statuteReference: "Income-tax Act, 2025 as amended",
                    newRegime: {
                      standardDeduction: 100000,
                      rebate87aMaxIncome: 1200000,
                      rebate87aMaxAmount: 60000,
                      marginalRelief87a: true,
                      slabs: [
                        { upTo: 400000, rate: 0 },
                        { upTo: 800000, rate: 0.05 },
                        { upTo: null, rate: 0.3 },
                      ],
                    },
                  }),
                },
              ],
            },
            groundingMetadata: {
              groundingChunks: [{ web: { uri: "https://www.incometax.gov.in/" } }],
            },
          },
        ],
      }),
    });

    const rec = await checkAndAutoUpdateTaxRules({ force: true, assessmentYear: "2027-2028" });
    expect(rec.source).toBe("gemini_search");
    expect(rec.updated).toBe(true);
    expect(rec.citations).toEqual(["https://www.incometax.gov.in/"]);
    expect(rec.override?.newRegime?.standardDeduction).toBe(100000);

    // Invalid unsorted slabs should be rejected and fall back to built-in statutory rules
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    rulesVersion: "Broken Slabs",
                    newRegime: {
                      slabs: [
                        { upTo: 800000, rate: 0.05 },
                        { upTo: 400000, rate: 0.1 },
                        { upTo: null, rate: 0.3 },
                      ],
                    },
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const recBad = await checkAndAutoUpdateTaxRules({ force: true, assessmentYear: "2027-2028" });
    expect(recBad.source).toBe("builtin");
    expect(recBad.updated).toBe(false);
    expect(recBad.override).toBeNull();
  });
});

describe("Tax Analytics & Self-Updating Rules API Routes", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedRateLimit = vi.mocked(rateLimit);
  const mockedSupabase = vi.mocked(supabaseAdmin);

  beforeEach(() => {
    resetAutoTaxCache();
    vi.clearAllMocks();
    mockedRateLimit.mockResolvedValue({ success: true, remaining: 59, limit: 60, reset: 12345 });
    mockedAuth.mockResolvedValue({
      user: { id: TEST_USER_ID } as User,
      userId: TEST_USER_ID,
      error: null,
    });
    vi.mocked(getCachedData).mockResolvedValue(null);
  });

  function mockPortfolioTables({
    stockTransactions = [],
    fnoTrades = [],
    savedOverrides = null,
    overridesMissingCol = false,
  }: {
    stockTransactions?: Array<Record<string, unknown>>;
    fnoTrades?: Array<Record<string, unknown>>;
    savedOverrides?: Record<string, unknown> | null;
    overridesMissingCol?: boolean;
  }) {
    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === "user_settings") {
        if (overridesMissingCol) {
          return createQueryChain(null, {
            code: "PGRST204",
            message: "Could not find the 'tax_rule_overrides' column in the schema cache",
          });
        }
        return createQueryChain({ tax_rule_overrides: savedOverrides || {} });
      }
      if (table === "stock_transactions") return createQueryChain(stockTransactions);
      if (table === "fno_trades") return createQueryChain(fnoTrades);
      return createQueryChain([]);
    });
  }

  it("filters realized trades to the active current FY while keeping earlier FIFO BUY lots", async () => {
    const currentAy = getCurrentIndianAssessmentYear();
    const { start } = getFiscalYearDateRange(currentAy);
    const activeSellDate = `${start.slice(0, 4)}-08-15`;

    mockPortfolioTables({
      stockTransactions: [
        { symbol: "INFY", type: "BUY", quantity: 10, price: 1000, transaction_date: "2022-05-01" },
        { symbol: "INFY", type: "SELL", quantity: 5, price: 2000, transaction_date: "2024-08-15" },
        { symbol: "INFY", type: "SELL", quantity: 5, price: 3000, transaction_date: activeSellDate },
      ],
      fnoTrades: [
        { pnl: 40000, trade_date: "2024-11-10" },
        { pnl: 25000, trade_date: `${start.slice(0, 4)}-06-20` },
      ],
    });

    const req = new NextRequest("http://localhost:3000/api/v1/analytics/tax");
    const res = await getTaxAnalysis(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.assessmentYear).toBe(currentAy);
    expect(json.data.realized.equityLtcgGain).toBe(10000);
    expect(json.data.realized.fnoIncome).toBe(25000);
  });

  it("applies cached auto-updated tax rules automatically on GET /api/v1/analytics/tax", async () => {
    const currentAy = getCurrentIndianAssessmentYear();
    const { financialYear, start } = getFiscalYearDateRange(currentAy);
    const activeSellDate = `${start.slice(0, 4)}-07-01`;

    vi.mocked(getCachedData).mockResolvedValue({
      assessmentYear: currentAy,
      financialYear,
      source: "feed",
      checkedAt: new Date().toISOString(),
      updated: true,
      rulesVersion: "Budget Auto-Updated Feed",
      statuteReference: "Finance Act",
      citations: [],
      override: {
        rulesVersion: "Budget Auto-Updated Feed",
        equity: { ltcgExemptionLimit: 200000, ltcgRate: 0.1 },
      },
    });

    mockPortfolioTables({
      stockTransactions: [
        { symbol: "RELIANCE", type: "BUY", quantity: 10, price: 1000, transaction_date: "2022-01-10" },
        { symbol: "RELIANCE", type: "SELL", quantity: 10, price: 31000, transaction_date: activeSellDate },
      ],
    });

    const res = await getTaxAnalysis(new NextRequest("http://localhost:3000/api/v1/analytics/tax"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.taxRulesVersion).toBe("Budget Auto-Updated Feed");
    expect(json.data.realized.equityLtcgGain).toBe(300000);
    expect(json.data.realized.equityLtcgTaxable).toBe(100000);
    expect(json.data.realized.equityLtcgTax).toBe(10000);
  });

  it("supports POST /api/v1/analytics/tax, GET/PUT/POST /api/v1/analytics/tax/rules cleanly", async () => {
    mockPortfolioTables({ overridesMissingCol: true });

    const getRes = await getTaxRules(new NextRequest("http://localhost:3000/api/v1/analytics/tax/rules"));
    const getJson = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getJson.data.dbPersistenceAvailable).toBe(false);
    expect(getJson.data.currentPreset).toBeDefined();

    const putRes = await putTaxRules(
      new NextRequest("http://localhost:3000/api/v1/analytics/tax/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: {
            [getCurrentIndianAssessmentYear()]: {
              rulesVersion: "Manual Override Check",
              equity: { ltcgExemptionLimit: 150000 },
            },
          },
        }),
      })
    );
    const putJson = await putRes.json();
    expect(putRes.status).toBe(200);
    expect(putJson.data.savedInDatabase).toBe(false);

    const postAutoRes = await postAutoUpdateTaxRules(
      new NextRequest("http://localhost:3000/api/v1/analytics/tax/rules", { method: "POST" })
    );
    const postAutoJson = await postAutoRes.json();
    expect(postAutoRes.status).toBe(200);
    expect(postAutoJson.data.record.assessmentYear).toBe(getCurrentIndianAssessmentYear());

    const postTaxRes = await postTaxAnalysis(
      new NextRequest("http://localhost:3000/api/v1/analytics/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxSlabRate: 0.3,
          customRulesOverride: { rulesVersion: "Explicit Override" },
        }),
      })
    );
    expect(postTaxRes.status).toBe(200);
  });
});
