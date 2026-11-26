import { z } from "zod";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { roundMoney, addMoney, subMoney, mulMoney, sumMoney } from "@/utils/money";
import {
  AutoTaxUpdateRecord,
  checkAndAutoUpdateTaxRules,
  getCachedAutoTaxRecord,
} from "@/utils/taxAutoUpdater";
import {
  TaxRuleOverride,
  TaxRuleOverrideSchema,
  TaxRuleOverridesMapSchema,
  TaxRuleSet,
  getCurrentIndianAssessmentYear,
  getFiscalYearDateRange,
  normalizeAssessmentYear,
  resolveTaxYearPreset,
} from "@/utils/taxRules";

export interface TaxHarvestingOpportunity {
  id: string;
  symbol: string;
  assetClass: "equity" | "mutual_fund" | "debt_fund" | "bullion" | "crypto";
  buyDate: string;
  investedAmount: number;
  currentValue: number;
  unrealizedLoss: number;
  holdingPeriodMonths: number;
  gainType: "LTCG" | "STCG" | "VDA_LOSS_UNOFFSETTABLE";
  potentialTaxSavings: number;
  effectiveTaxRate: number;
  recommendation: string;
}

export interface TaxAnalysisPayload {
  assessmentYear: string;
  financialYear: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  taxSlabRate: number;
  taxRulesVersion: string;
  statuteReference: string;
  isCustomized: boolean;
  rulesUsed: TaxRuleSet;
  disclaimer: string;
  realized: {
    equityLtcgGain: number;
    equityLtcgTaxable: number;
    equityLtcgTax: number;
    equityStcgGain: number;
    equityStcgTax: number;
    debtGain: number;
    debtTax: number;
    bullionLtcgGain: number;
    bullionLtcgTax: number;
    bullionStcgGain: number;
    bullionStcgTax: number;
    bondsLtcgGain: number;
    bondsLtcgTax: number;
    bondsStcgGain: number;
    bondsStcgTax: number;
    cryptoGain: number;
    cryptoLosses: number;
    cryptoTax: number;
    fnoIncome: number;
    fnoTax: number;
    totalRealizedGains: number;
    totalEstimatedTax: number;
  };
  harvestingOpportunities: TaxHarvestingOpportunity[];
  totalHarvestableLoss: number;
  totalPotentialTaxSavings: number;
  autoUpdateStatus?: Pick<AutoTaxUpdateRecord, "source" | "checkedAt" | "updated" | "citations">;
  regimeComparison?: Record<string, unknown>;
  advice: string[];
}

interface FifoLot {
  quantity: number;
  price: number;
  timestampMs: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const PostTaxAnalysisSchema = z.object({
  assessmentYear: z.string().optional(),
  taxSlabRate: z.number().min(0).max(0.45).optional(),
  customRulesOverride: TaxRuleOverrideSchema.optional().nullable(),
});

function toIsoDateOnly(raw: string | null | undefined, fallbackIso: string): string {
  if (!raw) return fallbackIso;
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const ms = Date.parse(str);
  return Number.isNaN(ms) ? fallbackIso : new Date(ms).toISOString().split("T")[0];
}

function buildDisclaimer(rulesVersion: string, statuteReference: string): string {
  return (
    `Estimated Indian capital gains tax analysis based on ${rulesVersion} (${statuteReference}). ` +
    "Calculations are simulated for personal portfolio planning and tax-loss harvesting only. " +
    "They do not constitute certified tax filings under the Income Tax Department. " +
    "Please consult a certified Chartered Accountant or tax advisor before filing ITR."
  );
}

async function loadSavedRuleOverrideForYear(
  userId: string,
  assessmentYear: string
): Promise<TaxRuleOverride | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .select("tax_rule_overrides")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    const parsed = TaxRuleOverridesMapSchema.safeParse(
      (data as Record<string, unknown>).tax_rule_overrides
    );
    return parsed.success ? parsed.data[assessmentYear] || null : null;
  } catch {
    return null;
  }
}

interface FifoProcessorConfig<T> {
  rows: T[] | null;
  fyStart: string;
  fyEnd: string;
  fallbackIso: string;
  qtyPrecision?: number;
  epsilon?: number;
  unmatchedCostRatio?: number | null;
  getKey: (row: T) => string;
  getSide: (row: T) => "BUY" | "SELL" | "SKIP";
  getQty: (row: T) => number;
  getPrice: (row: T) => number;
  getRawDate: (row: T) => string | null | undefined;
  requirePositivePrice?: boolean;
  onRealized: (key: string, gain: number, holdingDays: number) => void;
}

/**
 * Shared FIFO inventory matcher that builds cost basis from all prior BUY lots
 * and records realized gains strictly for disposals settling within [fyStart, fyEnd].
 */
function processFifoRealized<T>(cfg: FifoProcessorConfig<T>): void {
  if (!cfg.rows?.length) return;
  const inventory = new Map<string, FifoLot[]>();
  const qtyPrecision = cfg.qtyPrecision ?? 6;
  const epsilon = cfg.epsilon ?? 0.000001;
  const requirePrice = cfg.requirePositivePrice ?? true;

  for (const row of cfg.rows) {
    const key = cfg.getKey(row);
    const side = cfg.getSide(row);
    const qty = cfg.getQty(row);
    const price = cfg.getPrice(row);
    if (!key || side === "SKIP" || qty <= 0 || (requirePrice && price <= 0)) continue;

    const txDateStr = toIsoDateOnly(cfg.getRawDate(row), cfg.fallbackIso);
    if (txDateStr > cfg.fyEnd) continue;

    if (side === "BUY") {
      const lots = inventory.get(key) || [];
      lots.push({ quantity: qty, price, timestampMs: Date.parse(txDateStr) });
      inventory.set(key, lots);
      continue;
    }

    const inSelectedFy = txDateStr >= cfg.fyStart;
    const sellMs = Date.parse(txDateStr);
    const lots = inventory.get(key) || [];
    let unfilled = qty;

    while (unfilled > 0 && lots.length > 0) {
      const lot = lots[0];
      const matched = Math.min(unfilled, lot.quantity);
      if (inSelectedFy) {
        const gain = subMoney(mulMoney(matched, price), mulMoney(matched, lot.price));
        const holdingDays = Math.max(0, Math.floor((sellMs - lot.timestampMs) / MS_PER_DAY));
        cfg.onRealized(key, gain, holdingDays);
      }
      lot.quantity = Math.max(0, +(lot.quantity - matched).toFixed(qtyPrecision));
      unfilled = Math.max(0, +(unfilled - matched).toFixed(qtyPrecision));
      if (lot.quantity <= epsilon) lots.shift();
    }

    if (unfilled > epsilon && inSelectedFy && cfg.unmatchedCostRatio != null) {
      const saleProceeds = mulMoney(unfilled, price);
      cfg.onRealized(key, subMoney(saleProceeds, mulMoney(saleProceeds, cfg.unmatchedCostRatio)), 0);
    }
  }
}

interface HarvestingParams {
  id: string;
  symbol: string;
  assetClass: TaxHarvestingOpportunity["assetClass"];
  createdAt?: string | null;
  invested: number;
  currentValue: number;
  isLtcg: (diffDays: number) => boolean;
  taxRate: (isLtcg: boolean) => number;
  recommendation: (loss: number, savings: number, gainType: "LTCG" | "STCG") => string;
  nowMs: number;
  fallbackIso: string;
}

function buildHarvestingOpportunity(p: HarvestingParams): TaxHarvestingOpportunity | null {
  if (!(p.currentValue < p.invested && p.invested > 0)) return null;
  const loss = subMoney(p.invested, p.currentValue);
  const buyDateStr = toIsoDateOnly(p.createdAt, p.fallbackIso);
  const diffDays = Math.max(0, Math.floor((p.nowMs - Date.parse(buyDateStr)) / MS_PER_DAY));
  const isLtcg = p.isLtcg(diffDays);
  const gainType: "LTCG" | "STCG" = isLtcg ? "LTCG" : "STCG";
  const rate = p.taxRate(isLtcg);
  const savings = roundMoney(mulMoney(loss, rate));

  return {
    id: p.id,
    symbol: p.symbol,
    assetClass: p.assetClass,
    buyDate: buyDateStr,
    investedAmount: roundMoney(p.invested),
    currentValue: roundMoney(p.currentValue),
    unrealizedLoss: loss,
    holdingPeriodMonths: Math.round((diffDays / 30.4) * 10) / 10,
    gainType,
    potentialTaxSavings: savings,
    effectiveTaxRate: Math.round(rate * 1000) / 10,
    recommendation: p.recommendation(loss, savings, gainType),
  };
}

async function computeTaxAnalysis(
  userId: string,
  rawAssessmentYear?: string | null,
  rawSlabRate?: number,
  explicitOverride?: TaxRuleOverride | null
): Promise<TaxAnalysisPayload> {
  const assessmentYear = normalizeAssessmentYear(rawAssessmentYear || getCurrentIndianAssessmentYear());
  const slabRate = Math.min(Math.max(Number.isFinite(rawSlabRate) ? rawSlabRate! : 0.3, 0.0), 0.45);

  const [savedOverride, initialAutoRecord] = await Promise.all([
    explicitOverride !== undefined ? Promise.resolve(null) : loadSavedRuleOverrideForYear(userId, assessmentYear),
    getCachedAutoTaxRecord(assessmentYear),
  ]);

  let autoRecord = initialAutoRecord;
  if (
    !autoRecord &&
    explicitOverride === undefined &&
    process.env.NODE_ENV !== "test" &&
    (process.env.TAX_RULES_FEED_URL || process.env.GEMINI_API_KEY)
  ) {
    autoRecord = await checkAndAutoUpdateTaxRules({ assessmentYear });
  }

  const override = explicitOverride !== undefined ? explicitOverride : savedOverride ?? autoRecord?.override ?? null;
  const preset = resolveTaxYearPreset(assessmentYear, override);
  const rules = preset.rules;
  const { financialYear, start: fyStart, end: fyEnd } = getFiscalYearDateRange(preset.assessmentYear);

  const [
    stocksRes,
    mfRes,
    bondsRes,
    bullionRes,
    stockTxRes,
    mfTxRes,
    bondTxRes,
    bullionTxRes,
    fnoTradesRes,
    cryptoTradesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("stock_holdings")
      .select("id, symbol, quantity, avg_buy_price, current_price, created_at")
      .eq("user_id", userId),
    supabaseAdmin
      .from("mutual_fund_holdings")
      .select("id, scheme_code, scheme_name, asset_class, category, units, avg_nav, current_nav, invested_amount, current_value, created_at")
      .eq("user_id", userId),
    supabaseAdmin
      .from("bond_holdings")
      .select("id, name, isin, quantity, avg_buy_price, current_price, invested_amount, created_at")
      .eq("user_id", userId),
    supabaseAdmin
      .from("bullion_holdings")
      .select("id, metal, weight_grams, total_buy_price, current_rate_per_gram, created_at")
      .eq("user_id", userId),
    supabaseAdmin
      .from("stock_transactions")
      .select("symbol, type, quantity, price, transaction_date, created_at")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: true }),
    supabaseAdmin
      .from("mutual_fund_transactions")
      .select("scheme_code, scheme_name, type, units, nav, transaction_date, created_at")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: true }),
    supabaseAdmin
      .from("bond_transactions")
      .select("isin, type, quantity, price, transaction_date, created_at")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: true }),
    supabaseAdmin
      .from("bullion_transactions")
      .select("metal, type, weight_grams, price_per_gram, transaction_date, created_at")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: true }),
    supabaseAdmin
      .from("fno_trades")
      .select("pnl, trade_date, created_at")
      .eq("user_id", userId)
      .order("trade_date", { ascending: true }),
    supabaseAdmin
      .from("crypto_trades")
      .select("symbol, is_buyer, side, qty, price, executed_at, created_at")
      .eq("user_id", userId)
      .order("executed_at", { ascending: true }),
  ]);

  const nowMs = Date.now();
  const fallbackIso = new Date(nowMs).toISOString().split("T")[0];
  const harvestingOpportunities: TaxHarvestingOpportunity[] = [];
  let totalHarvestableLoss = 0;
  let totalPotentialTaxSavings = 0;

  const pushOpportunity = (opp: TaxHarvestingOpportunity | null) => {
    if (!opp) return;
    harvestingOpportunities.push(opp);
    totalHarvestableLoss = addMoney(totalHarvestableLoss, opp.unrealizedLoss);
    totalPotentialTaxSavings = addMoney(totalPotentialTaxSavings, opp.potentialTaxSavings);
  };

  for (const s of stocksRes.data || []) {
    const qty = Number(s.quantity || 0);
    pushOpportunity(
      buildHarvestingOpportunity({
        id: s.id,
        symbol: s.symbol,
        assetClass: "equity",
        createdAt: s.created_at,
        invested: mulMoney(qty, Number(s.avg_buy_price || 0)),
        currentValue: mulMoney(qty, Number(s.current_price || s.avg_buy_price || 0)),
        isLtcg: (d) => d >= rules.equity.ltcgThresholdDays,
        taxRate: (ltcg) => (ltcg ? rules.equity.ltcgRate : rules.equity.stcgRate),
        recommendation: (loss, savings, gt) =>
          `Harvest ₹${loss.toLocaleString("en-IN")} in ${gt} loss by booking before March 31st to save up to ₹${savings.toLocaleString("en-IN")} in tax.`,
        nowMs,
        fallbackIso,
      })
    );
  }

  const mfDebtByCode = new Map<string, boolean>();
  for (const fund of mfRes.data || []) {
    const isDebt =
      (fund.asset_class || "").toLowerCase().includes("debt") ||
      (fund.category || "").toLowerCase().includes("debt");
    if (fund.scheme_code) mfDebtByCode.set(String(fund.scheme_code).toUpperCase(), isDebt);

    const units = Number(fund.units || 0);
    const curNav = Number(fund.current_nav || fund.avg_nav || 0);
    pushOpportunity(
      buildHarvestingOpportunity({
        id: fund.id,
        symbol: fund.scheme_name,
        assetClass: isDebt ? "debt_fund" : "mutual_fund",
        createdAt: fund.created_at,
        invested: Number(fund.invested_amount || mulMoney(units, Number(fund.avg_nav || 0)) || 0),
        currentValue: Number(fund.current_value || mulMoney(units, curNav) || 0),
        isLtcg: (d) => !isDebt && d >= rules.equity.ltcgThresholdDays,
        taxRate: (ltcg) => (isDebt ? slabRate : ltcg ? rules.equity.ltcgRate : rules.equity.stcgRate),
        recommendation: (loss, savings) =>
          `Switch or redeem to harvest ₹${loss.toLocaleString("en-IN")} loss, reducing your taxable capital gains by up to ₹${savings.toLocaleString("en-IN")}.`,
        nowMs,
        fallbackIso,
      })
    );
  }

  for (const bul of bullionRes.data || []) {
    const invested = Number(bul.total_buy_price || 0);
    const curRate = Number(bul.current_rate_per_gram || 0);
    pushOpportunity(
      buildHarvestingOpportunity({
        id: bul.id,
        symbol: `${bul.metal || "Gold"} Bullion`,
        assetClass: "bullion",
        createdAt: bul.created_at,
        invested,
        currentValue: curRate > 0 ? mulMoney(Number(bul.weight_grams || 0), curRate) : invested,
        isLtcg: (d) => d >= rules.bullion.ltcgThresholdDays,
        taxRate: (ltcg) => (ltcg ? rules.bullion.ltcgRate : slabRate),
        recommendation: (loss, savings) =>
          `Harvest ₹${loss.toLocaleString("en-IN")} bullion loss to offset other capital gains and save ~₹${savings.toLocaleString("en-IN")}.`,
        nowMs,
        fallbackIso,
      })
    );
  }

  for (const bond of bondsRes.data || []) {
    const qty = Number(bond.quantity || 1);
    const avgPrice = Number(bond.avg_buy_price || 1000);
    const curPrice = Number(bond.current_price) > 0 ? Number(bond.current_price) : avgPrice;
    pushOpportunity(
      buildHarvestingOpportunity({
        id: bond.id,
        symbol: bond.name || bond.isin || "Bond",
        assetClass: "debt_fund",
        createdAt: bond.created_at,
        invested: Number(bond.invested_amount || mulMoney(qty, avgPrice)),
        currentValue: mulMoney(qty, curPrice),
        isLtcg: (d) => d >= rules.bondsListed.ltcgThresholdDays,
        taxRate: (ltcg) => (ltcg ? rules.bondsListed.ltcgRate : slabRate),
        recommendation: (loss, savings) =>
          `Harvest ₹${loss.toLocaleString("en-IN")} bond loss to offset gains and save ~₹${savings.toLocaleString("en-IN")}.`,
        nowMs,
        fallbackIso,
      })
    );
  }

  harvestingOpportunities.sort((a, b) => b.potentialTaxSavings - a.potentialTaxSavings);

  let equityLtcgGain = 0;
  let equityStcgGain = 0;
  let debtGain = 0;
  let bullionLtcgGain = 0;
  let bullionStcgGain = 0;
  let bondsLtcgGain = 0;
  let bondsStcgGain = 0;
  let cryptoGain = 0;
  let cryptoLosses = 0;
  let fnoIncome = 0;

  processFifoRealized({
    rows: stockTxRes.data,
    fyStart,
    fyEnd,
    fallbackIso,
    unmatchedCostRatio: 0.85,
    getKey: (tx) => (tx.symbol || "").trim().toUpperCase(),
    getSide: (tx) => {
      const t = (tx.type || "").toUpperCase();
      return t === "BUY" ? "BUY" : t === "SELL" ? "SELL" : "SKIP";
    },
    getQty: (tx) => Number(tx.quantity || 0),
    getPrice: (tx) => Number(tx.price || 0),
    getRawDate: (tx) => tx.transaction_date || tx.created_at,
    onRealized: (_sym, gain, days) => {
      if (days >= rules.equity.ltcgThresholdDays) equityLtcgGain = addMoney(equityLtcgGain, gain);
      else equityStcgGain = addMoney(equityStcgGain, gain);
    },
  });

  processFifoRealized({
    rows: mfTxRes.data,
    fyStart,
    fyEnd,
    fallbackIso,
    getKey: (tx) => (tx.scheme_code || tx.scheme_name || "").trim().toUpperCase(),
    getSide: (tx) => {
      const t = (tx.type || "").toUpperCase();
      if (t === "BUY" || t === "SIP" || t === "PURCHASE") return "BUY";
      if (t === "SELL" || t === "REDEEM" || t === "SWP") return "SELL";
      return "SKIP";
    },
    getQty: (tx) => Number(tx.units || 0),
    getPrice: (tx) => Number(tx.nav || 0),
    getRawDate: (tx) => tx.transaction_date || tx.created_at,
    onRealized: (code, gain, days) => {
      if (mfDebtByCode.get(code)) debtGain = addMoney(debtGain, gain);
      else if (days >= rules.equity.ltcgThresholdDays) equityLtcgGain = addMoney(equityLtcgGain, gain);
      else equityStcgGain = addMoney(equityStcgGain, gain);
    },
  });

  processFifoRealized({
    rows: bullionTxRes.data,
    fyStart,
    fyEnd,
    fallbackIso,
    getKey: (tx) => (tx.metal || "GOLD").trim().toUpperCase(),
    getSide: (tx) => {
      const t = (tx.type || "").toUpperCase();
      return t === "BUY" ? "BUY" : t === "SELL" ? "SELL" : "SKIP";
    },
    getQty: (tx) => Number(tx.weight_grams || 0),
    getPrice: (tx) => Number(tx.price_per_gram || 0),
    getRawDate: (tx) => tx.transaction_date || tx.created_at,
    onRealized: (_metal, gain, days) => {
      if (days >= rules.bullion.ltcgThresholdDays) bullionLtcgGain = addMoney(bullionLtcgGain, gain);
      else bullionStcgGain = addMoney(bullionStcgGain, gain);
    },
  });

  processFifoRealized({
    rows: bondTxRes.data,
    fyStart,
    fyEnd,
    fallbackIso,
    requirePositivePrice: false,
    getKey: (tx) => (tx.isin || "").trim().toUpperCase(),
    getSide: (tx) => {
      const t = (tx.type || "").toUpperCase();
      if (t === "BUY") return "BUY";
      if (t === "SELL" || t === "MATURITY_REDEMPTION") return "SELL";
      return "SKIP";
    },
    getQty: (tx) => Number(tx.quantity || 0),
    getPrice: (tx) => Number(tx.price || 0),
    getRawDate: (tx) => tx.transaction_date || tx.created_at,
    onRealized: (_isin, gain, days) => {
      if (days >= rules.bondsListed.ltcgThresholdDays) bondsLtcgGain = addMoney(bondsLtcgGain, gain);
      else bondsStcgGain = addMoney(bondsStcgGain, gain);
    },
  });

  for (const trade of fnoTradesRes.data || []) {
    const dt = toIsoDateOnly(trade.trade_date || trade.created_at, fallbackIso);
    if (dt >= fyStart && dt <= fyEnd && trade.pnl != null) {
      fnoIncome = addMoney(fnoIncome, Number(trade.pnl) || 0);
    }
  }

  processFifoRealized({
    rows: cryptoTradesRes.data,
    fyStart,
    fyEnd,
    fallbackIso,
    qtyPrecision: 8,
    epsilon: 0.00000001,
    unmatchedCostRatio: 0.9,
    getKey: (t) => (t.symbol || "").trim().toUpperCase(),
    getSide: (t) => (t.is_buyer === true || (t.side || "").toUpperCase() === "BUY" ? "BUY" : "SELL"),
    getQty: (t) => Number(t.qty || 0),
    getPrice: (t) => Number(t.price || 0),
    getRawDate: (t) => t.executed_at || t.created_at,
    onRealized: (_sym, gain) => {
      if (gain > 0) cryptoGain = addMoney(cryptoGain, gain);
      else cryptoLosses = addMoney(cryptoLosses, Math.abs(gain));
    },
  });

  // Section 70 & 71 STCL -> LTCG intra-head offset
  let adjustedEquityLtcg = equityLtcgGain;
  let adjustedEquityStcg = equityStcgGain;
  if (adjustedEquityStcg < 0 && adjustedEquityLtcg > 0) {
    const offset = Math.min(Math.abs(adjustedEquityStcg), adjustedEquityLtcg);
    adjustedEquityLtcg = subMoney(adjustedEquityLtcg, offset);
    adjustedEquityStcg = addMoney(adjustedEquityStcg, offset);
  }

  const ltcgExemption = rules.equity.ltcgExemptionLimit;
  const equityLtcgTaxable = Math.max(0, subMoney(adjustedEquityLtcg, ltcgExemption));
  const equityLtcgTax = roundMoney(mulMoney(equityLtcgTaxable, rules.equity.ltcgRate));
  const equityStcgTax = roundMoney(mulMoney(Math.max(0, adjustedEquityStcg), rules.equity.stcgRate));

  const debtTax = roundMoney(mulMoney(Math.max(0, debtGain), slabRate));
  const bullionLtcgTax = roundMoney(mulMoney(Math.max(0, bullionLtcgGain), rules.bullion.ltcgRate));
  const bullionStcgTax = roundMoney(mulMoney(Math.max(0, bullionStcgGain), slabRate));
  const bondsLtcgTax = roundMoney(mulMoney(Math.max(0, bondsLtcgGain), rules.bondsListed.ltcgRate));
  const bondsStcgTax = roundMoney(mulMoney(Math.max(0, bondsStcgGain), slabRate));
  const fnoTax = roundMoney(mulMoney(Math.max(0, fnoIncome), slabRate));
  const cryptoTaxable = rules.cryptoVda.allowLossSetoff
    ? Math.max(0, subMoney(cryptoGain, cryptoLosses))
    : cryptoGain;
  const cryptoTax = roundMoney(mulMoney(cryptoTaxable, rules.cryptoVda.effectiveRate));

  const totalRealizedGains = roundMoney(
    sumMoney([
      equityLtcgGain,
      equityStcgGain,
      debtGain,
      bullionLtcgGain,
      bullionStcgGain,
      bondsLtcgGain,
      bondsStcgGain,
      cryptoGain,
      fnoIncome,
    ])
  );
  const totalEstimatedTax = roundMoney(
    sumMoney([
      equityLtcgTax,
      equityStcgTax,
      debtTax,
      bullionLtcgTax,
      bullionStcgTax,
      bondsLtcgTax,
      bondsStcgTax,
      cryptoTax,
      fnoTax,
    ])
  );

  const ltcgPct = +(rules.equity.ltcgRate * 100).toFixed(2);
  const stcgPct = +(rules.equity.stcgRate * 100).toFixed(2);
  const advice: string[] = [];
  if (equityLtcgTaxable > 0) {
    advice.push(
      `Equity LTCG exceeds the Section 112A ₹${ltcgExemption.toLocaleString("en-IN")} exemption limit by ₹${equityLtcgTaxable.toLocaleString("en-IN")}. You have an estimated ${ltcgPct}% tax liability of ₹${equityLtcgTax.toLocaleString("en-IN")}.`
    );
  } else if (equityLtcgGain > 0) {
    const remainingExemption = Math.max(0, subMoney(ltcgExemption, equityLtcgGain));
    advice.push(
      `You have ₹${remainingExemption.toLocaleString("en-IN")} of tax-exempt Equity LTCG room available under Section 112A for AY ${preset.assessmentYear}.`
    );
  }
  if (equityStcgGain > 0) {
    advice.push(
      `You have ₹${equityStcgGain.toLocaleString("en-IN")} in taxable STCG (taxed at ${stcgPct}% under Section 111A). You can harvest available short-term losses to directly neutralize this liability.`
    );
  }
  if (cryptoLosses > 0) {
    advice.push(
      `Note: You have ₹${cryptoLosses.toLocaleString("en-IN")} in cryptocurrency losses. Section 115BBH strictly prohibits setting off crypto losses against capital gains from stocks, mutual funds, or other crypto.`
    );
  }
  if (totalHarvestableLoss > 0) {
    advice.push(
      `Found ${harvestingOpportunities.length} harvestable positions with ₹${totalHarvestableLoss.toLocaleString("en-IN")} total unrealized loss, saving up to ₹${totalPotentialTaxSavings.toLocaleString("en-IN")} in tax if harvested.`
    );
  }

  return {
    assessmentYear: preset.assessmentYear,
    financialYear,
    fiscalYearStart: fyStart,
    fiscalYearEnd: fyEnd,
    taxSlabRate: slabRate,
    taxRulesVersion: preset.rulesVersion,
    statuteReference: preset.statuteReference,
    isCustomized: preset.isCustomized,
    rulesUsed: rules,
    disclaimer: buildDisclaimer(preset.rulesVersion, preset.statuteReference),
    realized: {
      equityLtcgGain: roundMoney(equityLtcgGain),
      equityLtcgTaxable: roundMoney(equityLtcgTaxable),
      equityLtcgTax,
      equityStcgGain: roundMoney(equityStcgGain),
      equityStcgTax,
      debtGain: roundMoney(debtGain),
      debtTax,
      bullionLtcgGain: roundMoney(bullionLtcgGain),
      bullionLtcgTax,
      bullionStcgGain: roundMoney(bullionStcgGain),
      bullionStcgTax,
      bondsLtcgGain: roundMoney(bondsLtcgGain),
      bondsLtcgTax,
      bondsStcgGain: roundMoney(bondsStcgGain),
      bondsStcgTax,
      cryptoGain: roundMoney(cryptoGain),
      cryptoLosses: roundMoney(cryptoLosses),
      cryptoTax,
      fnoIncome: roundMoney(fnoIncome),
      fnoTax,
      totalRealizedGains,
      totalEstimatedTax,
    },
    harvestingOpportunities,
    totalHarvestableLoss: roundMoney(totalHarvestableLoss),
    totalPotentialTaxSavings: roundMoney(totalPotentialTaxSavings),
    ...(autoRecord
      ? {
          autoUpdateStatus: {
            source: autoRecord.source,
            checkedAt: autoRecord.checkedAt,
            updated: autoRecord.updated,
            citations: autoRecord.citations,
          },
        }
      : {}),
    advice,
  };
}

export const GET = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  handler: async ({ userId, query }) => {
    const rawSlab = query.get("slab");
    return computeTaxAnalysis(userId!, query.get("ay"), rawSlab ? parseFloat(rawSlab) : 0.3);
  },
});

export const POST = createApiRoute({
  rateLimit: { limit: 60, windowSeconds: 60 },
  schema: PostTaxAnalysisSchema,
  handler: async ({ userId, body, query }) => {
    const slab = body.taxSlabRate ?? (query.get("slab") ? parseFloat(query.get("slab")!) : 0.3);
    return computeTaxAnalysis(
      userId!,
      body.assessmentYear || query.get("ay"),
      slab,
      body.customRulesOverride
    );
  },
});
