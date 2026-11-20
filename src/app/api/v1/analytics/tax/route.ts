import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, extractRequestId } from "@/utils/apiResponse";
import { rateLimit } from "@/utils/rateLimit";
import { logger } from "@/utils/logger";

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
  taxSlabRate: number;
  taxRulesVersion: string;
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
  advice: string[];
}

export const DISCLAIMER_TEXT =
  "Estimated Indian capital gains tax analysis based on Union Budget 2024 provisions (Finance (No. 2) Act, 2024). " +
  "Calculations are simulated for personal portfolio planning and tax-loss harvesting only. " +
  "They do not constitute certified tax filings under the Income Tax Department. " +
  "Please consult a certified Chartered Accountant or tax advisor before filing ITR.";

interface StockLot {
  quantity: number;
  price: number;
  date: Date;
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
  const assessmentYear = searchParams.get("ay") || "2025-26";
  const slabRate = Math.min(Math.max(parseFloat(searchParams.get("slab") || "0.30"), 0.0), 0.45);

  try {
    // 1. Fetch user's stock holdings, mutual funds, bullion, stock transactions, and crypto trades
    const [stocksRes, mfRes, bullionRes, stockTxRes, cryptoTradesRes] = await Promise.all([
      supabaseAdmin.from("stock_holdings").select("*").eq("user_id", userId),
      supabaseAdmin.from("mutual_fund_holdings").select("*").eq("user_id", userId),
      supabaseAdmin.from("bullion_holdings").select("*").eq("user_id", userId),
      supabaseAdmin.from("stock_transactions").select("*").eq("user_id", userId).order("transaction_date", { ascending: true }),
      supabaseAdmin.from("crypto_trades").select("*").eq("user_id", userId).order("executed_at", { ascending: true }),
    ]);

    const now = new Date();
    const harvestingOpportunities: TaxHarvestingOpportunity[] = [];
    let totalHarvestableLoss = 0;
    let totalPotentialTaxSavings = 0;

    // A. Analyze Stock Holdings for Tax-Loss Harvesting
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
          const taxRate = isLtcg ? 0.125 : 0.20; // Union Budget 2024: 12.5% LTCG (Sec 112A), 20% STCG (Sec 111A)
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
        const invested = Number(fund.invested_amount || (Number(fund.units || 0) * Number(fund.avg_nav || 0)) || 0);
        const currentNav = Number(fund.current_nav || fund.avg_nav || 0);
        const currentVal = Number(fund.current_value || (Number(fund.units || 0) * currentNav) || 0);

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

    // C. Calculate Realized Gains from Stock Transactions using Strict FIFO Matching
    let equityLtcgGain = 0;
    let equityStcgGain = 0;

    if (stockTxRes.data && stockTxRes.data.length > 0) {
      const inventory = new Map<string, StockLot[]>();

      for (const tx of stockTxRes.data) {
        const sym = (tx.symbol || "").trim().toUpperCase();
        const txType = (tx.type || "").toUpperCase();
        const qty = Number(tx.quantity || 0);
        const price = Number(tx.price || 0);
        const txDate = tx.transaction_date ? new Date(tx.transaction_date) : new Date(tx.created_at || now);

        if (!sym || qty <= 0 || price <= 0) continue;

        if (txType === "BUY") {
          const lots = inventory.get(sym) || [];
          lots.push({ quantity: qty, price, date: txDate });
          inventory.set(sym, lots);
        } else if (txType === "SELL") {
          let unfilled = qty;
          const lots = inventory.get(sym) || [];

          while (unfilled > 0 && lots.length > 0) {
            const currentLot = lots[0];
            const matchedQty = Math.min(unfilled, currentLot.quantity);
            const costBasis = matchedQty * currentLot.price;
            const saleProceeds = matchedQty * price;
            const gain = saleProceeds - costBasis;
            const holdingDays = Math.max(0, Math.floor((txDate.getTime() - currentLot.date.getTime()) / (1000 * 60 * 60 * 24)));

            if (holdingDays >= 365) {
              equityLtcgGain += gain;
            } else {
              equityStcgGain += gain;
            }

            currentLot.quantity -= matchedQty;
            unfilled -= matchedQty;

            if (currentLot.quantity <= 0) {
              lots.shift();
            }
          }

          // If sell could not be matched with historical buys, estimate cost conservatively at 85%
          if (unfilled > 0) {
            const saleProceeds = unfilled * price;
            const costBasis = saleProceeds * 0.85;
            const gain = saleProceeds - costBasis;
            equityStcgGain += gain;
          }
        }
      }
    }

    // D. Calculate Realized Crypto Gains (Section 115BBH)
    let cryptoGain = 0;
    let cryptoLosses = 0;

    if (cryptoTradesRes.data && cryptoTradesRes.data.length > 0) {
      const cryptoInventory = new Map<string, Array<{ qty: number; price: number }>>();

      for (const trade of cryptoTradesRes.data) {
        const sym = (trade.symbol || "").trim().toUpperCase();
        const isBuyer = trade.is_buyer === true || (trade.side || "").toUpperCase() === "BUY";
        const qty = Number(trade.qty || 0);
        const price = Number(trade.price || 0);

        if (!sym || qty <= 0 || price <= 0) continue;

        if (isBuyer) {
          const lots = cryptoInventory.get(sym) || [];
          lots.push({ qty, price });
          cryptoInventory.set(sym, lots);
        } else {
          let unfilled = qty;
          const lots = cryptoInventory.get(sym) || [];

          while (unfilled > 0 && lots.length > 0) {
            const currentLot = lots[0];
            const matchedQty = Math.min(unfilled, currentLot.qty);
            const costBasis = matchedQty * currentLot.price;
            const saleProceeds = matchedQty * price;
            const gain = saleProceeds - costBasis;

            if (gain > 0) {
              cryptoGain += gain;
            } else {
              cryptoLosses += Math.abs(gain);
            }

            currentLot.qty -= matchedQty;
            unfilled -= matchedQty;

            if (currentLot.qty <= 0) {
              lots.shift();
            }
          }

          if (unfilled > 0) {
            const saleProceeds = unfilled * price;
            const costBasis = saleProceeds * 0.90;
            const gain = saleProceeds - costBasis;
            if (gain > 0) {
              cryptoGain += gain;
            }
          }
        }
      }
    }

    // Section 70 & 71 Set-Off Rules:
    // STCL can offset LTCG; LTCL cannot offset STCG.
    // Crypto losses CANNOT offset any gains (Section 115BBH).
    let adjustedEquityLtcg = equityLtcgGain;
    let adjustedEquityStcg = equityStcgGain;

    if (adjustedEquityStcg < 0 && adjustedEquityLtcg > 0) {
      const offset = Math.min(Math.abs(adjustedEquityStcg), adjustedEquityLtcg);
      adjustedEquityLtcg -= offset;
      adjustedEquityStcg += offset;
    }

    // Union Budget 2024 revised Section 112A threshold: ₹1.25 Lakh
    const ltcgExemption = 125000.0;
    const equityLtcgTaxable = Math.max(0, adjustedEquityLtcg - ltcgExemption);
    const equityLtcgTax = Math.round(equityLtcgTaxable * 0.125 * 100) / 100;
    const equityStcgTax = Math.round(Math.max(0, adjustedEquityStcg) * 0.20 * 100) / 100;

    // Crypto flat 30% + 4% cess = 31.2% (Section 115BBH)
    const cryptoTax = Math.round(cryptoGain * 0.312 * 100) / 100;

    const totalRealizedGains = Math.round((equityLtcgGain + equityStcgGain + cryptoGain) * 100) / 100;
    const totalEstimatedTax = Math.round((equityLtcgTax + equityStcgTax + cryptoTax) * 100) / 100;

    const advice: string[] = [];
    if (equityLtcgTaxable > 0) {
      advice.push(
        `Equity LTCG exceeds the Section 112A ₹1.25 Lakh exemption limit by ₹${equityLtcgTaxable.toLocaleString("en-IN")}. You have an estimated 12.5% tax liability of ₹${equityLtcgTax.toLocaleString("en-IN")}.`
      );
    } else if (equityLtcgGain > 0) {
      const remainingExemption = ltcgExemption - equityLtcgGain;
      advice.push(
        `You have ₹${remainingExemption.toLocaleString("en-IN")} of tax-exempt Equity LTCG room available under Section 112A for AY ${assessmentYear}.`
      );
    }

    if (equityStcgGain > 0) {
      advice.push(
        `You have ₹${equityStcgGain.toLocaleString("en-IN")} in taxable STCG (taxed at 20% under Section 111A). You can harvest available short-term losses to directly neutralize this liability.`
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

    const payload: TaxAnalysisPayload = {
      assessmentYear,
      taxSlabRate: slabRate,
      taxRulesVersion: "Union Budget 2024 (Finance (No. 2) Act, 2024)",
      disclaimer: DISCLAIMER_TEXT,
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
        cryptoGain: Math.round(cryptoGain * 100) / 100,
        cryptoLosses: Math.round(cryptoLosses * 100) / 100,
        cryptoTax,
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
