"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ReceiptIndianRupee,
  Sparkles,
  Calculator,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  SlidersHorizontal,
  ArrowRight,
  Layers,
  Percent,
  Check,
  Copy,
  Calendar,
  Clock,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { useTaxAnalysisQuery } from "@/hooks/usePortfolioQueries";
import { useToast } from "@/context/ToastContext";
import EntityLogo from "@/components/EntityLogo";

interface TaxSectionProps {
  initialTab?: "overview" | "harvesting" | "rules";
  onNavigate?: (tab: string) => void;
}

export default function TaxSection({
  initialTab = "harvesting",
  onNavigate,
}: TaxSectionProps) {
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<"harvesting" | "overview" | "rules">(
    initialTab === "overview" ? "overview" : "harvesting"
  );
  const [assessmentYear, setAssessmentYear] = useState<string>("2025-2026");
  const [slabRate, setSlabRate] = useState<number>(0.30);

  // Search & filter states for Tax Harvesting
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [assetFilter, setAssetFilter] = useState<"all" | "equity" | "mutual_fund">("all");
  const [termFilter, setTermFilter] = useState<"all" | "STCG" | "LTCG">("all");
  const [sortBy, setSortBy] = useState<"savings" | "loss" | "holding">("savings");

  // Multi-select for simulator
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // TanStack Query
  const { data: taxData, isLoading, refetch, isRefetching } = useTaxAnalysisQuery(
    assessmentYear,
    slabRate
  );

  // Sync initial tab when changed from props/sidebar
  useEffect(() => {
    if (initialTab === "overview") {
      setActiveSubTab("overview");
    } else if (initialTab === "harvesting") {
      setActiveSubTab("harvesting");
    }
  }, [initialTab]);

  // Select all opportunities by default when data loads
  useEffect(() => {
    if (taxData?.harvestingOpportunities) {
      setSelectedIds(new Set(taxData.harvestingOpportunities.map((o) => o.id)));
    }
  }, [taxData?.harvestingOpportunities]);

  const handleSubTabChange = (tab: "harvesting" | "overview" | "rules") => {
    setActiveSubTab(tab);
    if (onNavigate) {
      if (tab === "overview") onNavigate("tax");
      else if (tab === "harvesting") onNavigate("tax-harvesting");
    }
  };

  const formatINR = (val: number): string => {
    return `₹${Math.round(val || 0).toLocaleString("en-IN")}`;
  };

  const formatINRFraction = (val: number): string => {
    return `₹${(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Filtered & sorted opportunities
  const filteredOpportunities = useMemo(() => {
    if (!taxData?.harvestingOpportunities) return [];

    let list = [...taxData.harvestingOpportunities];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (opp) =>
          opp.symbol.toLowerCase().includes(q) ||
          opp.assetClass.toLowerCase().includes(q)
      );
    }

    if (assetFilter !== "all") {
      list = list.filter((opp) => {
        if (assetFilter === "equity") return opp.assetClass === "equity";
        if (assetFilter === "mutual_fund")
          return opp.assetClass === "mutual_fund" || opp.assetClass === "debt_fund";
        return true;
      });
    }

    if (termFilter !== "all") {
      list = list.filter((opp) => opp.gainType === termFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "savings") return b.potentialTaxSavings - a.potentialTaxSavings;
      if (sortBy === "loss") return b.unrealizedLoss - a.unrealizedLoss;
      if (sortBy === "holding") return b.holdingPeriodMonths - a.holdingPeriodMonths;
      return 0;
    });

    return list;
  }, [taxData?.harvestingOpportunities, searchQuery, assetFilter, termFilter, sortBy]);

  // Selected opportunities totals
  const simulationMetrics = useMemo(() => {
    if (!taxData?.harvestingOpportunities) {
      return { totalLoss: 0, totalSavings: 0, count: 0 };
    }
    const selected = taxData.harvestingOpportunities.filter((o) => selectedIds.has(o.id));
    const totalLoss = selected.reduce((sum, item) => sum + item.unrealizedLoss, 0);
    const totalSavings = selected.reduce((sum, item) => sum + item.potentialTaxSavings, 0);
    return { totalLoss, totalSavings, count: selected.length };
  }, [taxData?.harvestingOpportunities, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!taxData?.harvestingOpportunities) return;
    if (selectedIds.size === taxData.harvestingOpportunities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(taxData.harvestingOpportunities.map((o) => o.id)));
    }
  };

  const handleSimulateOffset = () => {
    showToast(
      "Simulated Harvest Plan Ready",
      `Harvesting ${simulationMetrics.count} positions offsets ${formatINR(
        simulationMetrics.totalLoss
      )} in gains, saving ~${formatINR(simulationMetrics.totalSavings)} in capital gains tax.`,
      "success"
    );
  };

  // Section 112A LTCG Progress: ₹1.25 Lakh Exemption
  const ltcgExemptionLimit = 125000;
  const realizedLtcg = taxData?.realized.equityLtcgGain || 0;
  const ltcgUsedPercent = Math.min(100, Math.round((realizedLtcg / ltcgExemptionLimit) * 100));
  const remainingLtcgRoom = Math.max(0, ltcgExemptionLimit - realizedLtcg);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* SECTION HEADER WITH MODERN CONTROLS */}
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <ReceiptIndianRupee className="text-emerald-400" size={26} />
            <span>Tax & Tax Harvesting</span>
          </span>
        }
        description="Indian capital gains accounting, Section 112A exemptions & automated loss harvesting simulator"
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Assessment Year Selector */}
            <div className="flex items-center p-0.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAssessmentYear("2025-2026")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  assessmentYear === "2025-2026"
                    ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] font-bold shadow-xs border border-[var(--app-border)]"
                    : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                }`}
              >
                AY 2025–26 (FY24–25)
              </button>
              <button
                type="button"
                onClick={() => setAssessmentYear("2024-2025")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  assessmentYear === "2024-2025"
                    ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] font-bold shadow-xs border border-[var(--app-border)]"
                    : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                }`}
              >
                AY 2024–25
              </button>
            </div>

            {/* Income Tax Slab Rate Selector */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-xs">
              <span className="text-[var(--app-muted)] text-[11px] font-medium">Slab:</span>
              {[0.10, 0.20, 0.30, 0.39].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSlabRate(rate)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    slabRate === rate
                      ? "bg-emerald-500 text-white shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  {(rate * 100).toFixed(0)}%
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} />}
              disabled={isRefetching || isLoading}
              onClick={() => refetch()}
              title="Recalculate tax lots and harvesting opportunities"
            >
              Sync
            </Button>
          </div>
        }
      />

      {/* TOP EXECUTIVE METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Potential Tax Savings */}
        <StatCard
          label="Potential Tax Savings"
          value={
            isLoading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span className="text-emerald-400 font-extrabold font-mono">
                +{formatINR(taxData?.totalPotentialTaxSavings || 0)}
              </span>
            )
          }
          subtitle={
            isLoading
              ? "Calculating savings..."
              : `${taxData?.harvestingOpportunities.length || 0} loss positions eligible to harvest`
          }
          icon={<Sparkles className="text-emerald-400" size={18} />}
          iconColor="emerald"
        />

        {/* Total Harvestable Loss */}
        <StatCard
          label="Total Harvestable Loss"
          value={
            isLoading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span className="text-rose-400 font-bold font-mono">
                -{formatINR(taxData?.totalHarvestableLoss || 0)}
              </span>
            )
          }
          subtitle="Unrealized loss eligible for tax offset"
          icon={<TrendingDown className="text-rose-400" size={18} />}
          iconColor="rose"
        />

        {/* Realized Capital Gains */}
        <StatCard
          label="Realized Capital Gains"
          value={
            isLoading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span className="font-bold font-mono text-[var(--app-fg)]">
                {formatINR(taxData?.realized.totalRealizedGains || 0)}
              </span>
            )
          }
          subtitle={`AY ${assessmentYear} booked gains`}
          icon={<ReceiptIndianRupee className="text-sky-400" size={18} />}
          iconColor="sky"
        />

        {/* Estimated Total Tax */}
        <StatCard
          label="Estimated Capital Gains Tax"
          value={
            isLoading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span className="font-bold font-mono text-[var(--app-fg)]">
                {formatINR(taxData?.realized.totalEstimatedTax || 0)}
              </span>
            )
          }
          subtitle="Equity LTCG (12.5%) + STCG (20%)"
          icon={<Calculator className="text-amber-400" size={18} />}
          iconColor="amber"
        />
      </div>

      {/* VIEW TABS & TOOLBAR */}
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
                  {taxData?.harvestingOpportunities && taxData.harvestingOpportunities.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                      {taxData.harvestingOpportunities.length}
                    </span>
                  )}
                </span>
              ),
              icon: <Sparkles size={14} />,
            },
            {
              value: "overview",
              label: "Tax Overview",
              icon: <ReceiptIndianRupee size={14} />,
            },
            {
              value: "rules",
              label: "Tax Rules & Slabs",
              icon: <ShieldCheck size={14} />,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          VIEW 1: TAX-LOSS HARVESTING ENGINE
          ========================================================================= */}
      {activeSubTab === "harvesting" && (
        <div className="space-y-6">
          {/* Interactive Simulation Summary Action Bar */}
          {taxData && taxData.harvestingOpportunities.length > 0 && (
            <div
              className="p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-fg)] cursor-pointer"
                >
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                      selectedIds.size === taxData.harvestingOpportunities.length
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-[var(--app-border)] bg-[var(--app-card-subtle)]"
                    }`}
                  >
                    {selectedIds.size === taxData.harvestingOpportunities.length && <Check size={12} />}
                  </div>
                  <span>Select All ({taxData.harvestingOpportunities.length})</span>
                </button>

                <div className="h-4 w-px bg-[var(--app-border)] hidden sm:block" />

                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="text-[var(--app-muted)]">Selected: </span>
                    <span className="font-bold text-[var(--app-fg)]">{simulationMetrics.count}</span>
                  </div>
                  <div>
                    <span className="text-[var(--app-muted)]">Harvestable Loss: </span>
                    <span className="font-bold text-rose-400 font-mono">
                      -{formatINR(simulationMetrics.totalLoss)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--app-muted)]">Tax Saved: </span>
                    <span className="font-bold text-emerald-400 font-mono">
                      +{formatINR(simulationMetrics.totalSavings)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles size={13} />}
                  onClick={handleSimulateOffset}
                  disabled={simulationMetrics.count === 0}
                >
                  Simulate Harvest Offset
                </Button>
              </div>
            </div>
          )}

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] text-xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]"
              />
              <input
                type="text"
                placeholder="Search symbol or fund..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] text-xs text-[var(--app-fg)] placeholder:text-[var(--app-muted)] focus:outline-hidden focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Asset Class Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] p-0.5">
                <button
                  type="button"
                  onClick={() => setAssetFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    assetFilter === "all"
                      ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  All Assets
                </button>
                <button
                  type="button"
                  onClick={() => setAssetFilter("equity")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    assetFilter === "equity"
                      ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  Stocks
                </button>
                <button
                  type="button"
                  onClick={() => setAssetFilter("mutual_fund")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    assetFilter === "mutual_fund"
                      ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  Mutual Funds
                </button>
              </div>

              {/* Term Filter */}
              <div className="flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] p-0.5">
                <button
                  type="button"
                  onClick={() => setTermFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    termFilter === "all"
                      ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  All Terms
                </button>
                <button
                  type="button"
                  onClick={() => setTermFilter("STCG")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    termFilter === "STCG"
                      ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  STCG (&lt;12m)
                </button>
                <button
                  type="button"
                  onClick={() => setTermFilter("LTCG")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    termFilter === "LTCG"
                      ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] shadow-xs font-bold"
                      : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  LTCG (≥12m)
                </button>
              </div>

              {/* Sort By Dropdown */}
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

          {/* OPPORTUNITIES LIST */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] space-y-4 animate-pulse"
                >
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-full rounded-md" />
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-8 rounded-md" />
                    <Skeleton className="h-8 rounded-md" />
                    <Skeleton className="h-8 rounded-md" />
                  </div>
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
                    : "All your tracked stock and mutual fund holdings are currently in profit or have zero harvestable losses."}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOpportunities.map((opp) => {
                const isSelected = selectedIds.has(opp.id);
                return (
                  <div
                    key={opp.id}
                    onClick={() => toggleSelect(opp.id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer space-y-3.5 relative overflow-hidden ${
                      isSelected
                        ? "border-emerald-500/40 bg-[var(--app-card)] shadow-xs"
                        : "border-[var(--app-border)] bg-[var(--app-card-subtle)] opacity-85 hover:opacity-100"
                    }`}
                  >
                    {/* Top Row: Symbol, Badges, Tax Savings */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Custom Checkbox */}
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-[var(--app-border)] bg-[var(--app-card)]"
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>

                        {/* Entity Logo / Icon */}
                        <EntityLogo name={opp.symbol} size={28} className="rounded-lg flex-shrink-0" />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm sm:text-base text-[var(--app-fg)] truncate">
                              {opp.symbol}
                            </span>
                            <Badge
                              variant={opp.gainType === "STCG" ? "sky" : "emerald"}
                              size="xs"
                            >
                              {opp.gainType} ({opp.holdingPeriodMonths}m)
                            </Badge>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)]">
                              {opp.assetClass === "equity"
                                ? "Stock"
                                : opp.assetClass === "debt_fund"
                                ? "Debt MF"
                                : "Equity MF"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Savings Tag */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono">
                          +{formatINR(opp.potentialTaxSavings)}
                        </div>
                        <span className="text-[10px] text-[var(--app-muted)] font-mono">
                          Save @ {opp.effectiveTaxRate}%
                        </span>
                      </div>
                    </div>

                    {/* Middle Financial Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] text-xs">
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)]">Invested</div>
                        <div className="font-semibold text-[var(--app-fg)] font-mono">
                          {formatINR(opp.investedAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)]">Current Value</div>
                        <div className="font-semibold text-[var(--app-fg)] font-mono">
                          {formatINR(opp.currentValue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)]">Unrealized Loss</div>
                        <div className="font-bold text-rose-400 font-mono">
                          -{formatINR(opp.unrealizedLoss)}
                        </div>
                      </div>
                    </div>

                    {/* Actionable Strategy Tip */}
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--app-muted)]">
                      <Sparkles size={12} className="text-amber-400 flex-shrink-0" />
                      <span className="truncate">
                        Book before March 31 to offset taxable {opp.gainType} gains.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: TAX OVERVIEW & CAPITAL GAINS BREAKDOWN
          ========================================================================= */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Section 112A LTCG ₹1.25 Lakh Exemption Tracker Card */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--app-fg)]">
                    Section 112A Equity LTCG Exemption Tracker
                  </h3>
                  <Badge variant="warning" size="xs">
                    ₹1.25 Lakh Annual Cap
                  </Badge>
                </div>
                <p className="text-xs text-[var(--app-muted)]">
                  Under Union Budget 2024, equity LTCG up to ₹1,25,000 per financial year is 100% tax-exempt.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs text-[var(--app-muted)]">Remaining Tax-Free Room</div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">
                  {formatINR(remainingLtcgRoom)}
                </div>
              </div>
            </div>

            {/* Visual Exemption Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-[var(--app-track-bg)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${ltcgUsedPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--app-muted)] font-mono">
                <span>Realized LTCG: {formatINR(realizedLtcg)} ({ltcgUsedPercent}%)</span>
                <span>Exemption Cap: {formatINR(ltcgExemptionLimit)}</span>
              </div>
            </div>
          </Card>

          {/* Capital Gains & Tax Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Capital Gains Breakdown (AY {assessmentYear})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Equity LTCG Card */}
              <Card className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--app-fg)]">Equity LTCG</span>
                  <Badge variant="emerald" size="xs">12.5% Tax</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-extrabold text-[var(--app-fg)] font-mono">
                    {formatINR(taxData?.realized.equityLtcgGain || 0)}
                  </div>
                  <div className="text-[11px] text-[var(--app-muted)]">
                    Taxable (&gt; ₹1.25L): {formatINR(taxData?.realized.equityLtcgTaxable || 0)}
                  </div>
                  <div className="text-[11px] font-bold text-amber-400">
                    Tax: {formatINR(taxData?.realized.equityLtcgTax || 0)}
                  </div>
                </div>
              </Card>

              {/* Equity STCG Card */}
              <Card className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--app-fg)]">Equity STCG</span>
                  <Badge variant="sky" size="xs">20% Flat</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-extrabold text-[var(--app-fg)] font-mono">
                    {formatINR(taxData?.realized.equityStcgGain || 0)}
                  </div>
                  <div className="text-[11px] text-[var(--app-muted)]">
                    Holding &lt; 12 months (Sec 111A)
                  </div>
                  <div className="text-[11px] font-bold text-amber-400">
                    Tax: {formatINR(taxData?.realized.equityStcgTax || 0)}
                  </div>
                </div>
              </Card>

              {/* Debt Funds Card */}
              <Card className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--app-fg)]">Debt Funds</span>
                  <Badge variant="neutral" size="xs">Slab Rate</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-extrabold text-[var(--app-fg)] font-mono">
                    {formatINR(taxData?.realized.debtGain || 0)}
                  </div>
                  <div className="text-[11px] text-[var(--app-muted)]">
                    Taxed at {(slabRate * 100).toFixed(0)}% slab rate
                  </div>
                  <div className="text-[11px] font-bold text-amber-400">
                    Tax: {formatINR(taxData?.realized.debtTax || 0)}
                  </div>
                </div>
              </Card>

              {/* Total Summary Card */}
              <Card className="p-4 sm:p-5 space-y-3 border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">Total Tax Due</span>
                  <Badge variant="success" size="xs">FY 2024–25</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-extrabold text-emerald-400 font-mono">
                    {formatINR(taxData?.realized.totalEstimatedTax || 0)}
                  </div>
                  <div className="text-[11px] text-[var(--app-muted)]">
                    Net on {formatINR(taxData?.realized.totalRealizedGains || 0)} gains
                  </div>
                  <div className="text-[11px] text-emerald-400/80 font-medium">
                    Fully mapped to Budget &apos;24
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: BUDGET 2024 TAX RULES & SLABS CHEATSHEET
          ========================================================================= */}
      {activeSubTab === "rules" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Rate Structure */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ReceiptIndianRupee size={16} />
              </div>
              <h3 className="text-sm font-bold text-[var(--app-fg)]">Union Budget 2024 Rates</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Equity LTCG</span>
                  <Badge variant="emerald" size="xs">12.5%</Badge>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Holding ≥ 12 months. First ₹1.25 Lakh gains per year are tax-exempt under Section 112A.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Equity STCG</span>
                  <Badge variant="sky" size="xs">20.0%</Badge>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Holding &lt; 12 months. Taxed at flat 20% under Section 111A.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Debt Mutual Funds</span>
                  <Badge variant="neutral" size="xs">Slab Rate</Badge>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Taxed at normal income tax slab rates regardless of holding period (no indexation).
                </p>
              </div>
            </div>
          </Card>

          {/* Card 2: Set-off Provisions */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Layers size={16} />
              </div>
              <h3 className="text-sm font-bold text-[var(--app-fg)]">Loss Set-Off Rules</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Short-Term Loss (STCL)</span>
                  <Badge variant="sky" size="xs">High Flexibility</Badge>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Can be set off against <b>both</b> Short-Term (STCG) and Long-Term (LTCG) capital gains.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Long-Term Loss (LTCL)</span>
                  <Badge variant="warning" size="xs">LTCG Only</Badge>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Can <b>only</b> be set off against Long-Term Capital Gains (LTCG).
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Carry Forward Window</span>
                  <Badge variant="success" size="xs">8 Years</Badge>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Unabsorbed capital losses can be carried forward for up to 8 assessment years if ITR is filed before due date.
                </p>
              </div>
            </div>
          </Card>

          {/* Card 3: Key Deadlines & Execution */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Calendar size={16} />
              </div>
              <h3 className="text-sm font-bold text-[var(--app-fg)]">Compliance Deadlines</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Tax-Loss Harvesting Cutoff</span>
                  <span className="font-mono text-emerald-400 font-bold">March 31</span>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Sale trades must settle on or before March 31 to count for the current financial year.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Individual ITR Filing</span>
                  <span className="font-mono text-sky-400 font-bold">July 31</span>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Mandatory deadline to file ITR-2 / ITR-3 to preserve and carry forward capital losses.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-[var(--app-fg)]">Advance Tax Installments</span>
                  <span className="font-mono text-amber-400 font-bold">Quarterly</span>
                </div>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Payable on June 15 (15%), Sept 15 (45%), Dec 15 (75%), and March 15 (100%).
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
