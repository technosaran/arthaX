"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Coins,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";

interface CashflowForecastData {
  timestamp: string;
  current_liquidity: {
    total_liquid_cash: number;
    liquid_accounts_count: number;
    total_liabilities: number;
    net_liquid_reserve: number;
  };
  monthly_cashflow_baseline: {
    expected_monthly_income: number;
    expected_monthly_burn: number;
    committed_recurring_burn: number;
    monthly_net_savings: number;
    savings_rate_percentage: number;
  };
  emergency_runway: {
    months: number;
    status: "CRITICAL" | "CAUTION" | "HEALTHY" | "EXCELLENT" | "INSUFFICIENT_DATA";
    recommended_minimum_months: number;
    recommended_liquid_target: number;
    deficit_surplus: number;
  };
  projections: Array<{
    days: number;
    months: number;
    horizon_label: string;
    base_case_balance: number;
    best_case_balance: number;
    worst_case_balance: number;
    projected_net_change: number;
  }>;
  assumptions: string[];
}

export default function CashflowForecastSection() {
  const { showToast } = useToast();
  const [data, setData] = useState<CashflowForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadForecastData = useCallback(async () => {
    const res = await fetch("/api/v1/forecast/cashflow");
    if (!res.ok) throw new Error("Failed to load cashflow forecast");
    const json = await res.json();
    return (json.data || json) as CashflowForecastData;
  }, []);

  const fetchForecast = useCallback(async () => {
    try {
      setLoading(true);
      const nextData = await loadForecastData();
      setData(nextData);
    } catch {
      showToast("Could not load cashflow forecast", "error");
    } finally {
      setLoading(false);
    }
  }, [loadForecastData, showToast]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const nextData = await loadForecastData();
        if (active) setData(nextData);
      } catch {
        if (active) showToast("Could not load cashflow forecast", "error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadForecastData, showToast]);

  const runwayMonths = data?.emergency_runway.months ?? 0;
  const runwayStatus = data?.emergency_runway.status ?? "CALCULATING";
  const runwayDisplay =
    runwayStatus === "INSUFFICIENT_DATA" && runwayMonths >= 999
      ? "No Burn"
      : runwayMonths >= 999
      ? "999+ Months"
      : `${runwayMonths} Months`;

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <PageHeader
        title="Cash-Flow Forecasting & Runway"
        description="Deterministic multi-scenario cash projections and emergency runway modeling."
        icon={<Clock size={20} className="text-emerald-500 dark:text-emerald-400" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchForecast()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh Forecast
          </Button>
        }
      />

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <CardSkeleton rows={5} />
        </div>
      ) : !data ? (
        <Card className="p-8 text-center space-y-4">
          <p className="text-sm text-[var(--app-muted)]">
            Unable to load cash-flow forecast right now.
          </p>
          <Button variant="outline" size="sm" onClick={() => void fetchForecast()}>
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard
              title="Emergency Runway"
              value={runwayDisplay}
              subtitle={`Target: ${data.emergency_runway.recommended_minimum_months ?? 6} Mo (${runwayStatus.replace("_", " ")})`}
              icon={runwayStatus === "CRITICAL" ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
              trend={{ direction: runwayStatus === "CRITICAL" ? "down" : "up" }}
            />
            <StatCard
              title="Total Liquid Reserve"
              value={`₹${(data.current_liquidity.total_liquid_cash ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              subtitle={`Across ${data.current_liquidity.liquid_accounts_count ?? 0} liquid accounts`}
              icon={<Coins size={18} />}
            />
            <StatCard
              title="Monthly Burn Rate"
              value={`₹${(data.monthly_cashflow_baseline.expected_monthly_burn ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              subtitle={`Incl. ₹${(data.monthly_cashflow_baseline.committed_recurring_burn ?? 0).toLocaleString("en-IN")} committed`}
              icon={<TrendingDown size={18} />}
            />
            <StatCard
              title="Monthly Savings Net"
              value={`₹${(data.monthly_cashflow_baseline.monthly_net_savings ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              subtitle={`${data.monthly_cashflow_baseline.savings_rate_percentage ?? 0}% savings rate`}
              icon={<TrendingUp size={18} />}
              trend={{ direction: (data.monthly_cashflow_baseline.monthly_net_savings ?? 0) >= 0 ? "up" : "down" }}
            />
          </div>

          {/* Projections Matrix */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-[var(--app-border)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm">Deterministic Scenario Projections</h3>
                <p className="text-xs text-[var(--app-muted)]">Balances projected across 30, 60, 90, 180, and 365 days under distinct cashflow scenarios.</p>
              </div>
              <Badge variant="neutral" className="gap-1">
                <Sparkles size={12} />
                Deterministic Engine
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--app-bg)] border-b border-[var(--app-border)] text-[var(--app-muted)] text-xs uppercase">
                  <tr>
                    <th className="p-3 pl-4">Horizon</th>
                    <th className="p-3">Base Case Balance</th>
                    <th className="p-3 text-emerald-600 dark:text-emerald-400">Best Case (+10% Income, -15% Spend)</th>
                    <th className="p-3 text-rose-600 dark:text-rose-400">Worst Case (-15% Income, +20% Shock)</th>
                    <th className="p-3 text-right pr-4">Projected Net Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {(data.projections || []).map((proj) => (
                    <tr key={proj.days} className="hover:bg-[var(--app-card-hover)] transition-colors">
                      <td className="p-3 pl-4 font-semibold flex items-center gap-2 whitespace-nowrap">
                        <Calendar size={16} className="text-[var(--app-muted)] shrink-0" />
                        <span>{proj.horizon_label}</span>
                      </td>
                      <td className="p-3 font-semibold text-sm font-mono tabular-nums whitespace-nowrap">
                        ₹{proj.base_case_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-emerald-600 dark:text-emerald-400 font-medium text-sm font-mono tabular-nums whitespace-nowrap">
                        ₹{proj.best_case_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-rose-600 dark:text-rose-400 font-medium text-sm font-mono tabular-nums whitespace-nowrap">
                        ₹{proj.worst_case_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right pr-4 font-medium text-sm font-mono tabular-nums whitespace-nowrap">
                        <span className={proj.projected_net_change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {proj.projected_net_change >= 0 ? "+" : ""}
                          ₹{proj.projected_net_change.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Assumptions & Methodology Card */}
          <Card className="p-5 space-y-3 bg-[var(--app-card-subtle)] border border-[var(--app-border)]">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <HelpCircle size={16} className="text-[var(--app-muted)]" />
              <span>Forecasting Methodology & Invariant Assumptions</span>
            </div>
            <ul className="text-xs text-[var(--app-muted)] space-y-1.5 list-disc pl-5">
              {(data.assumptions || []).map((asm, i) => (
                <li key={i}>{asm}</li>
              ))}
            </ul>
            <div className="p-3 rounded-lg bg-[var(--app-bg)] border border-[var(--app-border)] text-xs text-[var(--app-muted)] flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0 text-amber-500" />
              <span>
                Projections are deterministic models intended for financial planning and emergency runway awareness, not guaranteed investment returns or bank guarantees.
              </span>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
