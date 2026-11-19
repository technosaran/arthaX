"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bitcoin,
  RefreshCw,
  Search,
  ShieldCheck,
  AlertCircle,
  Key,
  Wallet,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  History,
  DollarSign,
  ArrowRightLeft,
  PieChart,
  Info,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import {
  CalculatedCryptoAsset,
  CalculatedCryptoTrade,
  CryptoTradeStats,
  ExitedCryptoAsset,
} from "@/utils/binance";

const DONUT_COLORS = [
  "#F7931A", // Bitcoin Orange
  "#627EEA", // Ethereum Blue
  "#14F195", // Solana Green
  "#F3BA2F", // Binance Yellow
  "#26A17B", // Tether Green
  "#2775CA", // USD Coin Blue
  "#00A6C4", // Cyan
  "#E6007A", // Polkadot Magenta
  "#8C8C8C", // Gray
  "#A855F7", // Purple
];

interface CryptoSectionProps {
  onNavigate?: (tab: string) => void;
}

export default function CryptoSection({ onNavigate }: CryptoSectionProps = {}) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // View Navigation: "holdings" | "trades" | "exited"
  const [activeSubTab, setActiveSubTab] = useState<"holdings" | "trades" | "exited">("holdings");

  // Trade History filters
  const [tradeSideFilter, setTradeSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const navigateToBinanceSettings = useCallback(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "settings");
      url.searchParams.set("section", "integrations");
      window.history.pushState({}, "", url.toString());
    }
    if (onNavigate) {
      onNavigate("settings");
    } else if (typeof window !== "undefined") {
      window.location.href = "/?tab=settings&section=integrations";
    }
  }, [onNavigate]);

  // Portfolio state
  const [portfolio, setPortfolio] = useState<{
    isBinanceConnected: boolean;
    lastSyncedAt: string | null;
    syncError: string | null;
    totalPortfolioUsd: number;
    netChange24hUsd: number;
    netChange24hPercent: number;
    assetsCount: number;
    assets: CalculatedCryptoAsset[];
  }>({
    isBinanceConnected: false,
    lastSyncedAt: null,
    syncError: null,
    totalPortfolioUsd: 0,
    netChange24hUsd: 0,
    netChange24hPercent: 0,
    assetsCount: 0,
    assets: [],
  });

  // Trades state
  const [tradesData, setTradesData] = useState<{
    trades: CalculatedCryptoTrade[];
    stats: CryptoTradeStats;
    exitedAssets: ExitedCryptoAsset[];
  }>({
    trades: [],
    stats: {
      totalBuysUsd: 0,
      totalSellsUsd: 0,
      netInvestedUsd: 0,
      totalFeesUsd: 0,
      totalTradesCount: 0,
      buyTradesCount: 0,
      sellTradesCount: 0,
    },
    exitedAssets: [],
  });

  const formatUSD = useCallback((val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  const formatCryptoQuantity = useCallback((val: number) => {
    if (val === 0) return "0.00";
    if (val >= 1000) return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (val >= 1) return val.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return val.toLocaleString("en-US", { maximumFractionDigits: 8 });
  }, []);

  // Fetch current spot holdings
  const fetchHoldings = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch("/api/v1/crypto/holdings");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPortfolio(json.data);
      }
    } catch (err) {
      console.warn("Failed to fetch crypto holdings:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Fetch executed trade history & sell analytics
  const fetchTrades = useCallback(async () => {
    try {
      setLoadingTrades(true);
      const res = await fetch("/api/v1/crypto/trades?limit=250");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTradesData({
          trades: json.data.trades || [],
          stats: json.data.stats || {
            totalBuysUsd: 0,
            totalSellsUsd: 0,
            netInvestedUsd: 0,
            totalFeesUsd: 0,
            totalTradesCount: 0,
            buyTradesCount: 0,
            sellTradesCount: 0,
          },
          exitedAssets: json.data.exitedAssets || [],
        });
      }
    } catch (err) {
      console.warn("Failed to fetch crypto trades:", err);
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHoldings(true);
      fetchTrades();
    }
  }, [user, fetchHoldings, fetchTrades]);

  // Sync Binance portfolio and trade history
  const handleSyncBinance = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/crypto/binance/sync", {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        showToast(
          "Binance Sync Failed",
          json.error?.message || "Could not synchronize with Binance.",
          "error"
        );
        return;
      }

      setPortfolio((prev) => ({
        ...prev,
        isBinanceConnected: true,
        lastSyncedAt: json.data.lastSyncedAt || new Date().toISOString(),
        syncError: null,
        totalPortfolioUsd: json.data.totalPortfolioUsd,
        netChange24hUsd: json.data.netChange24hUsd,
        netChange24hPercent: json.data.netChange24hPercent,
        assetsCount: json.data.assetsCount,
        assets: json.data.assets,
      }));

      // Refresh trades and sell analytics immediately after sync
      await fetchTrades();

      showToast(
        "Binance Synced Successfully",
        `Updated ${json.data.assetsCount} spot assets (${formatUSD(json.data.totalPortfolioUsd)}).`,
        "success"
      );

      // Notify dashboard of updated net worth
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("arthax:financial_data_updated"));
      }
    } catch (err) {
      showToast(
        "Sync Error",
        err instanceof Error ? err.message : "Network error during sync",
        "error"
      );
    } finally {
      setSyncing(false);
    }
  };

  // Filtered Assets for Holdings tab
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return portfolio.assets;
    const q = searchQuery.toLowerCase();
    return portfolio.assets.filter(
      (a) => a.asset.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [portfolio.assets, searchQuery]);

  // Filtered Trades for Trade History tab
  const filteredTrades = useMemo(() => {
    let list = tradesData.trades;
    if (tradeSideFilter !== "ALL") {
      list = list.filter((t) => t.side === tradeSideFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.baseAsset.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tradesData.trades, tradeSideFilter, searchQuery]);

  // Donut chart segments
  const chartSegments: DonutSegment[] = useMemo(() => {
    if (!portfolio.assets || portfolio.assets.length === 0) return [];

    const top5 = portfolio.assets.slice(0, 5);
    const others = portfolio.assets.slice(5);

    const segments: DonutSegment[] = top5.map((item, idx) => ({
      label: item.asset,
      value: item.totalValueUsd,
      color: DONUT_COLORS[idx % DONUT_COLORS.length],
      percentage: item.allocationPercent,
      subtitle: formatUSD(item.totalValueUsd),
    }));

    if (others.length > 0) {
      const othersTotal = others.reduce((acc, curr) => acc + curr.totalValueUsd, 0);
      const othersPct = others.reduce((acc, curr) => acc + curr.allocationPercent, 0);
      segments.push({
        label: "Others",
        value: othersTotal,
        color: "#6B7280",
        percentage: othersPct,
        subtitle: formatUSD(othersTotal),
      });
    }

    return segments;
  }, [portfolio.assets, formatUSD]);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Page Header */}
      <PageHeader
        title="Cryptocurrency"
        description="Auto-synced Binance spot portfolio, executed trade history, and realized sell proceeds."
        icon={<Bitcoin size={28} className="text-amber-400" />}
        actions={
          <div className="flex items-center gap-2.5">
            {portfolio.isBinanceConnected && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncBinance}
                disabled={syncing}
                className="gap-2"
              >
                <RefreshCw size={14} className={syncing ? "animate-spin text-amber-400" : ""} />
                <span>{syncing ? "Syncing..." : "Sync Now"}</span>
              </Button>
            )}

            {!portfolio.isBinanceConnected && (
              <Button
                variant="primary"
                size="sm"
                onClick={navigateToBinanceSettings}
                className="gap-2"
              >
                <Key size={14} />
                <span>Connect Binance</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Sync error alert if present */}
      {portfolio.syncError && (
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
            <span>Binance Sync Alert: {portfolio.syncError}</span>
          </div>
          <Button variant="ghost" size="xs" onClick={navigateToBinanceSettings}>
            Re-enter Keys
          </Button>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Portfolio in USD */}
        <StatCard
          label="Total Crypto Net Worth (USD)"
          value={
            loading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              formatUSD(portfolio.totalPortfolioUsd)
            )
          }
          icon={<Wallet size={18} />}
          iconColor="amber"
          subtitle={
            portfolio.lastSyncedAt
              ? `Last synced ${new Date(portfolio.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Not synced yet"
          }
        />

        {/* Card 2: Realized Sells Proceeds */}
        <StatCard
          label="Realized Sells (USD)"
          value={
            loadingTrades ? (
              <Skeleton className="h-8 w-28 rounded-lg" />
            ) : (
              <span className="text-emerald-400 font-bold">
                {formatUSD(tradesData.stats.totalSellsUsd)}
              </span>
            )
          }
          icon={<DollarSign size={18} />}
          iconColor="emerald"
          subtitle={`${tradesData.stats.sellTradesCount} executed sell orders`}
        />

        {/* Card 3: Active Holdings & Exited Assets */}
        <StatCard
          label="Coins & Tokens"
          value={
            loading ? (
              <Skeleton className="h-8 w-16 rounded-lg" />
            ) : (
              `${portfolio.assetsCount} Active · ${tradesData.exitedAssets.length} Exited`
            )
          }
          icon={<Layers size={18} />}
          iconColor="violet"
          subtitle="Non-zero spot wallet holdings"
        />

        {/* Card 4: Exchange Integration */}
        <StatCard
          label="Exchange"
          value="Binance Spot"
          icon={<ShieldCheck size={18} />}
          iconColor="sky"
          subtitle={
            portfolio.isBinanceConnected ? (
              <span className="text-emerald-400 font-medium">Auto-sync active (Read-only)</span>
            ) : (
              <span className="text-amber-400 font-medium">Click Connect to sync</span>
            )
          }
        />
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("holdings")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "holdings"
                ? "bg-[var(--app-accent)] text-black"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-subtle)]"
            }`}
          >
            <PieChart size={14} />
            <span>Holdings ({portfolio.assets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("trades")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "trades"
                ? "bg-[var(--app-accent)] text-black"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-subtle)]"
            }`}
          >
            <History size={14} />
            <span>Trade History ({tradesData.trades.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("exited")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === "exited"
                ? "bg-[var(--app-accent)] text-black"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-subtle)]"
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>Exited Positions ({tradesData.exitedAssets.length})</span>
          </button>
        </div>

        {/* Global Search Input */}
        <div className="relative w-44 sm:w-60">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]"
          />
          <input
            type="text"
            placeholder="Search coin or pair..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-[var(--app-fg)] focus:outline-hidden focus:border-[var(--app-accent)]"
          />
        </div>
      </div>

      {/* VIEW 1: HOLDINGS & PORTFOLIO BREAKDOWN */}
      {activeSubTab === "holdings" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left Column: Holdings Table (7 cols) */}
          <div
            className="lg:col-span-7 rounded-2xl border p-5 sm:p-6 space-y-4"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--app-fg)]">
                  Spot Holdings
                </h2>
                <p className="text-xs text-[var(--app-muted)]">
                  Real-time balances and valuations derived from Binance live tickers
                </p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                  <Bitcoin size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[var(--app-fg)]">
                    {portfolio.isBinanceConnected
                      ? "No spot balances found"
                      : "Connect your Binance Account"}
                  </h3>
                  <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">
                    {portfolio.isBinanceConnected
                      ? "Your Binance spot wallet currently has no non-zero asset balances."
                      : "Provide your read-only Binance API credentials to automatically sync your cryptocurrency portfolio in real time."}
                  </p>
                </div>
                {!portfolio.isBinanceConnected && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={navigateToBinanceSettings}
                    className="gap-2 mt-2"
                  >
                    <Key size={14} />
                    <span>Connect Binance API</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
                      <th className="pb-2.5 font-semibold">Asset</th>
                      <th className="pb-2.5 font-semibold text-right">Holdings</th>
                      <th className="pb-2.5 font-semibold text-right">Price (USD)</th>
                      <th className="pb-2.5 font-semibold text-right">Value (USD)</th>
                      <th className="pb-2.5 font-semibold text-right">24h</th>
                      <th className="pb-2.5 font-semibold text-right">Allocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)]">
                    {filteredAssets.map((asset) => (
                      <tr
                        key={asset.asset}
                        className="hover:bg-[var(--app-card-hover)] transition-colors group"
                      >
                        {/* Asset & Name */}
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold font-mono text-xs flex-shrink-0">
                              {asset.asset.slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[var(--app-fg)] flex items-center gap-1.5">
                                <span>{asset.asset}</span>
                              </div>
                              <div className="text-[11px] text-[var(--app-muted)] truncate max-w-[120px]">
                                {asset.name}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-2 text-right font-mono">
                          <div className="font-semibold text-[var(--app-fg)] tabular-nums">
                            {formatCryptoQuantity(asset.totalQuantity)}
                          </div>
                          {asset.locked > 0 && (
                            <div className="text-[10px] text-[var(--app-muted)]">
                              Locked: {formatCryptoQuantity(asset.locked)}
                            </div>
                          )}
                        </td>

                        {/* Current USD Price */}
                        <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--app-fg)]">
                          {formatUSD(asset.currentPriceUsd)}
                        </td>

                        {/* Total USD Value */}
                        <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-[var(--app-fg)]">
                          {formatUSD(asset.totalValueUsd)}
                        </td>

                        {/* 24h Change */}
                        <td className="py-3 px-2 text-right font-mono tabular-nums">
                          <span
                            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                              asset.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {asset.change24h >= 0 ? (
                              <ArrowUpRight size={12} />
                            ) : (
                              <ArrowDownRight size={12} />
                            )}
                            {asset.change24h >= 0 ? "+" : ""}
                            {asset.change24h.toFixed(2)}%
                          </span>
                        </td>

                        {/* Allocation % */}
                        <td className="py-3 pl-2 text-right font-mono tabular-nums">
                          <div className="font-semibold text-[var(--app-fg)] text-[11px]">
                            {asset.allocationPercent.toFixed(1)}%
                          </div>
                          <div className="w-16 h-1 rounded-full bg-[var(--app-track-bg)] ml-auto mt-1 overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${Math.min(asset.allocationPercent, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Allocation Donut Chart (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div
              className="rounded-2xl border p-5 sm:p-6"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <h2 className="text-base sm:text-lg font-bold text-[var(--app-fg)] mb-2">
                Portfolio Allocation
              </h2>
              <p className="text-xs text-[var(--app-muted)] mb-5">
                Weight distribution of cryptocurrency holdings
              </p>

              <InteractiveDonutChart
                title=""
                totalLabel="Crypto Value (USD)"
                totalValue={portfolio.totalPortfolioUsd}
                segments={chartSegments}
                formatter={formatUSD}
                emptyMessage="No cryptocurrency holdings"
                emptySubMessage="Connect Binance to view your visual coin distribution."
              />
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: EXECUTED TRADE HISTORY */}
      {activeSubTab === "trades" && (
        <div
          className="rounded-2xl border p-5 sm:p-6 space-y-5"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--app-fg)]">
                Executed Trade History
              </h2>
              <p className="text-xs text-[var(--app-muted)]">
                Chronological ledger of Spot BUY and SELL orders synced directly from Binance
              </p>
            </div>

            {/* Side Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-xs">
              <button
                type="button"
                onClick={() => setTradeSideFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  tradeSideFilter === "ALL"
                    ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
                    : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                }`}
              >
                All ({tradesData.trades.length})
              </button>
              <button
                type="button"
                onClick={() => setTradeSideFilter("BUY")}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  tradeSideFilter === "BUY"
                    ? "bg-emerald-500/20 text-emerald-300 font-semibold shadow-xs"
                    : "text-[var(--app-muted)] hover:text-emerald-400"
                }`}
              >
                Buys ({tradesData.stats.buyTradesCount})
              </button>
              <button
                type="button"
                onClick={() => setTradeSideFilter("SELL")}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  tradeSideFilter === "SELL"
                    ? "bg-rose-500/20 text-rose-300 font-semibold shadow-xs"
                    : "text-[var(--app-muted)] hover:text-rose-400"
                }`}
              >
                Sells ({tradesData.stats.sellTradesCount})
              </button>
            </div>
          </div>

          {loadingTrades ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                <History size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[var(--app-fg)]">
                  No trade executions found
                </h3>
                <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">
                  {portfolio.isBinanceConnected
                    ? "Click 'Sync Now' to pull recent spot trade orders from your Binance account."
                    : "Connect your Binance API credentials to track your complete buy and sell execution history."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
                    <th className="pb-2.5 font-semibold">Date & Time</th>
                    <th className="pb-2.5 font-semibold">Pair</th>
                    <th className="pb-2.5 font-semibold">Type</th>
                    <th className="pb-2.5 font-semibold text-right">Price (USD)</th>
                    <th className="pb-2.5 font-semibold text-right">Quantity</th>
                    <th className="pb-2.5 font-semibold text-right">Total Value (USD)</th>
                    <th className="pb-2.5 font-semibold text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border-subtle)]">
                  {filteredTrades.map((trade) => (
                    <tr
                      key={trade.tradeId}
                      className="hover:bg-[var(--app-card-hover)] transition-colors group"
                    >
                      <td className="py-3 pr-3 text-[var(--app-muted)] font-mono text-[11px] whitespace-nowrap">
                        {new Date(trade.executedAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>

                      <td className="py-3 px-2 font-bold font-mono text-[var(--app-fg)]">
                        {trade.symbol}
                      </td>

                      <td className="py-3 px-2">
                        <Badge
                          variant={trade.side === "BUY" ? "emerald" : "rose"}
                          className="font-mono text-[10px] px-2 py-0.5"
                        >
                          {trade.side}
                        </Badge>
                      </td>

                      <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--app-fg)]">
                        {formatUSD(trade.price)}
                      </td>

                      <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--app-fg)]">
                        {formatCryptoQuantity(trade.qty)} {trade.baseAsset}
                      </td>

                      <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-[var(--app-fg)]">
                        {formatUSD(trade.quoteQty)}
                      </td>

                      <td className="py-3 pl-2 text-right font-mono tabular-nums text-[var(--app-muted)] text-[11px]">
                        {trade.commission > 0
                          ? `${trade.commission.toFixed(4)} ${trade.commissionAsset}`
                          : "0.00"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: EXITED POSITIONS & SELL ANALYTICS */}
      {activeSubTab === "exited" && (
        <div className="space-y-6">
          {/* Explanation Alert: What happens after you sell */}
          <div className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-200 text-xs flex items-start gap-3">
            <Info size={18} className="text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sky-100">
                What happens when you sell an asset on Binance?
              </h4>
              <p className="text-sky-200/90 leading-relaxed text-[11px]">
                When you execute a spot sell order on Binance (for example, selling BTC for USDT),
                your coin balance drops to zero and your USD/USDT cash balance increases. Instead of
                disappearing from arthaX, completely sold coins are automatically archived below with
                their total realized USD proceeds, average exit price, and last sell date.
              </p>
            </div>
          </div>

          {/* Exited Holdings Table */}
          <div
            className="rounded-2xl border p-5 sm:p-6 space-y-4"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--app-fg)]">
                  Exited Positions & Closed Coins
                </h2>
                <p className="text-xs text-[var(--app-muted)]">
                  Previously held cryptocurrencies that were fully sold out (current balance: 0.00)
                </p>
              </div>
            </div>

            {loadingTrades ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : tradesData.exitedAssets.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                  <Layers size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[var(--app-fg)]">
                    No completely exited positions
                  </h3>
                  <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">
                    All traded assets currently still have active balances in your Binance spot wallet.
                    When you completely liquidate a coin, it will appear here with realized USD proceeds.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
                      <th className="pb-2.5 font-semibold">Exited Asset</th>
                      <th className="pb-2.5 font-semibold text-right">Total Units Sold</th>
                      <th className="pb-2.5 font-semibold text-right">Average Exit Price</th>
                      <th className="pb-2.5 font-semibold text-right">Realized Proceeds (USD)</th>
                      <th className="pb-2.5 font-semibold text-right">Sell Orders</th>
                      <th className="pb-2.5 font-semibold text-right">Last Exit Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)]">
                    {tradesData.exitedAssets.map((exited) => (
                      <tr
                        key={exited.asset}
                        className="hover:bg-[var(--app-card-hover)] transition-colors group"
                      >
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold font-mono text-xs flex-shrink-0">
                              {exited.asset.slice(0, 3)}
                            </div>
                            <div>
                              <div className="font-bold text-[var(--app-fg)] font-mono">
                                {exited.asset}
                              </div>
                              <div className="text-[10px] text-[var(--app-muted)] font-mono">
                                {exited.symbol}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--app-fg)]">
                          {formatCryptoQuantity(exited.totalSoldQuantity)} {exited.asset}
                        </td>

                        <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--app-fg)]">
                          {formatUSD(exited.averageExitPrice)}
                        </td>

                        <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-emerald-400">
                          {formatUSD(exited.totalRealizedUsd)}
                        </td>

                        <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--app-muted)]">
                          {exited.sellTradesCount} {exited.sellTradesCount === 1 ? "Order" : "Orders"}
                        </td>

                        <td className="py-3 pl-2 text-right font-mono tabular-nums text-[var(--app-muted)] text-[11px]">
                          {new Date(exited.lastSoldAt).toLocaleDateString([], {
                            dateStyle: "medium",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
