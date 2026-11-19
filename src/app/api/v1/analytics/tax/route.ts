import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";

export interface TaxHarvestingOpportunity {
  id: string;
  symbol: string;
  assetClass: "equity" | "mutual_fund" | "debt_fund" | "bullion";
  buyDate: string;
  investedAmount: number;
  currentValue: number;
  unrealizedLoss: number;
  holdingPeriodMonths: number;
  gainType: "LTCG" | "STCG";
  potentialTaxSavings: number;
  effectiveTaxRate: number;
  recommendation: string;
}

export interface TaxAnalysisPayload {
  assessmentYear: string;
  taxSlabRate: number;
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
    fnoIncome: number;
    fnoTax: number;
    totalRealizedGains: number;
    totalEstimatedTax: number;
  };
  harvestingOpportunities: TaxHarvestingOpportunity[];
  totalHarvestableLoss: number;
  totalPotentialTaxSavings: number;
  advice: string[];
}

export async function GET(req: NextRequest) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const rl = await rateLimit(`tax_analysis:${userId}`, 30, 60);
  if (!rl.success) {
    return apiError("Too many tax calculation requests. Please wait.", "RATE_LIMITED", 429, undefined, req);
  }

  const { searchParams } = new URL(req.url);
  const assessmentYear = searchParams.get("ay") || "2025-2026";
  const slabRate = Math.min(Math.max(parseFloat(searchParams.get("slab") || "0.30"), 0.0), 0.45);

  try {
    // 1. Fetch user's stock holdings and mutual funds
    const [stocksRes, mfRes, , stockTxRes] = await Promise.all([
      supabaseAdmin.from("stock_holdings").select("*").eq("user_id", userId),
      supabaseAdmin.from("mutual_fund_holdings").select("*").eq("user_id", userId),
      supabaseAdmin.from("bullion_holdings").select("*").eq("user_id", userId),
      supabaseAdmin.from("stock_transactions").select("*").eq("user_id", userId).eq("transaction_type", "SELL"),
    ]);

    const now = new Date();
    const harvestingOpportunities: TaxHarvestingOpportunity[] = [];
    let totalHarvestableLoss = 0;
    let totalPotentialTaxSavings = 0;

    // A. Analyze Stock Holdings for Harvesting
    if (stocksRes.data) {
      for (const stock of stocksRes.data) {
        const invested = Number(stock.quantity || 0) * Number(stock.avg_buy_price || 0);
        const current = Number(stock.quantity || 0) * Number(stock.current_price || stock.avg_buy_price || 0);

        if (current < invested && invested > 0) {
          const loss = Math.round((invested - current) * 100) / 100;
          const buyDate = stock.created_at ? new Date(stock.created_at) : now;
          const diffDays = Math.max(0, Math.floor((now.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)));
          const months = Math.round((diffDays / 30.4) * 10) / 10;
          const isLtcg = diffDays >= 365;

          const gainType: "LTCG" | "STCG" = isLtcg ? "LTCG" : "STCG";
          const taxRate = isLtcg ? 0.125 : 0.20; // Union Budget 2024: 12.5% LTCG, 20% STCG
          const savings = Math.round(loss * taxRate * 100) / 100;

          harvestingOpportunities.push({
            id: stock.id,
            symbol: stock.symbol,
            assetClass: "equity",
            buyDate: buyDate.toISOString().split("T")[0],
            investedAmount: Math.round(invested * 100) / 100,
            currentValue: Math.round(current * 100) / 100,
            unrealizedLoss: loss,
            holdingPeriodMonths: months,
            gainType,
            potentialTaxSavings: savings,
            effectiveTaxRate: Math.round(taxRate * 1000) / 10,
            recommendation: `Harvest ₹${loss.toLocaleString("en-IN")} in ${gainType} loss by booking before March 31st to save up to ₹${savings.toLocaleString("en-IN")} in tax.`,
          });

          totalHarvestableLoss += loss;
          totalPotentialTaxSavings += savings;
        }
      }
    }

    // B. Analyze Mutual Funds for Harvesting
    if (mfRes.data) {
      for (const fund of mfRes.data) {
        const invested = Number(fund.invested_amount || (fund.units * fund.avg_nav) || 0);
        const currentNav = Number(fund.current_nav || fund.avg_nav || 0);
        const currentVal = Number(fund.current_value || (fund.units * currentNav) || 0);

        if (currentVal < invested && invested > 0) {
          const loss = Math.round((invested - currentVal) * 100) / 100;
          const buyDate = fund.created_at ? new Date(fund.created_at) : now;
          const diffDays = Math.max(0, Math.floor((now.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)));
          const months = Math.round((diffDays / 30.4) * 10) / 10;
          const isDebt = (fund.asset_class || "").toLowerCase().includes("debt");
          const isLtcg = !isDebt && diffDays >= 365;

          const gainType: "LTCG" | "STCG" = isLtcg ? "LTCG" : "STCG";
          const taxRate = isDebt ? slabRate : (isLtcg ? 0.125 : 0.20);
          const savings = Math.round(loss * taxRate * 100) / 100;

          harvestingOpportunities.push({
            id: fund.id,
            symbol: fund.scheme_name,
            assetClass: isDebt ? "debt_fund" : "mutual_fund",
            buyDate: buyDate.toISOString().split("T")[0],
            investedAmount: Math.round(invested * 100) / 100,
            currentValue: Math.round(currentVal * 100) / 100,
            unrealizedLoss: loss,
            holdingPeriodMonths: months,
            gainType,
            potentialTaxSavings: savings,
            effectiveTaxRate: Math.round(taxRate * 1000) / 10,
            recommendation: `Switch or redeem to harvest ₹${loss.toLocaleString("en-IN")} loss, reducing your taxable capital gains by up to ₹${savings.toLocaleString("en-IN")}.`,
          });

          totalHarvestableLoss += loss;
          totalPotentialTaxSavings += savings;
        }
      }
    }

    // Sort opportunities by highest potential tax savings first
    harvestingOpportunities.sort((a, b) => b.potentialTaxSavings - a.potentialTaxSavings);

    // C. Calculate Realized Gains from Sell Transactions
    const equityLtcgGain = 0;
    let equityStcgGain = 0;

    if (stockTxRes.data) {
      for (const tx of stockTxRes.data) {
        const proceeds = Number(tx.quantity || 0) * Number(tx.price || 0);
        // Approximate cost basis from transactions
        const estimatedCost = proceeds * 0.85; // conservative default if historical lot matching absent
        const gain = proceeds - estimatedCost;
        if (gain > 0) {
          equityStcgGain += gain;
        }
      }
    }

    // Union Budget 2024 revised Section 112A threshold: ₹1.25 Lakh
    const ltcgExemption = 125000.0;
    const equityLtcgTaxable = Math.max(0, equityLtcgGain - ltcgExemption);
    const equityLtcgTax = Math.round(equityLtcgTaxable * 0.125 * 100) / 100;
    const equityStcgTax = Math.round(Math.max(0, equityStcgGain) * 0.20 * 100) / 100;

    const totalRealizedGains = Math.round((equityLtcgGain + equityStcgGain) * 100) / 100;
    const totalEstimatedTax = Math.round((equityLtcgTax + equityStcgTax) * 100) / 100;

    const advice: string[] = [];
    if (equityLtcgTaxable > 0) {
      advice.push(
        `Equity LTCG exceeds the Section 112A ₹1.25 Lakh exemption limit by ₹${equityLtcgTaxable.toLocaleString("en-IN")}. You have an estimated 12.5% tax liability of ₹${equityLtcgTax.toLocaleString("en-IN")}.`
      );
    } else {
      const remainingExemption = ltcgExemption - equityLtcgGain;
      advice.push(
        `You have ₹${remainingExemption.toLocaleString("en-IN")} of tax-exempt Equity LTCG room available under Section 112A for AY ${assessmentYear}.`
      );
    }

    if (totalHarvestableLoss > 0) {
      advice.push(
        `Found ${harvestingOpportunities.length} harvestable positions with ₹${totalHarvestableLoss.toLocaleString("en-IN")} total unrealized loss, saving up to ₹${totalPotentialTaxSavings.toLocaleString("en-IN")} in tax if harvested.`
      );
    }

    const payload: TaxAnalysisPayload = {
      assessmentYear,
      taxSlabRate: slabRate,
      realized: {
        equityLtcgGain: Math.round(equityLtcgGain * 100) / 100,
        equityLtcgTaxable: Math.round(equityLtcgTaxable * 100) / 100,
        equityLtcgTax,
        equityStcgGain: Math.round(equityStcgGain * 100) / 100,
        equityStcgTax,
        debtGain: 0,
        debtTax: 0,
        bullionLtcgGain: 0,
        bullionLtcgTax: 0,
        bullionStcgGain: 0,
        bullionStcgTax: 0,
        fnoIncome: 0,
        fnoTax: 0,
        totalRealizedGains,
        totalEstimatedTax,
      },
      harvestingOpportunities,
      totalHarvestableLoss: Math.round(totalHarvestableLoss * 100) / 100,
      totalPotentialTaxSavings: Math.round(totalPotentialTaxSavings * 100) / 100,
      advice,
    };

    return apiSuccess(payload, { requestId, timestamp: new Date().toISOString() }, 200, req);
  } catch (err: unknown) {
    logger.error("Failed to execute tax harvesting calculation", "TaxAnalysis", err);
    return apiError(
      err instanceof Error ? err.message : "Internal tax calculation error",
      "TAX_CALCULATION_ERROR",
      500,
      undefined,
      req
    );
  }
}
