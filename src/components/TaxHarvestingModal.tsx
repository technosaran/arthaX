"use client";

import React, { useState } from "react";
import {
  Calculator,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Percent,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { useTaxAnalysisQuery } from "@/hooks/usePortfolioQueries";

interface TaxHarvestingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaxHarvestingModal({ isOpen, onClose }: TaxHarvestingModalProps) {
  const [slabRate, setSlabRate] = useState<number>(0.30);
  const [assessmentYear, setAssessmentYear] = useState<string>("2025-2026");

  // TanStack Query powered hook
  const { data: taxData, isLoading, refetch, isRefetching } = useTaxAnalysisQuery(assessmentYear, slabRate);

  const formatINR = (val: number) => {
    return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Calculator size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--app-fg)]">Union Budget 2024 Tax & Harvesting Engine</span>
              <Badge variant="warning" size="sm">
                FY 2024–25 (AY 2025–26)
              </Badge>
            </div>
            <p className="text-xs text-[var(--app-muted)]">
              Realized capital gains calculation & automated tax-loss harvesting simulator
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[var(--app-muted)] font-medium">Income Tax Slab:</span>
            <div className="flex items-center gap-1">
              {[0.10, 0.20, 0.30, 0.39].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSlabRate(rate)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    slabRate === rate
                      ? "bg-emerald-500 text-white"
                      : "bg-[var(--app-card)] text-[var(--app-muted)] hover:text-[var(--app-fg)] border border-[var(--app-border)]"
                  }`}
                >
                  {(rate * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={isRefetching ? "animate-spin" : ""} />
            Re-calculate
          </Button>
        </div>

        {/* Budget 2024 Rule Explainer Pill */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200/90 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
            <Info size={14} />
            <span>Union Budget 2024 Capital Gains Rules</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
            • <b>Equity LTCG</b> (holding ≥ 12m): <b>12.5%</b> on gains above the revised <b>₹1.25 Lakh</b> exemption threshold (Sec 112A).<br />
            • <b>Equity STCG</b> (holding &lt; 12m): <b>20%</b> flat rate (Sec 111A).<br />
            • <b>Debt Mutual Funds</b>: Taxed at slab rate without indexation.<br />
            • <b>Tax-Loss Harvesting</b>: Realize unrealized losses before March 31st to offset taxable gains.
          </p>
        </div>

        {/* Realized Capital Gains Summary */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
            Realized Capital Gains (AY {assessmentYear})
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Equity LTCG"
              value={taxData ? formatINR(taxData.realized.equityLtcgGain) : "₹0.00"}
              icon={<Percent size={14} />}
              iconColor="emerald"
              subtitle={`Tax: ${taxData ? formatINR(taxData.realized.equityLtcgTax) : "₹0"}`}
            />
            <StatCard
              label="Equity STCG (20%)"
              value={taxData ? formatINR(taxData.realized.equityStcgGain) : "₹0.00"}
              icon={<TrendingDown size={14} />}
              iconColor="sky"
              subtitle={`Tax: ${taxData ? formatINR(taxData.realized.equityStcgTax) : "₹0"}`}
            />
            <StatCard
              label="Total Realized Gains"
              value={taxData ? formatINR(taxData.realized.totalRealizedGains) : "₹0.00"}
              icon={<ShieldCheck size={14} />}
              iconColor="violet"
            />
            <StatCard
              label="Estimated Total Tax"
              value={taxData ? formatINR(taxData.realized.totalEstimatedTax) : "₹0.00"}
              icon={<Calculator size={14} />}
              iconColor="rose"
            />
          </div>
        </div>

        {/* Tax-Loss Harvesting Opportunities */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-fg)]">
                Tax-Loss Harvesting Opportunities
              </h4>
            </div>
            {taxData && taxData.harvestingOpportunities.length > 0 && (
              <Badge variant="success" size="sm">
                Save ~{formatINR(taxData.totalPotentialTaxSavings)}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-[var(--app-muted)] animate-pulse">
              Analyzing portfolio lots and holding periods...
            </div>
          ) : !taxData || taxData.harvestingOpportunities.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-center space-y-2">
              <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
              <p className="text-sm font-semibold text-[var(--app-fg)]">No Loss Positions to Harvest</p>
              <p className="text-xs text-[var(--app-muted)]">
                All your tracked stock and mutual fund holdings are currently in profit or no losses are eligible for offset.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {taxData.harvestingOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-3.5 rounded-xl border transition-colors space-y-2"
                  style={{
                    backgroundColor: "var(--app-card)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--app-fg)]">{opp.symbol}</span>
                      <Badge
                        variant={opp.gainType === "STCG" ? "danger" : "warning"}
                        size="sm"
                      >
                        {opp.gainType} ({opp.holdingPeriodMonths}m)
                      </Badge>
                      <span className="text-[10px] text-[var(--app-muted)] uppercase tracking-wider">
                        {opp.assetClass}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400">
                        +Save ~{formatINR(opp.potentialTaxSavings)}
                      </div>
                      <div className="text-[10px] text-[var(--app-muted)]">
                        Offset @ {opp.effectiveTaxRate}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-[var(--app-border)]/60 text-[var(--app-muted)]">
                    <div>
                      Invested: <span className="font-medium text-[var(--app-fg)]">{formatINR(opp.investedAmount)}</span>
                    </div>
                    <div>
                      Current: <span className="font-medium text-[var(--app-fg)]">{formatINR(opp.currentValue)}</span>
                    </div>
                    <div>
                      Unrealized Loss:{" "}
                      <span className="font-bold text-rose-400">-{formatINR(opp.unrealizedLoss)}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[var(--app-muted)] italic leading-normal pt-0.5">
                    💡 {opp.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actionable Strategy Advice */}
        {taxData?.advice && taxData.advice.length > 0 && (
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs space-y-1.5">
            <div className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
              <ShieldCheck size={14} />
              <span>Smart Tax Planning Recommendations</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sky-900 dark:text-sky-200/90 text-[11px]">
              {taxData.advice.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
