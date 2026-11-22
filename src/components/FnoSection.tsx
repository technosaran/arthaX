"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  ExternalLink,
  Layers,
  History,
  Gauge,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

// Types
export interface FnoPosition {
  id: string;
  user_id: string;
  symbol: string;
  instrument_type: "CE" | "PE" | "FUT";
  strike_price: number | null;
  expiry_date: string;
  side: "BUY" | "SELL";
  product: "NRML" | "MIS" | "CNC";
  lot_size: number;
  lots: number;
  quantity: number;
  avg_price: number;
  ltp: number | null;
  status: "OPEN" | "CLOSED";
  exit_price: number | null;
  exit_date: string | null;
  target_price: number | null;
  stop_loss: number | null;
  strategy_name: string;
  account_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FnoTrade {
  id: string;
  user_id: string;
  position_id: string;
  symbol: string;
  instrument_type: "CE" | "PE" | "FUT";
  strike_price: number | null;
  expiry_date: string;
  side: "BUY" | "SELL";
  action: "ENTRY" | "EXIT" | "PARTIAL_EXIT" | "ROLLOVER";
  quantity: number;
  price: number;
  brokerage: number;
  exchange_charges: number;
  gst: number;
  stt: number;
  pnl: number;
  trade_date: string;
  notes: string | null;
  created_at: string;
}

export default function FnoSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Primary State
  const [positions, setPositions] = useState<FnoPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<boolean>(false);
  const autoSyncedRef = useRef<boolean>(false);
  const positionsRef = useRef<FnoPosition[]>(positions);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // Filter & Search
  const [positionFilter, setPositionFilter] = useState<"all" | "open" | "closed">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState<string>("all");
  const [syncingZerodha, setSyncingZerodha] = useState(false);

  // Currency & formatting helpers
  const formatINR = useCallback((val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  // Fetch Positions & Accounts
  const fetchData = useCallback(async () => {
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (positionsRef.current.length === 0) {
        setLoading(true);
      }
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const posRes = await fetch("/api/v1/fno/positions", { headers });

      if (posRes.ok) {
        const json = await posRes.json();
        setPositions(json.positions || []);
      }
    } catch (err) {
      console.error("[F&O] Error loading data:", err);
      showToast("F&O Data Failed", "Could not load Futures & Options positions.", "error");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [user, supabase, showToast]);

  useEffect(() => {
    fetchData();
    // Silent background auto-sync from Zerodha only once when session is active
    if (!autoSyncedRef.current) {
      autoSyncedRef.current = true;
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const headers: Record<string, string> = {};
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }
          const res = await fetch("/api/v1/integrations/zerodha/sync", { method: "POST", headers });
          const json = await res.json();
          if (json.success) {
            fetchData();
          }
        } catch {}
      })();
    }
  }, [fetchData, supabase]);

  // Sync F&O positions directly from Zerodha Kite API
  const handleSyncZerodha = async () => {
    setSyncingZerodha(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/v1/integrations/zerodha/sync", { method: "POST", headers });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const errorMsg =
          json.error?.message ||
          (typeof json.error === "string" ? json.error : null) ||
          "Failed to sync Zerodha positions";
        throw new Error(errorMsg);
      }
      const count = json.data?.fnoSynced ?? 0;
      showToast(
        "Zerodha Synced!",
        count > 0
          ? `Successfully synced ${count} F&O positions from Zerodha Kite.`
          : `Zerodha F&O sync completed! No open derivative positions in Zerodha.`,
        "success"
      );
      await fetchData();
    } catch (err: any) {
      showToast("F&O Sync Failed", err.message || "Failed to sync Zerodha F&O positions.", "error");
    } finally {
      setSyncingZerodha(false);
    }
  };

  // Aggregated Portfolio Stats
  const portfolioMetrics = useMemo(() => {
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = 0;
    let totalCapitalDeployed = 0;
    let totalOpenLots = 0;
    let netDelta = 0;
    let netTheta = 0;
    let netVega = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    // Open positions calculations
    const openPositions = positions.filter((p) => p.status === "OPEN");
    const closedPositions = positions.filter((p) => p.status === "CLOSED");

    for (const pos of openPositions) {
      const qty = Number(pos.quantity);
      const avg = Number(pos.avg_price);
      const ltp = Number(pos.ltp || pos.avg_price);

      // Unrealized P&L
      const pnl = pos.side === "BUY" ? (ltp - avg) * qty : (avg - ltp) * qty;
      totalUnrealizedPnL += pnl;

      // Capital deployed
      if (pos.side === "BUY") {
        totalCapitalDeployed += avg * qty;
      } else {
        // Option/Futures sell margin approx ₹1.1L/lot
        totalCapitalDeployed += pos.lots * 110000;
      }

      totalOpenLots += Number(pos.lots);

      // Approximate Greeks based on instrument
      const sign = pos.side === "BUY" ? 1 : -1;
      if (pos.instrument_type === "CE") {
        netDelta += sign * 0.5 * qty;
        netTheta += sign * -12 * pos.lots * 25; // Theta decay burns buyers, pays sellers
        netVega += sign * 8 * pos.lots;
      } else if (pos.instrument_type === "PE") {
        netDelta += sign * -0.5 * qty;
        netTheta += sign * -12 * pos.lots * 25;
        netVega += sign * 8 * pos.lots;
      } else {
        // Futures Delta = 1.0
        netDelta += sign * 1.0 * qty;
      }
    }

    // Closed positions Realized P&L
    for (const pos of closedPositions) {
      const qty = Number(pos.quantity);
      const avg = Number(pos.avg_price);
      const exit = Number(pos.exit_price || avg);
      const pnl = pos.side === "BUY" ? (exit - avg) * qty : (avg - exit) * qty;
      totalRealizedPnL += pnl;

      if (pnl > 0) winningTrades++;
      else if (pnl < 0) losingTrades++;
    }

    const totalTradesCount = winningTrades + losingTrades;
    const winRate = totalTradesCount > 0 ? (winningTrades / totalTradesCount) * 100 : 0;

    return {
      openCount: openPositions.length,
      closedCount: closedPositions.length,
      totalOpenLots,
      totalUnrealizedPnL,
      totalRealizedPnL,
      netTotalPnL: totalUnrealizedPnL + totalRealizedPnL,
      totalCapitalDeployed,
      netDelta: +netDelta.toFixed(1),
      netTheta: +netTheta.toFixed(0),
      netVega: +netVega.toFixed(0),
      winRate: +winRate.toFixed(1),
      winningTrades,
      losingTrades,
    };
  }, [positions]);

  // Filtered Positions
  const displayedPositions = useMemo(() => {
    let list = [...positions];

    // Status filter
    if (positionFilter === "open") {
      list = list.filter((p) => p.status === "OPEN");
    } else if (positionFilter === "closed") {
      list = list.filter((p) => p.status === "CLOSED");
    }

    // Instrument filter
    if (instrumentFilter !== "all") {
      list = list.filter((p) => p.instrument_type === instrumentFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.symbol.toLowerCase().includes(q) ||
          p.strategy_name?.toLowerCase().includes(q) ||
          (p.strike_price && p.strike_price.toString().includes(q))
      );
    }

    return list;
  }, [positions, positionFilter, instrumentFilter, searchQuery]);

  // Zerodha Kite Deep Links
  const getKiteChartUrl = (sym: string) =>
    `https://kite.zerodha.com/chart/ext/ciq/NFO/${encodeURIComponent(sym)}`;

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* 1. TOP HEADER WITH ZERODHA KITE BRANDING & MARKET STATUS */}
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Zap size={22} className="fill-orange-400/20" />
            </span>
            <span>Futures & Options (F&O) Derivatives</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw size={13} className={syncingZerodha ? "animate-spin" : ""} />}
              disabled={syncingZerodha}
              onClick={handleSyncZerodha}
              title="Sync Zerodha F&O positions"
            >
              {syncingZerodha ? "Syncing..." : "Sync Zerodha F&O"}
            </Button>
          </div>
        }
      />

      {/* 2. TOP METRICS DASHBOARD CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Unrealized MTM P&L */}
        <StatCard
          label="Unrealized MTM P&L"
          value={
            loading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span
                className={
                  portfolioMetrics.totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                {portfolioMetrics.totalUnrealizedPnL >= 0 ? "+" : ""}
                {formatINR(portfolioMetrics.totalUnrealizedPnL)}
              </span>
            )
          }
          subtitle={`${portfolioMetrics.openCount} open position${
            portfolioMetrics.openCount === 1 ? "" : "s"
          } (${portfolioMetrics.totalOpenLots} lots)`}
          icon={
            portfolioMetrics.totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="text-emerald-400" size={18} />
            ) : (
              <TrendingDown className="text-rose-400" size={18} />
            )
          }
          iconColor={portfolioMetrics.totalUnrealizedPnL >= 0 ? "emerald" : "rose"}
        />

        {/* Realized P&L */}
        <StatCard
          label="Realized Booked P&L"
          value={
            loading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span
                className={
                  portfolioMetrics.totalRealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                {portfolioMetrics.totalRealizedPnL >= 0 ? "+" : ""}
                {formatINR(portfolioMetrics.totalRealizedPnL)}
              </span>
            )
          }
          subtitle={`${portfolioMetrics.closedCount} closed trades (${portfolioMetrics.winRate}% win rate)`}
          icon={<History className="text-sky-400" size={18} />}
          iconColor="sky"
        />

        {/* Margin / Premium Deployed */}
        <StatCard
          label="Capital / Margin Deployed"
          value={
            loading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              formatINR(portfolioMetrics.totalCapitalDeployed)
            )
          }
          subtitle="Margin & Options Premium in play"
          icon={<Layers className="text-amber-400" size={18} />}
          iconColor="amber"
        />

        {/* Portfolio Greeks */}
        <StatCard
          label="Portfolio Greeks"
          value={
            loading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <div className="flex items-baseline gap-2 font-mono text-base font-bold">
                <span title="Net Delta (Directional Bias)">
                  Δ {portfolioMetrics.netDelta > 0 ? "+" : ""}
                  {portfolioMetrics.netDelta}
                </span>
                <span className="text-xs text-[var(--app-muted)]">|</span>
                <span
                  title="Net Theta (Daily Time Decay in ₹)"
                  className={portfolioMetrics.netTheta >= 0 ? "text-emerald-400" : "text-amber-400"}
                >
                  Θ {portfolioMetrics.netTheta >= 0 ? "+" : ""}
                  {portfolioMetrics.netTheta}/d
                </span>
              </div>
            )
          }
          subtitle="Delta Directional & Theta Decay"
          icon={<Gauge className="text-violet-400" size={18} />}
          iconColor="violet"
        />
      </div>

      {/* POSITIONS & TRADES */}
      <div className="space-y-5">
          {/* Controls Bar: Filter by Status, Instrument, Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)]">
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                size="sm"
                value={positionFilter}
                onChange={(v) => setPositionFilter(v as typeof positionFilter)}
                options={[
                  { value: "open", label: `Open (${portfolioMetrics.openCount})` },
                  { value: "closed", label: `Closed (${portfolioMetrics.closedCount})` },
                  { value: "all", label: `All (${positions.length})` },
                ]}
              />

              {/* Instrument Type Pills */}
              <div className="flex items-center gap-1 pl-2 border-l border-[var(--app-border)]">
                {["all", "CE", "PE", "FUT"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setInstrumentFilter(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      instrumentFilter === type
                        ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)]"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)] border border-transparent"
                    }`}
                  >
                    {type === "all" ? "All Types" : type}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search symbol, strike, strategy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={14} />}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Positions Table (Zerodha Kite Style) */}
          {displayedPositions.length === 0 ? (
            <div className="p-12 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)]">
              <EmptyState
                icon={<Zap size={32} className="text-orange-400" />}
                title="No F&O positions found"
                description={
                  positions.length === 0
                    ? "Your open positions and trades from Zerodha Kite will automatically synchronize and appear here."
                    : "No positions match your search and filter criteria."
                }
                action={
                  positions.length === 0 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<RefreshCw size={14} className={syncingZerodha ? "animate-spin" : ""} />}
                      disabled={syncingZerodha}
                      onClick={handleSyncZerodha}
                    >
                      {syncingZerodha ? "Syncing..." : "Sync Zerodha F&O Now"}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] bg-[var(--app-card-elevated)]/60 text-[var(--app-muted)] font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Instrument / Contract</th>
                      <th className="py-3 px-3">Product</th>
                      <th className="py-3 px-3">Side</th>
                      <th className="py-3 px-3 text-right">Qty (Lots)</th>
                      <th className="py-3 px-3 text-right">Avg Entry</th>
                      <th className="py-3 px-3 text-right">LTP / Exit</th>
                      <th className="py-3 px-4 text-right">P&L (MTM)</th>
                      <th className="py-3 px-4 text-center">Chart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)]">
                    {displayedPositions.map((p) => {
                      const qty = Number(p.quantity);
                      const avg = Number(p.avg_price);
                      const currentPrice =
                        p.status === "CLOSED" ? Number(p.exit_price || avg) : Number(p.ltp || avg);

                      const pnl =
                        p.side === "BUY" ? (currentPrice - avg) * qty : (avg - currentPrice) * qty;
                      const invested = p.side === "BUY" ? avg * qty : p.lots * 110000;
                      const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
                      const isProfit = pnl >= 0;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-[var(--app-card-elevated)]/40 transition-colors group"
                        >
                          {/* Contract name & Expiry */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  p.status === "OPEN" ? "bg-emerald-400" : "bg-neutral-500"
                                }`}
                              />
                              <div>
                                <div className="flex items-center gap-1.5 font-bold text-sm text-[var(--app-fg)]">
                                  <span>{p.symbol}</span>
                                  {p.strike_price && (
                                    <span className="font-mono">{p.strike_price}</span>
                                  )}
                                  <Badge
                                    size="xs"
                                    variant={
                                      p.instrument_type === "CE"
                                        ? "emerald"
                                        : p.instrument_type === "PE"
                                        ? "rose"
                                        : "sky"
                                    }
                                  >
                                    {p.instrument_type}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-2">
                                  <span>Exp: {p.expiry_date}</span>
                                  <span>•</span>
                                  <span className="text-[10px] opacity-80">{p.strategy_name}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Product */}
                          <td className="py-3 px-3">
                            <Badge size="xs" variant="neutral">
                              {p.product}
                            </Badge>
                          </td>

                          {/* Side */}
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                p.side === "BUY"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                                  : "bg-orange-500/10 text-orange-400 border border-orange-500/30"
                              }`}
                            >
                              {p.side}
                            </span>
                          </td>

                          {/* Qty & Lots */}
                          <td className="py-3 px-3 text-right font-mono">
                            <div className="font-bold text-[var(--app-fg)]">{qty}</div>
                            <div className="text-[10px] text-[var(--app-muted)]">
                              {p.lots} {p.lots === 1 ? "Lot" : "Lots"}
                            </div>
                          </td>

                          {/* Avg Price */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-[var(--app-fg)]">
                            {formatINR(avg)}
                          </td>

                          {/* LTP / Exit */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-[var(--app-fg)]">
                            {formatINR(currentPrice)}
                            {p.status === "CLOSED" && (
                              <div className="text-[10px] text-[var(--app-muted)] font-normal">
                                Closed
                              </div>
                            )}
                          </td>

                          {/* P&L */}
                          <td className="py-3 px-4 text-right font-mono">
                            <div
                              className={`font-bold text-sm ${
                                isProfit ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isProfit ? "+" : ""}
                              {formatINR(pnl)}
                            </div>
                            <div
                              className={`text-[10px] ${
                                isProfit ? "text-emerald-400/80" : "text-rose-400/80"
                              }`}
                            >
                              {isProfit ? "+" : ""}
                              {pnlPercent.toFixed(2)}%
                            </div>
                          </td>

                          {/* Zerodha Kite Chart Link */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center">
                              <a
                                href={getKiteChartUrl(p.symbol)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                                title="Open in Zerodha Kite"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-4 bg-[var(--app-card-elevated)]/40 border-t border-[var(--app-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-[var(--app-muted)]">
                  Showing <strong>{displayedPositions.length}</strong> of{" "}
                  <strong>{positions.length}</strong> F&O contracts
                </div>
                <div className="flex items-center gap-4 font-mono font-medium">
                  <div>
                    <span className="text-[var(--app-muted)]">Unrealized MTM: </span>
                    <strong
                      className={
                        portfolioMetrics.totalUnrealizedPnL >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }
                    >
                      {portfolioMetrics.totalUnrealizedPnL >= 0 ? "+" : ""}
                      {formatINR(portfolioMetrics.totalUnrealizedPnL)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[var(--app-muted)]">Realized: </span>
                    <strong
                      className={
                        portfolioMetrics.totalRealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                      }
                    >
                      {portfolioMetrics.totalRealizedPnL >= 0 ? "+" : ""}
                      {formatINR(portfolioMetrics.totalRealizedPnL)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

    </main>
  );
}
