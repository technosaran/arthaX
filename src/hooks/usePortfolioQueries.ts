"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface TaxAnalysisData {
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
  harvestingOpportunities: Array<{
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
  }>;
  totalHarvestableLoss: number;
  totalPotentialTaxSavings: number;
  advice: string[];
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

export function useTaxAnalysisQuery(assessmentYear: string = "2025-26", taxSlabRate: number = 0.30) {
  const { user } = useAuth();

  return useQuery<TaxAnalysisData>({
    queryKey: ["tax_analysis", user?.id, assessmentYear, taxSlabRate],
    queryFn: async () => {
      const res = await fetch(
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
