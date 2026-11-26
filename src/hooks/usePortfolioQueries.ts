"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  TaxRuleOverride,
  TaxRuleOverridesMap,
  TaxRuleSet,
  TaxYearPreset,
  getCurrentIndianAssessmentYear,
} from "@/utils/taxRules";

export interface TaxAnalysisData {
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
  harvestingOpportunities: Array<{
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
  }>;
  totalHarvestableLoss: number;
  totalPotentialTaxSavings: number;
  autoUpdateStatus?: {
    source: "feed" | "gemini_search" | "builtin";
    checkedAt: string;
    updated: boolean;
    citations?: string[];
  };
  advice: string[];
}

export interface TaxRulesConfigResponse {
  currentAssessmentYear: string;
  currentPreset?: TaxYearPreset & { isCustomized: boolean };
  overrides: TaxRuleOverridesMap;
  autoUpdateStatus?: {
    assessmentYear: string;
    financialYear: string;
    source: "feed" | "gemini_search" | "builtin";
    checkedAt: string;
    updated: boolean;
    rulesVersion: string;
    statuteReference: string;
    citations?: string[];
  } | null;
  dbPersistenceAvailable: boolean;
}

export interface TaxRegimeComparisonData {
  assessmentYear: string;
  financialYear: string;
  rulesVersion?: string;
  taxRulesVersion?: string;
  statuteReference?: string;
  recommendedRegime: "NEW_REGIME" | "OLD_REGIME" | "EQUAL";
  savingsAmount: number;
  advice?: string;
  newRegime: {
    grossIncome: number;
    standardDeduction: number;
    corporateNpsDeduction: number;
    taxableIncome: number;
    baseIncomeTax: number;
    section87aRebate: number;
    section87aMarginalRelief: number;
    taxAfterRebate: number;
    surcharge: number;
    cess: number;
    totalTax: number;
  };
  oldRegime: {
    grossIncome: number;
    standardDeduction: number;
    corporateNpsDeduction: number;
    totalDeductions: number;
    taxableIncome: number;
    baseIncomeTax: number;
    section87aRebate: number;
    taxAfterRebate: number;
    surcharge: number;
    cess: number;
    totalTax: number;
  };
}

/**
 * Modern TanStack Query hooks replacing manual useEffect / useState boilerplate.
 */
export function useAccountsQuery() {
  const { user } = useAuth();
  const supabase = createClient();

  return useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useStockHoldingsQuery() {
  const { user } = useAuth();
  const supabase = createClient();

  return useQuery({
    queryKey: ["stock_holdings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("stock_holdings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useTaxAnalysisQuery(
  assessmentYear: string = getCurrentIndianAssessmentYear(),
  taxSlabRate: number = 0.30,
  customRulesOverride?: TaxRuleOverride | null
) {
  const { user } = useAuth();
  const hasOverride = Boolean(customRulesOverride && Object.keys(customRulesOverride).length > 0);

  return useQuery<TaxAnalysisData>({
    queryKey: ["tax_analysis", user?.id, assessmentYear, taxSlabRate, customRulesOverride ?? null],
    queryFn: async () => {
      const res = hasOverride
        ? await fetch("/api/v1/analytics/tax", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assessmentYear,
              taxSlabRate,
              customRulesOverride,
            }),
          })
        : await fetch(
            `/api/v1/analytics/tax?ay=${encodeURIComponent(assessmentYear)}&slab=${taxSlabRate}`,
            {
              headers: { "Content-Type": "application/json" },
            }
          );
      if (!res.ok) {
        throw new Error("Failed to fetch tax simulation analysis");
      }
      const json = await res.json();
      return json.data as TaxAnalysisData;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useTaxRulesConfigQuery() {
  const { user } = useAuth();

  return useQuery<TaxRulesConfigResponse>({
    queryKey: ["tax_rules_config", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/v1/analytics/tax/rules", {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch user tax rule overrides");
      }
      const json = await res.json();
      return json.data as TaxRulesConfigResponse;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
