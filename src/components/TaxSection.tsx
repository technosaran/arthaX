"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReceiptIndianRupee,
  Sparkles,
  Calculator,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Layers,
  Check,
  Calendar,
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  TaxRegimeComparisonData,
  useTaxAnalysisQuery,
  useTaxRulesConfigQuery,
} from "@/hooks/usePortfolioQueries";
import { useToast } from "@/context/ToastContext";
import EntityLogo from "@/components/EntityLogo";
import { executeTaxRegimesTS } from "@/lib/engine/embeddedEngine";
import { formatINRWhole } from "@/utils/money";
import {
  TaxRuleOverride,
  TaxRuleOverrideSchema,
  TaxRuleOverridesMap,
  TaxRuleOverridesMapSchema,
  TaxRuleSet,
  TaxSlab,
  getCurrentIndianAssessmentYear,
  getCurrentTaxYearPreset,
} from "@/utils/taxRules";

const LOCAL_TAX_OVERRIDES_KEY = "arthax_tax_rule_overrides_v1";
const INPUT_CLS =
  "w-full px-3 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-subtle)] font-mono text-xs text-[var(--app-fg)] focus:outline-hidden focus:border-emerald-500";

function formatRatePercent(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`;
}

function formatLakhs(amount: number): string {
  return amount >= 100000 && amount % 100000 === 0
    ? `₹${amount / 100000}L`
    : formatINRWhole(amount);
}

const ASSET_LABEL_MAP: Record<string, string> = {
  equity: "Stock",
  debt_fund: "Debt / Bond",
  bullion: "Bullion",
  crypto: "Crypto VDA",
  mutual_fund: "Equity MF",
};

interface TaxSectionProps {
  initialTab?: "overview" | "harvesting" | "rules";
  onNavigate?: (tab: string) => void;
}

export default function TaxSection({ initialTab = "harvesting", onNavigate }: TaxSectionProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [manualTabState, setManualTabState] = useState<{
    forInitialTab: "overview" | "harvesting" | "rules";
    tab: "harvesting" | "overview" | "rules";
  } | null>(null);
  const activeSubTab: "harvesting" | "overview" | "rules" =
    manualTabState && manualTabState.forInitialTab === initialTab
      ? manualTabState.tab
      : initialTab === "overview" || initialTab === "rules"
      ? initialTab
      : "harvesting";

  // Always pinned to the active current Indian fiscal/assessment year (auto-rolls over every April 1)
  const assessmentYear = useMemo(() => getCurrentIndianAssessmentYear(), []);
  const [slabRate, setSlabRate] = useState<number>(0.3);
  const [customOverrides, setCustomOverrides] = useState<TaxRuleOverridesMap>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_TAX_OVERRIDES_KEY);
      const parsed = raw ? TaxRuleOverridesMapSchema.safeParse(JSON.parse(raw)) : null;
      return parsed?.success ? parsed.data : {};
    } catch {
      return {};
    }
  });

  const [draftEdit, setDraftEdit] = useState<{ version: string; rules: TaxRuleSet } | null>(null);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [jsonImportText, setJsonImportText] = useState("");
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [isCheckingAutoUpdate, setIsCheckingAutoUpdate] = useState(false);

  // Regime Comparison Calculator Inputs
  const [grossIncome, setGrossIncome] = useState(1500000);
  const [deduction80c, setDeduction80c] = useState(150000);
  const [deduction80d, setDeduction80d] = useState(25000);
  const [hraExemption, setHraExemption] = useState(0);
  const [homeLoan24b, setHomeLoan24b] = useState(0);
  const [nps1b, setNps1b] = useState(50000);
  const [nps2, setNps2] = useState(0);

  // Harvesting Filters & Multi-select
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "equity" | "mutual_fund">("all");
  const [termFilter, setTermFilter] = useState<"all" | "STCG" | "LTCG">("all");
  const [sortBy, setSortBy] = useState<"savings" | "loss" | "holding">("savings");
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());

  const { data: taxRulesConfig } = useTaxRulesConfigQuery();
  const mergedOverrides = useMemo(
    () => ({ ...(taxRulesConfig?.overrides || {}), ...customOverrides }),
    [taxRulesConfig, customOverrides]
  );
  const activeOverride = mergedOverrides[assessmentYear] || null;
  const activePreset = useMemo(
    () => getCurrentTaxYearPreset(activeOverride),
    [activeOverride]
  );

  const { data: taxData, isLoading, refetch, isRefetching } = useTaxAnalysisQuery(
    assessmentYear,
    slabRate,
    activeOverride
  );
  const activeRules = taxData?.rulesUsed ?? activePreset.rules;
  const autoStatus = taxData?.autoUpdateStatus ?? taxRulesConfig?.autoUpdateStatus ?? null;
  const editorRulesVersion = draftEdit?.version ?? activePreset.rulesVersion;
  const editorRulesDraft = draftEdit?.rules ?? activePreset.rules;

  const updateDraft = useCallback(
    (patch: { version?: string; rules?: TaxRuleSet }) => {
      setDraftEdit((prev) => ({
        version: patch.version ?? prev?.version ?? activePreset.rulesVersion,
        rules:
          patch.rules ??
          prev?.rules ??
          (JSON.parse(JSON.stringify(activePreset.rules)) as TaxRuleSet),
      }));
    },
    [activePreset]
  );

  const persistOverrides = useCallback(
    async (nextMap: TaxRuleOverridesMap, title: string, message: string) => {
      setCustomOverrides(nextMap);
      try {
        window.localStorage.setItem(LOCAL_TAX_OVERRIDES_KEY, JSON.stringify(nextMap));
      } catch {}

      setIsSavingRules(true);
      try {
        const res = await fetch("/api/v1/analytics/tax/rules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: nextMap }),
        });
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        showToast(
          title,
          json?.data?.savedInDatabase
            ? `${message} Synced & recalculated.`
            : `${message} Saved locally & recalculated.`,
          "success"
        );
      } catch {
        showToast(title, `${message} Applied immediately.`, "success");
      } finally {
        setIsSavingRules(false);
        void queryClient.invalidateQueries({ queryKey: ["tax_rules_config"] });
        void refetch();
      }
    },
    [queryClient, refetch, showToast]
  );

  const handleAutoCheckUpdates = useCallback(async () => {
    setIsCheckingAutoUpdate(true);
    try {
      const res = await fetch("/api/v1/analytics/tax/rules", { method: "POST" });
      if (!res.ok) throw new Error("Auto-update check failed");
      const json = await res.json();
      const rec = json?.data?.record;
      const updatedMap = json?.data?.overrides as TaxRuleOverridesMap | undefined;

      if (rec?.updated && rec?.override) {
        const nextMap: TaxRuleOverridesMap = updatedMap || { ...mergedOverrides, [assessmentYear]: rec.override };
        setCustomOverrides(nextMap);
        try {
          window.localStorage.setItem(LOCAL_TAX_OVERRIDES_KEY, JSON.stringify(nextMap));
        } catch {}
        setDraftEdit(null);
        showToast(
          "New Tax System Auto-Applied",
          `Updated to ${rec.rulesVersion} automatically.`,
          "success"
        );
      } else {
        showToast(
          "Tax Rules Up to Date",
          `Verified ${activePreset.rulesVersion} is current for ${activePreset.label}.`,
          "info"
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["tax_rules_config"] });
      void refetch();
    } catch {
      showToast("Auto-Check Unavailable", "Using latest verified built-in statutory rules.", "info");
    } finally {
      setIsCheckingAutoUpdate(false);
    }
  }, [activePreset.label, activePreset.rulesVersion, assessmentYear, mergedOverrides, queryClient, refetch, showToast]);

  const localRegimePreview = useMemo<TaxRegimeComparisonData>(
    () =>
      executeTaxRegimesTS({
        gross_income: grossIncome,
        assessment_year: assessmentYear,
        custom_rules: activeOverride || undefined,
        deductions_80c: deduction80c,
        deductions_80d: deduction80d,
        nps_80ccd_1b: nps1b,
        nps_80ccd_2: nps2,
        home_loan_interest_24b: homeLoan24b,
        hra_exemption: hraExemption,
      }),
    [activeOverride, assessmentYear, deduction80c, deduction80d, grossIncome, homeLoan24b, hraExemption, nps1b, nps2]
  );

  const {
    data: remoteRegimeResult,
    isFetching: isComparingRegimes,
    refetch: runRegimeComparison,
  } = useQuery<TaxRegimeComparisonData>({
    queryKey: [
      "tax_regime_comparison",
      assessmentYear,
      grossIncome,
      deduction80c,
      deduction80d,
      hraExemption,
      homeLoan24b,
      nps1b,
      nps2,
      activeOverride,
    ],
    queryFn: async () => {
      const res = await fetch("/api/v1/calculations/tax/regimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gross_income: grossIncome,
          assessment_year: assessmentYear,
          custom_rules: activeOverride || undefined,
          deductions_80c: deduction80c,
          deductions_80d: deduction80d,
          nps_80ccd_1b: nps1b,
          nps_80ccd_2: nps2,
          home_loan_interest_24b: homeLoan24b,
          hra_exemption: hraExemption,
        }),
      });
      if (!res.ok) return localRegimePreview;
      const json = await res.json();
      return (json?.result ?? json?.data?.result ?? json?.data ?? localRegimePreview) as TaxRegimeComparisonData;
    },
    enabled: activeSubTab === "overview",
    staleTime: 30 * 1000,
  });

  const regimeResult = remoteRegimeResult ?? localRegimePreview;

  const handleSubTabChange = (tab: "harvesting" | "overview" | "rules") => {
    setManualTabState({ forInitialTab: initialTab, tab });
    if (onNavigate) {
      if (tab === "overview") onNavigate("tax");
      else if (tab === "harvesting") onNavigate("tax-harvesting");
    }
  };

  const filteredOpportunities = useMemo(() => {
    if (!taxData?.harvestingOpportunities) return [];
    let list = [...taxData.harvestingOpportunities];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (o) => o.symbol.toLowerCase().includes(q) || o.assetClass.toLowerCase().includes(q)
      );
    }
    if (assetFilter !== "all") {
      list = list.filter((o) =>
        assetFilter === "equity"
          ? o.assetClass === "equity"
          : o.assetClass === "mutual_fund" || o.assetClass === "debt_fund"
      );
    }
    if (termFilter !== "all") list = list.filter((o) => o.gainType === termFilter);
    list.sort((a, b) =>
      sortBy === "savings"
        ? b.potentialTaxSavings - a.potentialTaxSavings
        : sortBy === "loss"
        ? b.unrealizedLoss - a.unrealizedLoss
        : b.holdingPeriodMonths - a.holdingPeriodMonths
    );
    return list;
  }, [taxData, searchQuery, assetFilter, termFilter, sortBy]);

  const simulationMetrics = useMemo(() => {
    if (!taxData?.harvestingOpportunities) return { totalLoss: 0, totalSavings: 0, count: 0 };
    const selected = taxData.harvestingOpportunities.filter((o) => !deselectedIds.has(o.id));
    return {
      totalLoss: selected.reduce((sum, i) => sum + i.unrealizedLoss, 0),
      totalSavings: selected.reduce((sum, i) => sum + i.potentialTaxSavings, 0),
      count: selected.length,
    };
  }, [taxData, deselectedIds]);

  const allSelected =
    Boolean(taxData?.harvestingOpportunities?.length) &&
    taxData!.harvestingOpportunities.every((o) => !deselectedIds.has(o.id));

  const toggleSelect = (id: string) =>
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (!taxData?.harvestingOpportunities) return;
    setDeselectedIds(allSelected ? new Set(taxData.harvestingOpportunities.map((o) => o.id)) : new Set());
  };

  // Dynamic derived metrics
  const ltcgExemptionLimit = activeRules.equity.ltcgExemptionLimit;
  const equityLtcgRatePct = formatRatePercent(activeRules.equity.ltcgRate);
  const equityStcgRatePct = formatRatePercent(activeRules.equity.stcgRate);
  const bullionLtcgRatePct = formatRatePercent(activeRules.bullion.ltcgRate);
  const bondsLtcgRatePct = formatRatePercent(activeRules.bondsListed.ltcgRate);
  const cryptoEffectivePct = formatRatePercent(activeRules.cryptoVda.effectiveRate);
  const realizedLtcg = taxData?.realized.equityLtcgGain || 0;
  const ltcgUsedPercent =
    ltcgExemptionLimit > 0
      ? Math.min(100, Math.round((realizedLtcg / ltcgExemptionLimit) * 100))
      : realizedLtcg > 0
      ? 100
      : 0;
  const remainingLtcgRoom = Math.max(0, ltcgExemptionLimit - realizedLtcg);
  const fyWindowText = `${taxData?.fiscalYearStart || activePreset.effectiveFrom} to ${
    taxData?.fiscalYearEnd || `${assessmentYear.slice(0, 4)}-03-31`
  }`;

  const saveRuleOverride = async (override: TaxRuleOverride, title: string, msg: string) => {
    const parsed = TaxRuleOverrideSchema.safeParse(override);
    if (!parsed.success) {
      showToast("Invalid Tax Rules", parsed.error.issues[0]?.message || "Check rates & slabs.", "error");
      return;
    }
    setDraftEdit(null);
    await persistOverrides({ ...mergedOverrides, [assessmentYear]: parsed.data }, title, msg);
  };

  const handleResetCurrentRules = async () => {
    const nextMap = { ...mergedOverrides };
    delete nextMap[assessmentYear];
    setDraftEdit(null);
    await persistOverrides(nextMap, "Statutory Rules Restored", `Reverted ${activePreset.label} to statutory default.`);
  };

  const handleExportPresetJson = () => {
    const blob = new Blob(
      [JSON.stringify({ label: activePreset.label, rulesVersion: editorRulesVersion, ...activeRules }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arthax-tax-rules-current-${assessmentYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPresetJson = async () => {
    try {
      const json = JSON.parse(jsonImportText);
      setShowJsonImport(false);
      setJsonImportText("");
      await saveRuleOverride(json, "Tax Preset Imported", `Imported custom JSON for ${activePreset.label}.`);
    } catch {
      showToast("Malformed JSON", "Paste valid JSON matching an exported tax rules file.", "error");
    }
  };

  const updateNewSlab = (idx: number, patch: Partial<TaxSlab>) =>
    updateDraft({
      rules: {
        ...editorRulesDraft,
        newRegime: {
          ...editorRulesDraft.newRegime,
          slabs: editorRulesDraft.newRegime.slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
        },
      },
    });

  const addNewSlabRow = () => {
    const slabs = [...editorRulesDraft.newRegime.slabs];
    const openIdx = slabs.findIndex((s) => s.upTo === null);
    const at = openIdx >= 0 ? openIdx : slabs.length;
    slabs.splice(at, 0, { upTo: (at > 0 ? slabs[at - 1].upTo || 0 : 0) + 400000, rate: 0.1 });
    updateDraft({ rules: { ...editorRulesDraft, newRegime: { ...editorRulesDraft.newRegime, slabs } } });
  };

  const removeSlabRow = (idx: number) => {
    if (editorRulesDraft.newRegime.slabs.length <= 2) return;
    updateDraft({
      rules: {
        ...editorRulesDraft,
        newRegime: {
          ...editorRulesDraft.newRegime,
          slabs: editorRulesDraft.newRegime.slabs.filter((_, i) => i !== idx),
        },
      },
    });
  };

  const statCards: Array<{
    label: string;
    val: number;
    prefix?: string;
    valCls: string;
    subtitle: string;
    icon: React.ReactNode;
    color: "emerald" | "rose" | "sky" | "amber";
  }> = [
    {
      label: "Potential Tax Savings",
      val: taxData?.totalPotentialTaxSavings || 0,
      prefix: "+",
      valCls: "text-emerald-400 font-extrabold",
      subtitle: isLoading
        ? "Calculating savings..."
        : `${taxData?.harvestingOpportunities.length || 0} loss positions eligible to harvest`,
      icon: <Sparkles className="text-emerald-400" size={18} />,
      color: "emerald",
    },
    {
      label: "Total Harvestable Loss",
      val: taxData?.totalHarvestableLoss || 0,
      prefix: "-",
      valCls: "text-rose-400 font-bold",
      subtitle: "Unrealized loss eligible for tax offset",
      icon: <TrendingDown className="text-rose-400" size={18} />,
      color: "rose",
    },
    {
      label: "Realized Capital Gains",
      val: taxData?.realized.totalRealizedGains || 0,
      valCls: "text-[var(--app-fg)] font-bold",
      subtitle: `${activePreset.shortLabel} current year booked gains`,
      icon: <ReceiptIndianRupee className="text-sky-400" size={18} />,
      color: "sky",
    },
    {
      label: "Estimated Capital Gains Tax",
      val: taxData?.realized.totalEstimatedTax || 0,
      valCls: "text-[var(--app-fg)] font-bold",
      subtitle: `Equity LTCG (${equityLtcgRatePct}) + STCG (${equityStcgRatePct})`,
      icon: <Calculator className="text-amber-400" size={18} />,
      color: "amber",
    },
  ];

  const ruleEditorFields: Array<{
    label: string;
    value: number;
    step: number;
    max?: number;
    onChange: (num: number) => void;
  }> = [
    {
      label: "Equity LTCG Exemption (₹)",
      value: editorRulesDraft.equity.ltcgExemptionLimit,
      step: 5000,
      onChange: (v) =>
        updateDraft({ rules: { ...editorRulesDraft, equity: { ...editorRulesDraft.equity, ltcgExemptionLimit: v } } }),
    },
    {
      label: "Equity LTCG Rate (%)",
      value: Math.round(editorRulesDraft.equity.ltcgRate * 1000) / 10,
      step: 0.5,
      max: 100,
      onChange: (v) =>
        updateDraft({ rules: { ...editorRulesDraft, equity: { ...editorRulesDraft.equity, ltcgRate: v / 100 } } }),
    },
    {
      label: "Equity STCG Rate (%)",
      value: Math.round(editorRulesDraft.equity.stcgRate * 1000) / 10,
      step: 0.5,
      max: 100,
      onChange: (v) =>
        updateDraft({ rules: { ...editorRulesDraft, equity: { ...editorRulesDraft.equity, stcgRate: v / 100 } } }),
    },
    {
      label: "Bullion LTCG Rate (%)",
      value: Math.round(editorRulesDraft.bullion.ltcgRate * 1000) / 10,
      step: 0.5,
      max: 100,
      onChange: (v) =>
        updateDraft({ rules: { ...editorRulesDraft, bullion: { ...editorRulesDraft.bullion, ltcgRate: v / 100 } } }),
    },
    {
      label: "New Regime Std. Deduction (₹)",
      value: editorRulesDraft.newRegime.standardDeduction,
      step: 5000,
      onChange: (v) =>
        updateDraft({
          rules: { ...editorRulesDraft, newRegime: { ...editorRulesDraft.newRegime, standardDeduction: v } },
        }),
    },
    {
      label: "87A Zero-Tax Income Limit (₹)",
      value: editorRulesDraft.newRegime.rebate87aMaxIncome,
      step: 25000,
      onChange: (v) =>
        updateDraft({
          rules: { ...editorRulesDraft, newRegime: { ...editorRulesDraft.newRegime, rebate87aMaxIncome: v } },
        }),
    },
    {
      label: "87A Max Rebate Amount (₹)",
      value: editorRulesDraft.newRegime.rebate87aMaxAmount,
      step: 5000,
      onChange: (v) =>
        updateDraft({
          rules: { ...editorRulesDraft, newRegime: { ...editorRulesDraft.newRegime, rebate87aMaxAmount: v } },
        }),
    },
  ];

  const breakdownCards: Array<{
    title: string;
    badge: string;
    variant: BadgeVariant;
    amount: number;
    meta: string;
    taxText: string;
    highlight?: boolean;
  }> = [
    {
      title: "Equity LTCG",
      badge: `${equityLtcgRatePct} Tax`,
      variant: "emerald",
      amount: taxData?.realized.equityLtcgGain || 0,
      meta: `Taxable (> ${formatLakhs(ltcgExemptionLimit)}): ${formatINRWhole(taxData?.realized.equityLtcgTaxable || 0)}`,
      taxText: `Tax: ${formatINRWhole(taxData?.realized.equityLtcgTax || 0)}`,
    },
    {
      title: "Equity STCG",
      badge: `${equityStcgRatePct} Flat`,
      variant: "sky",
      amount: taxData?.realized.equityStcgGain || 0,
      meta: `Holding < ${activeRules.equity.ltcgThresholdDays}d (Sec 111A)`,
      taxText: `Tax: ${formatINRWhole(taxData?.realized.equityStcgTax || 0)}`,
    },
    {
      title: "Debt & F&O",
      badge: "Slab Rate",
      variant: "neutral",
      amount: (taxData?.realized.debtGain || 0) + (taxData?.realized.fnoIncome || 0),
      meta: `Taxed at ${(slabRate * 100).toFixed(0)}% slab rate`,
      taxText: `Tax: ${formatINRWhole((taxData?.realized.debtTax || 0) + (taxData?.realized.fnoTax || 0))}`,
    },
    {
      title: "Bullion & Bonds",
      badge: `${bullionLtcgRatePct} LTCG`,
      variant: "amber",
      amount:
        (taxData?.realized.bullionLtcgGain || 0) +
        (taxData?.realized.bullionStcgGain || 0) +
        (taxData?.realized.bondsLtcgGain || 0) +
        (taxData?.realized.bondsStcgGain || 0),
      meta: `Gold ${activeRules.bullion.ltcgThresholdDays}d / Bonds ${activeRules.bondsListed.ltcgThresholdDays}d`,
      taxText: `Tax: ${formatINRWhole(
        (taxData?.realized.bullionLtcgTax || 0) +
          (taxData?.realized.bullionStcgTax || 0) +
          (taxData?.realized.bondsLtcgTax || 0) +
          (taxData?.realized.bondsStcgTax || 0)
      )}`,
    },
    {
      title: "Crypto VDA",
      badge: cryptoEffectivePct,
      variant: "rose",
      amount: taxData?.realized.cryptoGain || 0,
      meta: `Sec 115BBH (${activeRules.cryptoVda.allowLossSetoff ? "Loss Set-Off On" : "No Loss Set-Off"})`,
      taxText: `Tax: ${formatINRWhole(taxData?.realized.cryptoTax || 0)}`,
    },
    {
      title: "Total Tax Due",
      badge: activePreset.shortLabel,
      variant: "success",
      amount: taxData?.realized.totalEstimatedTax || 0,
      meta: `Net on ${formatINRWhole(taxData?.realized.totalRealizedGains || 0)} gains`,
      taxText: activePreset.isCustomized ? "Auto / Custom Rules" : activePreset.shortLabel,
      highlight: true,
    },
  ];

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <ReceiptIndianRupee className="text-emerald-400" size={26} />
            <span>Tax &amp; Tax Harvesting</span>
          </span>
        }
        description={`Current Indian Tax System (${activePreset.rulesVersion}) — auto-updates annually & on Budget releases`}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-xs font-semibold">
              <Calendar size={13} className="text-emerald-400" />
              <span>{activePreset.label}</span>
              <Badge variant="emerald" size="xs">Auto</Badge>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-xs">
              <span className="text-[var(--app-muted)] text-[11px] font-medium">Slab:</span>
              {[0.1, 0.2, 0.3, 0.39].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSlabRate(rate)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer transition-all ${
                    slabRate === rate
                      ? "bg-emerald-500 text-white shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  {(rate * 100).toFixed(0)}%
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} />}
              disabled={isRefetching || isLoading}
              onClick={() => refetch()}
            >
              Sync
            </Button>
          </div>
        }
      />

      {/* ACTIVE SELF-UPDATING TAX SYSTEM BANNER */}
      <div
        className="px-4 py-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        style={{
          backgroundColor: "var(--app-card-subtle)",
          borderColor: activePreset.isCustomized ? "rgba(16, 185, 129, 0.45)" : "var(--app-border)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={activePreset.isCustomized ? "emerald" : "sky"} size="xs">
            {autoStatus?.updated ? "Auto-Updated" : activePreset.isCustomized ? "Custom Override" : "Current System Active"}
          </Badge>
          <span className="font-bold text-[var(--app-fg)]">{activePreset.rulesVersion}</span>
          <span className="text-[var(--app-muted)]">
            • {activePreset.statuteReference} • FY Window: <span className="font-mono">{fyWindowText}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleSubTabChange("rules")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer self-start sm:self-auto"
        >
          <SlidersHorizontal size={13} />
          <span>Auto-Update Status &amp; Rules</span>
        </button>
      </div>

      {/* TOP METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {statCards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={
              isLoading ? (
                <Skeleton className="h-8 w-32 rounded-lg" />
              ) : (
                <span className={`font-mono ${c.valCls}`}>
                  {c.prefix || ""}
                  {formatINRWhole(c.val)}
                </span>
              )
            }
            subtitle={c.subtitle}
            icon={c.icon}
            iconColor={c.color}
          />
        ))}
      </div>

      {/* SUB-TAB NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--app-border)]">
        <SegmentedControl
          value={activeSubTab}
          onChange={handleSubTabChange}
          options={[
            {
              value: "harvesting",
              label: (
                <span className="flex items-center gap-1.5">
                  <span>Tax Harvesting</span>
                  {Boolean(taxData?.harvestingOpportunities?.length) && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                      {taxData!.harvestingOpportunities.length}
                    </span>
                  )}
                </span>
              ),
              icon: <Sparkles size={14} />,
            },
            { value: "overview", label: "Tax Overview", icon: <ReceiptIndianRupee size={14} /> },
            { value: "rules", label: "Tax Rules & Auto-Sync", icon: <ShieldCheck size={14} /> },
          ]}
        />
      </div>

      {/* VIEW 1: TAX-LOSS HARVESTING */}
      {activeSubTab === "harvesting" && (
        <div className="space-y-6">
          {taxData && taxData.harvestingOpportunities.length > 0 && (
            <div
              className="p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              style={{ backgroundColor: "var(--app-card)", borderColor: "var(--app-border)" }}
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-fg)] cursor-pointer"
                >
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                      allSelected
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-[var(--app-border)] bg-[var(--app-card-subtle)]"
                    }`}
                  >
                    {allSelected && <Check size={12} />}
                  </div>
                  <span>Select All ({taxData.harvestingOpportunities.length})</span>
                </button>
                <div className="h-4 w-px bg-[var(--app-border)] hidden sm:block" />
                <div className="flex items-center gap-3 text-xs">
                  <span>
                    <span className="text-[var(--app-muted)]">Selected: </span>
                    <span className="font-bold">{simulationMetrics.count}</span>
                  </span>
                  <span>
                    <span className="text-[var(--app-muted)]">Harvestable Loss: </span>
                    <span className="font-bold text-rose-400 font-mono">-{formatINRWhole(simulationMetrics.totalLoss)}</span>
                  </span>
                  <span>
                    <span className="text-[var(--app-muted)]">Tax Saved: </span>
                    <span className="font-bold text-emerald-400 font-mono">+{formatINRWhole(simulationMetrics.totalSavings)}</span>
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles size={13} />}
                disabled={simulationMetrics.count === 0}
                onClick={() =>
                  showToast(
                    "Simulated Harvest Plan Ready",
                    `Harvesting ${simulationMetrics.count} positions offsets ${formatINRWhole(
                      simulationMetrics.totalLoss
                    )} in gains, saving ~${formatINRWhole(simulationMetrics.totalSavings)} in capital gains tax.`,
                    "success"
                  )
                }
              >
                Simulate Harvest Offset
              </Button>
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] text-xs">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
              <input
                type="text"
                placeholder="Search symbol or fund..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] text-xs text-[var(--app-fg)] placeholder:text-[var(--app-muted)] focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] p-0.5">
                {([
                  ["all", "All Assets"],
                  ["equity", "Stocks"],
                  ["mutual_fund", "Mutual Funds"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAssetFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      assetFilter === key
                        ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] p-0.5">
                {([
                  ["all", "All Terms"],
                  ["STCG", "STCG (<12m)"],
                  ["LTCG", "LTCG (≥12m)"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTermFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      termFilter === key
                        ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "savings" | "loss" | "holding")}
                aria-label="Sort harvesting opportunities"
                className="px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] text-xs text-[var(--app-fg)] focus:outline-hidden cursor-pointer"
              >
                <option value="savings">Sort: Highest Tax Savings</option>
                <option value="loss">Sort: Largest Unrealized Loss</option>
                <option value="holding">Sort: Holding Period</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] space-y-4 animate-pulse">
                  <Skeleton className="h-5 w-40 rounded-md" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-base font-bold text-[var(--app-fg)]">
                  {searchQuery || assetFilter !== "all" || termFilter !== "all"
                    ? "No Matching Loss Positions"
                    : "Portfolio Tax-Optimized"}
                </h3>
                <p className="text-xs text-[var(--app-muted)] leading-relaxed">
                  {searchQuery || assetFilter !== "all" || termFilter !== "all"
                    ? "No holdings matched your filter criteria. Try resetting the filters above."
                    : "All your tracked holdings are currently in profit or have zero harvestable losses."}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOpportunities.map((opp) => {
                const isSelected = !deselectedIds.has(opp.id);
                return (
                  <div
                    key={opp.id}
                    onClick={() => toggleSelect(opp.id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer space-y-3.5 ${
                      isSelected
                        ? "border-emerald-500/40 bg-[var(--app-card)] shadow-xs"
                        : "border-[var(--app-border)] bg-[var(--app-card-subtle)] opacity-85 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-[var(--app-border)] bg-[var(--app-card)]"
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                        <EntityLogo name={opp.symbol} size={28} className="rounded-lg flex-shrink-0" />
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-extrabold text-sm sm:text-base truncate">{opp.symbol}</span>
                          <Badge
                            variant={opp.gainType === "STCG" ? "sky" : opp.gainType === "VDA_LOSS_UNOFFSETTABLE" ? "rose" : "emerald"}
                            size="xs"
                          >
                            {opp.gainType === "VDA_LOSS_UNOFFSETTABLE"
                              ? "VDA (No Set-Off)"
                              : `${opp.gainType} (${opp.holdingPeriodMonths}m)`}
                          </Badge>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)]">
                            {ASSET_LABEL_MAP[opp.assetClass] || "Equity MF"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono">
                          +{formatINRWhole(opp.potentialTaxSavings)}
                        </div>
                        <span className="text-[10px] text-[var(--app-muted)] font-mono">
                          Save @ {opp.effectiveTaxRate}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] text-xs">
                      {[
                        ["Invested", formatINRWhole(opp.investedAmount), "text-[var(--app-fg)] font-semibold"],
                        ["Current Value", formatINRWhole(opp.currentValue), "text-[var(--app-fg)] font-semibold"],
                        ["Unrealized Loss", `-${formatINRWhole(opp.unrealizedLoss)}`, "text-rose-400 font-bold"],
                      ].map(([k, v, cls]) => (
                        <div key={k}>
                          <div className="text-[10px] text-[var(--app-muted)]">{k}</div>
                          <div className={`font-mono ${cls}`}>{v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--app-muted)]">
                      <Sparkles size={12} className="text-amber-400 flex-shrink-0" />
                      <span className="truncate">
                        {opp.gainType === "VDA_LOSS_UNOFFSETTABLE"
                          ? "Sec 115BBH: VDA losses cannot be offset against capital gains."
                          : `Book before March 31 to offset taxable ${opp.gainType} gains.`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TAX OVERVIEW & REGIME CALCULATOR */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold">Section 112A Equity LTCG Exemption Tracker</h3>
                  <Badge variant="warning" size="xs">{formatLakhs(ltcgExemptionLimit)} Annual Cap</Badge>
                </div>
                <p className="text-xs text-[var(--app-muted)]">
                  Under {activePreset.rulesVersion}, equity LTCG up to {formatINRWhole(ltcgExemptionLimit)} per financial year ({activePreset.shortLabel}) is tax-exempt.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs text-[var(--app-muted)]">Remaining Tax-Free Room</div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">
                  {formatINRWhole(remainingLtcgRoom)}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-[var(--app-track-bg)] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${ltcgUsedPercent}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--app-muted)] font-mono">
                <span>Realized LTCG: {formatINRWhole(realizedLtcg)} ({ltcgUsedPercent}%)</span>
                <span>Exemption Cap: {formatINRWhole(ltcgExemptionLimit)}</span>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Capital Gains Breakdown ({activePreset.label})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {breakdownCards.map((c) => (
                <Card
                  key={c.title}
                  className={`p-4 sm:p-5 space-y-3 ${c.highlight ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${c.highlight ? "text-emerald-400" : ""}`}>{c.title}</span>
                    <Badge variant={c.variant} size="xs">{c.badge}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className={`text-lg font-extrabold font-mono ${c.highlight ? "text-emerald-400" : ""}`}>
                      {formatINRWhole(c.amount)}
                    </div>
                    <div className="text-[11px] text-[var(--app-muted)]">{c.meta}</div>
                    <div className={`text-[11px] font-bold truncate ${c.highlight ? "text-emerald-400/80" : "text-amber-400"}`}>
                      {c.taxText}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calculator size={17} className="text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-bold">
                    Old vs New Income Tax Regime Calculator ({activePreset.label})
                  </h3>
                </div>
                <p className="text-xs text-[var(--app-muted)]">
                  Uses {activePreset.rulesVersion} slabs (Std. Deduction {formatINRWhole(activeRules.newRegime.standardDeduction)} &amp; Sec 87A zero-tax up to {formatLakhs(activeRules.newRegime.rebate87aMaxIncome)} taxable).
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => void runRegimeComparison()} disabled={isComparingRegimes}>
                {isComparingRegimes ? "Calculating..." : "Recalculate"}
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
              {[
                ["Gross Income (₹)", grossIncome, setGrossIncome],
                ["Sec 80C (≤1.5L)", deduction80c, setDeduction80c],
                ["Sec 80D Health", deduction80d, setDeduction80d],
                ["HRA Exemption", hraExemption, setHraExemption],
                ["Home Loan 24(b)", homeLoan24b, setHomeLoan24b],
                ["NPS 80CCD(1B)", nps1b, setNps1b],
                ["Corp NPS 80CCD(2)", nps2, setNps2],
              ].map(([label, val, setter]) => (
                <label key={label as string} className="space-y-1">
                  <span className="block text-[11px] font-medium text-[var(--app-muted)]">{label as string}</span>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={val as number}
                    onChange={(e) => (setter as (n: number) => void)(Math.max(0, Number(e.target.value) || 0))}
                    className={INPUT_CLS}
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-xs">
              {[
                {
                  key: "NEW_REGIME",
                  title: "New Regime (Default)",
                  total: regimeResult.newRegime.totalTax,
                  lines: [
                    `Taxable: ${formatINRWhole(regimeResult.newRegime.taxableIncome)}`,
                    `87A Rebate: -${formatINRWhole(regimeResult.newRegime.section87aRebate)}`,
                    `Marginal Relief + Cess: ${formatINRWhole(regimeResult.newRegime.cess)}`,
                  ],
                  cardCls: "border-emerald-500/30 bg-emerald-500/5",
                  valCls: "text-emerald-400",
                },
                {
                  key: "OLD_REGIME",
                  title: "Old Regime",
                  total: regimeResult.oldRegime.totalTax,
                  lines: [
                    `Deductions: ${formatINRWhole(regimeResult.oldRegime.totalDeductions)}`,
                    `Taxable: ${formatINRWhole(regimeResult.oldRegime.taxableIncome)}`,
                    `Cess (4%): ${formatINRWhole(regimeResult.oldRegime.cess)}`,
                  ],
                  cardCls: "border-[var(--app-border)] bg-[var(--app-card-subtle)]",
                  valCls: "text-[var(--app-fg)]",
                },
              ].map((r) => (
                <div key={r.key} className={`p-4 rounded-xl border space-y-2 ${r.cardCls}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{r.title}</span>
                    {regimeResult.recommendedRegime === r.key && <Badge variant="success" size="xs">Recommended</Badge>}
                  </div>
                  <div className={`text-xl font-extrabold font-mono ${r.valCls}`}>{formatINRWhole(r.total)}</div>
                  <div className="space-y-0.5 text-[11px] text-[var(--app-muted)] font-mono">
                    {r.lines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] flex flex-col justify-between space-y-2">
                <div className="font-bold">Regime Verdict</div>
                <div className="text-lg font-extrabold font-mono text-sky-400">
                  {regimeResult.recommendedRegime === "EQUAL"
                    ? "Equal Tax Liability"
                    : `Save ${formatINRWhole(regimeResult.savingsAmount)}`}
                </div>
                <p className="text-[11px] text-[var(--app-muted)] leading-relaxed">
                  {regimeResult.advice ||
                    (regimeResult.recommendedRegime === "NEW_REGIME"
                      ? "New Regime results in lower annual tax outflow for this income profile."
                      : regimeResult.recommendedRegime === "OLD_REGIME"
                      ? "Claimed Chapter VI-A & HRA deductions make Old Regime cheaper."
                      : "Both regimes give identical liability.")}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* VIEW 3: SELF-UPDATING TAX RULES & SLABS */}
      {activeSubTab === "rules" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6 border-emerald-500/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold">Automatic Current Tax System Sync</h3>
                <Badge variant="emerald" size="xs">Self-Updating</Badge>
              </div>
              <p className="text-xs text-[var(--app-muted)] leading-relaxed">
                ArthaX tracks only the active Indian tax year ({activePreset.label}), rolls over automatically every April 1, and checks daily via background automation &amp; grounded official Budget verification so new Finance Acts update rates and slabs automatically.
              </p>
              {autoStatus?.checkedAt && (
                <p className="text-[11px] text-[var(--app-muted)] font-mono">
                  Last auto-check: {new Date(autoStatus.checkedAt).toLocaleString("en-IN")} • Source: {autoStatus.source}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw size={13} className={isCheckingAutoUpdate ? "animate-spin" : ""} />}
                onClick={() => void handleAutoCheckUpdates()}
                disabled={isCheckingAutoUpdate}
              >
                {isCheckingAutoUpdate ? "Checking Budgets..." : "Check & Auto-Update Now"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<SlidersHorizontal size={13} />}
                onClick={() => setShowManualEditor((v) => !v)}
              >
                {showManualEditor ? "Hide Override" : "Manual Override"}
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="p-5 sm:p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <ReceiptIndianRupee size={16} className="text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold">Capital Gains Rules</h3>
                  <p className="text-[11px] text-[var(--app-muted)]">{activePreset.label}</p>
                </div>
              </div>
              {[
                ["Equity LTCG (Sec 112A)", equityLtcgRatePct, "emerald", `Holding ≥ ${activeRules.equity.ltcgThresholdDays}d. First ${formatINRWhole(ltcgExemptionLimit)}/yr exempt.`],
                ["Equity STCG (Sec 111A)", equityStcgRatePct, "sky", `Holding < ${activeRules.equity.ltcgThresholdDays}d. Flat ${equityStcgRatePct} tax.`],
                ["Bullion / Bonds / Crypto", `${bullionLtcgRatePct} / ${cryptoEffectivePct}`, "neutral", `Bullion ≥ ${activeRules.bullion.ltcgThresholdDays}d @ ${bullionLtcgRatePct}; Bonds ≥ ${activeRules.bondsListed.ltcgThresholdDays}d @ ${bondsLtcgRatePct}; VDA @ ${cryptoEffectivePct}.`],
              ].map(([title, badge, variant, desc]) => (
                <div key={title} className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                  <div className="flex justify-between items-center font-semibold">
                    <span>{title}</span>
                    <Badge variant={variant as BadgeVariant} size="xs">{badge}</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--app-muted)]">{desc}</p>
                </div>
              ))}
            </Card>

            <Card className="p-5 sm:p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold">New Regime Income Slabs</h3>
                  <p className="text-[11px] text-[var(--app-muted)]">
                    Std Ded {formatINRWhole(activeRules.newRegime.standardDeduction)} • 87A ≤ {formatLakhs(activeRules.newRegime.rebate87aMaxIncome)}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {activeRules.newRegime.slabs.map((slab, idx) => {
                  const prev = idx === 0 ? 0 : activeRules.newRegime.slabs[idx - 1].upTo || 0;
                  return (
                    <div key={`${idx}-${slab.upTo ?? "top"}`} className="flex justify-between px-2.5 py-1.5 rounded-lg bg-[var(--app-card-subtle)] border border-[var(--app-border)] font-mono text-[11px]">
                      <span>{slab.upTo === null ? `Above ${formatLakhs(prev)}` : `${formatLakhs(prev)} – ${formatLakhs(slab.upTo)}`}</span>
                      <span className="font-bold text-emerald-400">{formatRatePercent(slab.rate)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold">Set-Off &amp; Compliance</h3>
                  <p className="text-[11px] text-[var(--app-muted)]">Current Active Filing Rules</p>
                </div>
              </div>
              {[
                ["STCL / LTCL Set-Off", "8-Yr Carry Forward", "sky", `STCL offsets STCG & LTCG; LTCL offsets LTCG only. Crypto losses ${activeRules.cryptoVda.allowLossSetoff ? "enabled." : "cannot be set off (Sec 115BBH)."}`],
                ["Harvesting Cutoff", "March 31", "emerald", `FY settlement window: ${fyWindowText}.`],
                ["Individual ITR Filing", "July 31", "sky", "File ITR-2 / ITR-3 before due date to carry forward capital losses."],
              ].map(([title, badge, variant, desc]) => (
                <div key={title} className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                  <div className="flex justify-between items-center font-semibold">
                    <span>{title}</span>
                    <Badge variant={variant as BadgeVariant} size="xs">{badge}</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--app-muted)]">{desc}</p>
                </div>
              ))}
            </Card>
          </div>

          {showManualEditor && (
            <Card className="p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold">Manual Override for Current System ({activePreset.label})</h3>
                  <p className="text-xs text-[var(--app-muted)]">Optional fine-tuning or JSON import/export for current tax rules.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" icon={<Download size={13} />} onClick={handleExportPresetJson}>Export JSON</Button>
                  <Button variant="outline" size="sm" icon={<Upload size={13} />} onClick={() => setShowJsonImport((v) => !v)}>Import JSON</Button>
                  {activePreset.isCustomized && (
                    <Button variant="outline" size="sm" icon={<RotateCcw size={13} />} onClick={handleResetCurrentRules} disabled={isSavingRules}>Reset Default</Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isSavingRules}
                    onClick={() =>
                      void saveRuleOverride(
                        { rulesVersion: editorRulesVersion.trim() || undefined, ...editorRulesDraft },
                        "Current Tax Rules Updated",
                        `Saved rules for ${activePreset.label}.`
                      )
                    }
                  >
                    {isSavingRules ? "Saving..." : "Save & Recalculate"}
                  </Button>
                </div>
              </div>

              {showJsonImport && (
                <div className="p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] space-y-2.5 text-xs">
                  <div className="font-semibold">Paste JSON Preset Override (TaxRuleOverride)</div>
                  <textarea
                    rows={4}
                    value={jsonImportText}
                    onChange={(e) => setJsonImportText(e.target.value)}
                    placeholder='{"rulesVersion": "Union Budget 2027", "equity": {"ltcgExemptionLimit": 150000}}'
                    className="w-full p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowJsonImport(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={() => void handleImportPresetJson()}>Apply JSON</Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <label className="space-y-1 sm:col-span-2">
                  <span className="block text-[11px] font-medium text-[var(--app-muted)]">Statute / Budget Version</span>
                  <input
                    type="text"
                    value={editorRulesVersion}
                    onChange={(e) => updateDraft({ version: e.target.value })}
                    className={INPUT_CLS}
                  />
                </label>

                {ruleEditorFields.map((f) => (
                  <label key={f.label} className="space-y-1">
                    <span className="block text-[11px] font-medium text-[var(--app-muted)]">{f.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={f.max}
                      step={f.step}
                      value={f.value}
                      onChange={(e) => {
                        const raw = Math.max(0, Number(e.target.value) || 0);
                        f.onChange(f.max ? Math.min(f.max, raw) : raw);
                      }}
                      className={INPUT_CLS}
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--app-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">New Regime Tax Brackets</span>
                  <Button variant="outline" size="sm" icon={<Plus size={12} />} onClick={addNewSlabRow}>Add Slab Bracket</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  {editorRulesDraft.newRegime.slabs.map((slab, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[var(--app-muted)]">
                        <span>Bracket #{idx + 1}</span>
                        {editorRulesDraft.newRegime.slabs.length > 2 && slab.upTo !== null && (
                          <button type="button" onClick={() => removeSlabRow(idx)} className="text-rose-400 hover:text-rose-300 cursor-pointer">
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          disabled={slab.upTo === null}
                          placeholder="Top (∞)"
                          value={slab.upTo ?? ""}
                          onChange={(e) =>
                            updateNewSlab(idx, {
                              upTo: e.target.value === "" ? null : Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-full px-2 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card)] font-mono text-[11px] disabled:opacity-60"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(slab.rate * 1000) / 10}
                          onChange={(e) =>
                            updateNewSlab(idx, { rate: Math.min(1, Math.max(0, (Number(e.target.value) || 0) / 100)) })
                          }
                          className="w-full px-2 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-card)] font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
