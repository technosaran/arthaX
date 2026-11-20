"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bitcoin,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Key,
  Lock,
  Wallet,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  ArrowRightLeft,
  BarChart2,
  Activity,
  Clock,
  Cpu,
  History,
  DollarSign,
  Check,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import InteractiveCandlestickChart from "@/components/charts/InteractiveCandlestickChart";
import CryptoLogo from "@/components/CryptoLogo";
import {
  CalculatedCryptoAsset,
  CalculatedCryptoTrade,
  CryptoTradeStats,
  ExitedCryptoAsset,
  BinanceKline,
  CalculatedMarketDepth,
  BinancePublicTrade,
  calculateCryptoSwap,
  SwapQuoteResult,
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

const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "SUIUSDT",
  "LINKUSDT",
  "NEARUSDT",
];

const SWAP_COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "USDT", "USDC"];

interface CryptoSectionProps {
  onNavigate?: (tab: string) => void;
}

export default function CryptoSection({ onNavigate }: CryptoSectionProps = {}) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Navigation view within CryptoSection
  const [activeView, setActiveView] = useState<
    "holdings" | "markets" | "terminal" | "swap" | "trades" | "exited" | "system"
  >("holdings");

  // Loading & syncing states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [marketFilter, setMarketFilter] = useState<"all" | "gainers" | "losers" | "volume">("all");

  // Terminal states
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [klineInterval, setKlineInterval] = useState("1h");
  const [terminalLoading, setTerminalLoading] = useState(false);

  // Swap converter states
  const [swapFrom, setSwapFrom] = useState("BTC");
  const [swapTo, setSwapTo] = useState("USDT");
  const [swapAmount, setSwapAmount] = useState<string>("0.1");

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
    accountType?: string;
    permissions?: string[];
    commissions?: { maker: number; taker: number; buyer: number; seller: number };
    canTrade?: boolean;
    canWithdraw?: boolean;
    canDeposit?: boolean;
  }>({
    isBinanceConnected: false,
    lastSyncedAt: null,
    syncError: null,
    totalPortfolioUsd: 0,
    netChange24hUsd: 0,
    netChange24hPercent: 0,
    assetsCount: 0,
    assets: [],
    accountType: "SPOT",
    permissions: ["SPOT"],
    commissions: { maker: 0.1, taker: 0.1, buyer: 0, seller: 0 },
    canTrade: false,
    canWithdraw: false,
    canDeposit: false,
  });

  // Market & Terminal data
  const [marketData, setMarketData] = useState<{
    selectedSymbol: {
      symbol: string;
      baseAsset: string;
      quoteAsset: string;
      name: string;
      ticker: any;
      avgPrice: { mins: number; price: number };
      bookTicker: { bidPrice: number; bidQty: number; askPrice: number; askQty: number; spread: number; spreadPercent: number };
      depth: CalculatedMarketDepth;
      klines: BinanceKline[];
      recentTrades: BinancePublicTrade[];
      tradingRules: { minNotionalUsd: number; tickSize: string; stepSize: string };
    } | null;
    marketSummary: {
      totalListedPairs: number;
      activeQuoteAsset: string;
      topGainers: any[];
      topLosers: any[];
      highVolume: any[];
      allTickers: any[];
    } | null;
    systemStatus: {
      status: string;
      statusCode: number;
      msg: string;
      serverTime: number;
      localTime: number;
      clockDriftMs: number;
      rateLimits: { type: string; limit: number; interval: string }[];
    } | null;
  }>({
    selectedSymbol: null,
    marketSummary: null,
    systemStatus: null,
  });

  // Trades state
  const [tradesData, setTradesData] = useState<{
    trades: CalculatedCryptoTrade[];
    stats: CryptoTradeStats;
    exitedAssets: ExitedCryptoAsset[];
    isDemo: boolean;
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
    isDemo: false,
  });

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

  const formatUSD = useCallback((val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  const formatINR = useCallback((valUsd: number) => {
    const inrRate = 86.5; // Estimated USD to INR
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(valUsd * inrRate);
  }, []);

  const formatCryptoQuantity = useCallback((val: number) => {
    if (val === 0) return "0.00";
    if (val >= 1000) return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (val >= 1) return val.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return val.toLocaleString("en-US", { maximumFractionDigits: 8 });
  }, []);

  // Fetch holdings from API
  const fetchHoldings = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const url = "/api/v1/crypto/holdings";
      const res = await fetch(url);
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

  // Fetch Market data
  const fetchMarket = useCallback(async (symbol = selectedSymbol, interval = klineInterval) => {
    try {
      setTerminalLoading(true);
      const url = `/api/v1/crypto/market?symbol=${symbol}&interval=${interval}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Market HTTP error ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMarketData(json.data);
      }
    } catch (err) {
      console.warn("Failed to fetch market data:", err);
    } finally {
      setTerminalLoading(false);
    }
  }, [selectedSymbol, klineInterval]);

  // Fetch Trades data
  const fetchTrades = useCallback(async () => {
    try {
      const url = "/api/v1/crypto/trades";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Trades HTTP error ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTradesData(json.data);
      }
    } catch (err) {
      console.warn("Failed to fetch trades data:", err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHoldings(true);
      fetchMarket(selectedSymbol, klineInterval);
      fetchTrades();
    }
  }, [user, fetchHoldings, fetchMarket, fetchTrades, selectedSymbol, klineInterval]);

  // Sync Binance portfolio
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

      showToast(
        "Binance Synced Successfully",
        `Updated ${json.data.assetsCount} spot assets (${formatUSD(json.data.totalPortfolioUsd)}).`,
        "success"
      );

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

  // Filtered Assets for Portfolio Tab
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return portfolio.assets;
    const q = searchQuery.toLowerCase();
    return portfolio.assets.filter(
      (a) => a.asset.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [portfolio.assets, searchQuery]);

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

  // Filtered Market Tickers for Markets Tab
  const displayedTickers = useMemo(() => {
    if (!marketData.marketSummary) return [];
    let list = marketData.marketSummary.allTickers;

    if (marketFilter === "gainers") {
      list = marketData.marketSummary.topGainers;
    } else if (marketFilter === "losers") {
      list = marketData.marketSummary.topLosers;
    } else if (marketFilter === "volume") {
      list = marketData.marketSummary.highVolume;
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
  }, [marketData.marketSummary, marketFilter, searchQuery]);

  // Swap Quote computation
  const swapQuote: SwapQuoteResult = useMemo(() => {
    const amt = parseFloat(swapAmount) || 0;
    const tickerMap: Record<string, any> = {};

    if (marketData.marketSummary?.allTickers) {
      for (const t of marketData.marketSummary.allTickers) {
        tickerMap[t.symbol] = {
          symbol: t.symbol,
          lastPrice: String(t.lastPrice),
          priceChangePercent: String(t.change24h),
        };
      }
    }

    return calculateCryptoSwap(swapFrom, swapTo, amt, tickerMap);
  }, [swapFrom, swapTo, swapAmount, marketData.marketSummary]);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Page Header */}
      <PageHeader
        title="Binance Sovereign Intelligence"
        description="Comprehensive analysis of all Binance API capabilities: live spot wallets, Level-2 depth, OHLCV klines, public tape, swaps & telemetry."
        icon={<Bitcoin size={28} className="text-amber-400" />}
        actions={
          portfolio.isBinanceConnected ? (
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
          ) : undefined
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

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] overflow-x-auto">
        <button
          onClick={() => setActiveView("holdings")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeView === "holdings"
              ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          <Wallet size={14} className={activeView === "holdings" ? "text-amber-400" : ""} />
          <span>Holdings</span>
        </button>

        <button
          onClick={() => setActiveView("trades")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeView === "trades"
              ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          <History size={14} className={activeView === "trades" ? "text-purple-400" : ""} />
          <span>Trade History</span>
        </button>

        <button
          onClick={() => setActiveView("exited")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeView === "exited"
              ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          <Layers size={14} className={activeView === "exited" ? "text-amber-400" : ""} />
          <span>Exited Positions</span>
        </button>

        <button
          onClick={() => setActiveView("markets")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeView === "markets"
              ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          <BarChart2 size={14} className={activeView === "markets" ? "text-emerald-400" : ""} />
          <span>Live Markets</span>
        </button>

        <button
          onClick={() => setActiveView("terminal")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeView === "terminal"
              ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          <Activity size={14} className={activeView === "terminal" ? "text-sky-400" : ""} />
          <span>Trading Terminal</span>
        </button>

        <button
          onClick={() => setActiveView("swap")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeView === "swap"
              ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          <ArrowRightLeft size={14} className={activeView === "swap" ? "text-indigo-400" : ""} />
          <span>Swap Converter</span>
        </button>

        <button
          onClick={() => setActiveView("system")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            activeView === "system"
              ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          <Cpu size={14} className={activeView === "system" ? "text-rose-400" : ""} />
          <span>Exchange Health</span>
        </button>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Portfolio in USD */}
        <StatCard
          label="Crypto Net Worth (USD)"
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
            portfolio.totalPortfolioUsd > 0
              ? `≈ ${formatINR(portfolio.totalPortfolioUsd)}`
              : "Not synced yet"
          }
        />

        {/* Card 2: 24h P&L */}
        <StatCard
          label="24h Portfolio Return"
          value={
            loading ? (
              <Skeleton className="h-8 w-28 rounded-lg" />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={
                    portfolio.netChange24hUsd >= 0
                      ? "text-emerald-400 font-bold"
                      : "text-rose-400 font-bold"
                  }
                >
                  {portfolio.netChange24hUsd >= 0 ? "+" : ""}
                  {formatUSD(portfolio.netChange24hUsd)}
                </span>
              </div>
            )
          }
          icon={
            portfolio.netChange24hUsd >= 0 ? (
              <TrendingUp size={18} />
            ) : (
              <TrendingDown size={18} />
            )
          }
          iconColor={portfolio.netChange24hUsd >= 0 ? "emerald" : "rose"}
          trend={{
            value: `${portfolio.netChange24hPercent >= 0 ? "+" : ""}${portfolio.netChange24hPercent.toFixed(2)}%`,
            direction: portfolio.netChange24hPercent >= 0 ? "up" : "down",
            label: "24h Return",
          }}
        />

        {/* Card 3: Active Holdings */}
        <StatCard
          label="Spot Assets"
          value={
            loading ? (
              <Skeleton className="h-8 w-16 rounded-lg" />
            ) : (
              `${portfolio.assetsCount} ${portfolio.assetsCount === 1 ? "Asset" : "Assets"}`
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

      {/* ========================================================================= */}
      {/* TAB 1: PORTFOLIO & WALLET */}
      {/* ========================================================================= */}
      {activeView === "holdings" && (
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* Left Column: Holdings Table (7 cols) */}
            <div
              className="lg:col-span-7 rounded-2xl border p-5 sm:p-6 space-y-4"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--app-fg)]">
                    Spot Wallet Balances
                  </h2>
                  <p className="text-xs text-[var(--app-muted)]">
                    Real-time balances & valuations synced via Binance /api/v3/account & 24hr tickers
                  </p>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-56">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]"
                  />
                  <input
                    type="text"
                    placeholder="Search asset..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-[var(--app-fg)] focus:outline-hidden focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>

              {/* Table Container */}
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
                        : "Provide your read-only Binance API credentials to preview all features."}
                    </p>
                  </div>
                  {!portfolio.isBinanceConnected && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={navigateToBinanceSettings}
                        className="gap-2"
                      >
                        <Key size={14} />
                        <span>Connect Binance API</span>
                      </Button>
                    </div>
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
                              <CryptoLogo
                                symbol={asset.asset}
                                name={asset.name}
                                size={32}
                                className="rounded-xl border border-[var(--app-border-subtle)]"
                              />
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

            {/* Right Column: Donut & Account Permissions (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Donut Chart Card */}
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

              {/* Binance Account Metadata & Permissions */}
              <div
                className="rounded-2xl border p-5 sm:p-6 space-y-4"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-sky-400" />
                    <h3 className="text-sm font-bold text-[var(--app-fg)]">
                      Binance Account Telemetry
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    API v3 Account
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] space-y-1">
                    <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">
                      Account Type
                    </div>
                    <div className="font-bold text-[var(--app-fg)]">
                      {portfolio.accountType || "SPOT"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] space-y-1">
                    <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">
                      Trading Status
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <CheckCircle2 size={13} />
                      <span>canTrade: Active</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] space-y-1">
                    <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">
                      Maker / Taker Fee
                    </div>
                    <div className="font-mono font-bold text-[var(--app-fg)]">
                      0.1000% / 0.1000%
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] space-y-1">
                    <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">
                      BNB Fee Discount
                    </div>
                    <div className="font-bold text-amber-400 flex items-center gap-1">
                      <Zap size={12} />
                      <span>25% Enabled</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-[10px] uppercase font-mono text-[var(--app-muted)] mb-2">
                    Enabled Permissions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["SPOT", "LEVERAGED", "MARGIN_READ", "TRD_GRP_002"].map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LIVE 24H MARKETS */}
      {/* ========================================================================= */}
      {activeView === "markets" && (
        <div
          className="rounded-2xl border p-5 sm:p-6 space-y-5"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          {/* Market Navigation Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--app-border)]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--app-fg)] flex items-center gap-2">
                <BarChart2 size={20} className="text-emerald-400" />
                <span>Binance 24h Ticker Board</span>
              </h2>
              <p className="text-xs text-[var(--app-muted)]">
                Live prices, 24h price percentage changes, high/low spread, and trading turnover via /api/v3/ticker/24hr
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category pills */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-xs">
                <button
                  onClick={() => setMarketFilter("all")}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    marketFilter === "all" ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs" : "text-[var(--app-muted)]"
                  }`}
                >
                  All Pairs
                </button>
                <button
                  onClick={() => setMarketFilter("gainers")}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    marketFilter === "gainers" ? "bg-emerald-500/20 text-emerald-400" : "text-[var(--app-muted)]"
                  }`}
                >
                  🔥 Gainers
                </button>
                <button
                  onClick={() => setMarketFilter("losers")}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    marketFilter === "losers" ? "bg-rose-500/20 text-rose-400" : "text-[var(--app-muted)]"
                  }`}
                >
                  🔻 Losers
                </button>
                <button
                  onClick={() => setMarketFilter("volume")}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    marketFilter === "volume" ? "bg-sky-500/20 text-sky-400" : "text-[var(--app-muted)]"
                  }`}
                >
                  💎 High Volume
                </button>
              </div>

              {/* Search */}
              <div className="relative w-44">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                <input
                  type="text"
                  placeholder="Filter ticker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-[var(--app-fg)]"
                />
              </div>
            </div>
          </div>

          {/* Markets Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
                  <th className="pb-3 font-semibold">Pair</th>
                  <th className="pb-3 font-semibold text-right">Last Price</th>
                  <th className="pb-3 font-semibold text-right">24h Change</th>
                  <th className="pb-3 font-semibold text-right">24h High</th>
                  <th className="pb-3 font-semibold text-right">24h Low</th>
                  <th className="pb-3 font-semibold text-right">24h Volume (USDT)</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border-subtle)]">
                {displayedTickers.map((t) => (
                  <tr key={t.symbol} className="hover:bg-[var(--app-card-hover)] transition-colors group">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2.5">
                        <CryptoLogo
                          symbol={t.baseAsset || t.symbol}
                          name={t.name}
                          size={28}
                          className="rounded-lg border border-[var(--app-border-subtle)]"
                        />
                        <div>
                          <div className="font-bold text-[var(--app-fg)]">{t.symbol}</div>
                          <div className="text-[10px] text-[var(--app-muted)]">{t.name}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-2 text-right font-mono font-bold text-[var(--app-fg)] tabular-nums">
                      ${t.lastPrice >= 1 ? t.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }) : t.lastPrice.toFixed(4)}
                    </td>

                    <td className="py-3 px-2 text-right font-mono tabular-nums">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          t.change24h >= 0
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {t.change24h >= 0 ? "+" : ""}
                        {t.change24h.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3 px-2 text-right font-mono text-[var(--app-muted)] tabular-nums">
                      ${t.high24h >= 1 ? t.high24h.toLocaleString("en-US", { maximumFractionDigits: 2 }) : t.high24h.toFixed(4)}
                    </td>

                    <td className="py-3 px-2 text-right font-mono text-[var(--app-muted)] tabular-nums">
                      ${t.low24h >= 1 ? t.low24h.toLocaleString("en-US", { maximumFractionDigits: 2 }) : t.low24h.toFixed(4)}
                    </td>

                    <td className="py-3 px-2 text-right font-mono text-[var(--app-fg)] tabular-nums">
                      ${t.quoteVolumeUsd >= 1000000000
                        ? `${(t.quoteVolumeUsd / 1000000000).toFixed(2)}B`
                        : `${(t.quoteVolumeUsd / 1000000).toFixed(2)}M`}
                    </td>

                    <td className="py-3 pl-2 text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setSelectedSymbol(t.symbol);
                          setActiveView("terminal");
                        }}
                        className="gap-1 text-xs"
                      >
                        <span>Terminal</span>
                        <ChevronRight size={12} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TRADING TERMINAL (CANDLESTICKS, DEPTH & TAPE) */}
      {/* ========================================================================= */}
      {activeView === "terminal" && (
        <div className="space-y-6">
          {/* Symbol Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {POPULAR_SYMBOLS.map((sym) => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap ${
                  selectedSymbol === sym
                    ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                    : "bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                }`}
              >
                {sym.replace("USDT", "")}/USDT
              </button>
            ))}
          </div>

          {/* Terminal Banner / Header */}
          <div
            className="rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <CryptoLogo
                symbol={selectedSymbol.replace("USDT", "")}
                name={marketData.selectedSymbol?.name}
                size={40}
                className="rounded-xl border border-[var(--app-border-subtle)]"
              />
              <div>
                <div className="text-base sm:text-lg font-bold text-[var(--app-fg)] flex items-center gap-2">
                  <span>{selectedSymbol}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Binance Spot
                  </Badge>
                </div>
                <div className="text-xs text-[var(--app-muted)]">
                  {marketData.selectedSymbol?.name || "Cryptocurrency"}
                </div>
              </div>
            </div>

            {/* Price & Rolling Stats */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
              <div>
                <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">Last Price</div>
                <div className="text-base sm:text-lg font-bold font-mono text-[var(--app-fg)]">
                  ${parseFloat(marketData.selectedSymbol?.ticker?.lastPrice || "96420.5").toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">24h Change</div>
                <div
                  className={`font-mono font-bold ${
                    parseFloat(marketData.selectedSymbol?.ticker?.priceChangePercent || "0") >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {parseFloat(marketData.selectedSymbol?.ticker?.priceChangePercent || "0") >= 0 ? "+" : ""}
                  {parseFloat(marketData.selectedSymbol?.ticker?.priceChangePercent || "0").toFixed(2)}%
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">24h High / Low</div>
                <div className="font-mono text-[var(--app-fg)]">
                  <span className="text-emerald-400">${parseFloat(marketData.selectedSymbol?.ticker?.highPrice || "0").toLocaleString()}</span>
                  <span className="mx-1 text-[var(--app-muted)]">/</span>
                  <span className="text-rose-400">${parseFloat(marketData.selectedSymbol?.ticker?.lowPrice || "0").toLocaleString()}</span>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">5m Avg Price (VWAP)</div>
                <div className="font-mono text-sky-400 font-semibold">
                  ${(marketData.selectedSymbol?.avgPrice?.price || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Candlestick Chart with Interval Selector */}
          <div
            className="rounded-2xl border p-4 sm:p-5 space-y-4"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-[var(--app-fg)]">
                  Binance OHLCV Candlestick Feed
                </h3>
              </div>

              {/* Intervals */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-[11px] font-mono">
                {["15m", "1h", "4h", "1d", "1w"].map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setKlineInterval(iv)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      klineInterval === iv
                        ? "bg-amber-400 text-black"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    {iv.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <InteractiveCandlestickChart
              klines={marketData.selectedSymbol?.klines || []}
              symbol={selectedSymbol}
              height={310}
            />
          </div>

          {/* Lower Terminal: L2 Order Book Depth & Public Trade Flow */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* L2 Order Book Depth (7 cols) */}
            <div
              className="lg:col-span-7 rounded-2xl border p-4 sm:p-5 space-y-4"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
                <div>
                  <h3 className="text-sm font-bold text-[var(--app-fg)]">
                    Level-2 Order Book & Depth Ladder
                  </h3>
                  <p className="text-[11px] text-[var(--app-muted)]">
                    Real-time market liquidity via /api/v3/depth
                  </p>
                </div>

                {/* Spread & Ratio */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Spread: ${marketData.selectedSymbol?.depth?.spread || 0} ({marketData.selectedSymbol?.depth?.spreadPercent || 0}%)
                  </span>
                </div>
              </div>

              {/* Depth Ratio Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--app-muted)]">
                  <span className="text-emerald-400 font-semibold">
                    Buyers: {marketData.selectedSymbol?.depth?.bidAskRatio || 50}%
                  </span>
                  <span className="text-rose-400 font-semibold">
                    Sellers: {(100 - (marketData.selectedSymbol?.depth?.bidAskRatio || 50)).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-rose-500/30 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${marketData.selectedSymbol?.depth?.bidAskRatio || 50}%` }}
                  />
                </div>
              </div>

              {/* Order Book Grid (Bids vs Asks) */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                {/* Bids (Green) */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase text-emerald-400 font-semibold flex justify-between pb-1 border-b border-[var(--app-border-subtle)]">
                    <span>Bid Price ($)</span>
                    <span>Qty</span>
                  </div>
                  {(marketData.selectedSymbol?.depth?.bids || []).slice(0, 10).map((b, i) => (
                    <div
                      key={`bid-${i}`}
                      className="relative flex items-center justify-between py-0.5 px-1 rounded overflow-hidden"
                    >
                      <div
                        className="absolute inset-y-0 right-0 bg-emerald-500/15 pointer-events-none"
                        style={{
                          width: `${Math.min(100, (b.quantity / (marketData.selectedSymbol?.depth?.totalBidVolume || 1)) * 300)}%`,
                        }}
                      />
                      <span className="text-emerald-400 font-bold tabular-nums z-10">
                        ${b.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[var(--app-fg)] tabular-nums z-10">{b.quantity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>

                {/* Asks (Red) */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase text-rose-400 font-semibold flex justify-between pb-1 border-b border-[var(--app-border-subtle)]">
                    <span>Ask Price ($)</span>
                    <span>Qty</span>
                  </div>
                  {(marketData.selectedSymbol?.depth?.asks || []).slice(0, 10).map((a, i) => (
                    <div
                      key={`ask-${i}`}
                      className="relative flex items-center justify-between py-0.5 px-1 rounded overflow-hidden"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-rose-500/15 pointer-events-none"
                        style={{
                          width: `${Math.min(100, (a.quantity / (marketData.selectedSymbol?.depth?.totalAskVolume || 1)) * 300)}%`,
                        }}
                      />
                      <span className="text-rose-400 font-bold tabular-nums z-10">
                        ${a.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[var(--app-fg)] tabular-nums z-10">{a.quantity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Public Recent Trades Flow (5 cols) */}
            <div
              className="lg:col-span-5 rounded-2xl border p-4 sm:p-5 space-y-4"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="pb-3 border-b border-[var(--app-border)]">
                <h3 className="text-sm font-bold text-[var(--app-fg)]">
                  Live Public Market Tape
                </h3>
                <p className="text-[11px] text-[var(--app-muted)]">
                  Executed trades stream via /api/v3/trades
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-[10px] uppercase text-[var(--app-muted)] border-b border-[var(--app-border-subtle)]">
                      <th className="pb-2 text-left font-semibold">Price ($)</th>
                      <th className="pb-2 text-right font-semibold">Qty</th>
                      <th className="pb-2 text-right font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)]">
                    {(marketData.selectedSymbol?.recentTrades || []).slice(0, 12).map((tr) => (
                      <tr key={tr.id} className="py-1">
                        <td
                          className={`py-1.5 font-bold tabular-nums ${
                            tr.isBuyerMaker ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          ${tr.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 text-right text-[var(--app-fg)] tabular-nums">
                          {tr.qty.toFixed(4)}
                        </td>
                        <td className="py-1.5 text-right text-[var(--app-muted)] text-[11px] tabular-nums">
                          {new Date(tr.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SWAP CONVERTER */}
      {/* ========================================================================= */}
      {activeView === "swap" && (
        <div className="max-w-xl mx-auto space-y-6">
          <div
            className="rounded-2xl border p-6 space-y-6"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div>
              <h2 className="text-lg font-bold text-[var(--app-fg)] flex items-center gap-2">
                <ArrowRightLeft size={20} className="text-indigo-400" />
                <span>Instant Binance Swap Estimator</span>
              </h2>
              <p className="text-xs text-[var(--app-muted)]">
                Compute live exchange values and 0.1% spot fees directly from Binance order books
              </p>
            </div>

            {/* Input "You Pay" */}
            <div className="space-y-2 p-4 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)]">
              <div className="flex items-center justify-between text-xs text-[var(--app-muted)]">
                <span>You Pay</span>
                <span>Select Asset</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="any"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent text-xl font-bold font-mono text-[var(--app-fg)] focus:outline-hidden"
                />
                <select
                  value={swapFrom}
                  onChange={(e) => setSwapFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-xs font-mono font-bold text-[var(--app-fg)]"
                >
                  {SWAP_COINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex items-center gap-2 pt-2">
                {["0.05", "0.1", "0.5", "1.0", "5.0"].map((quick) => (
                  <button
                    key={quick}
                    onClick={() => setSwapAmount(quick)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--app-card)] text-[var(--app-muted)] hover:text-[var(--app-fg)] border border-[var(--app-border-subtle)]"
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>

            {/* Flip Button */}
            <div className="flex justify-center -my-2">
              <button
                onClick={() => {
                  const prevFrom = swapFrom;
                  setSwapFrom(swapTo);
                  setSwapTo(prevFrom);
                }}
                className="w-9 h-9 rounded-full bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-fg)] flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
              >
                <ArrowRightLeft size={14} />
              </button>
            </div>

            {/* Output "You Receive" */}
            <div className="space-y-2 p-4 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)]">
              <div className="flex items-center justify-between text-xs text-[var(--app-muted)]">
                <span>You Receive (Estimated)</span>
                <span>Target Asset</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-full text-xl font-bold font-mono text-emerald-400">
                  {swapQuote.toAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                </div>
                <select
                  value={swapTo}
                  onChange={(e) => setSwapTo(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-xs font-mono font-bold text-[var(--app-fg)]"
                >
                  {SWAP_COINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conversion Details */}
            <div className="space-y-2 p-4 rounded-xl border border-[var(--app-border-subtle)] text-xs font-mono">
              <div className="flex items-center justify-between text-[var(--app-muted)]">
                <span>Exchange Rate:</span>
                <span className="font-semibold text-[var(--app-fg)]">
                  1 {swapFrom} = {swapQuote.executionPrice} {swapTo}
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--app-muted)]">
                <span>Inverse Rate:</span>
                <span className="font-semibold text-[var(--app-fg)]">
                  1 {swapTo} = {swapQuote.invertedPrice} {swapFrom}
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--app-muted)]">
                <span>Binance 0.1% Spot Fee:</span>
                <span className="text-amber-400">${swapQuote.estimatedFeeUsd}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--app-muted)]">
                <span>Routing:</span>
                <span className="text-sky-400">{swapQuote.route}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: TRADE HISTORY & EXITED ASSETS */}
      {/* ========================================================================= */}
      {(activeView === "trades" || activeView === "exited") && (
        <div className="space-y-6">
          {/* Trade Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Capital Deployed"
              value={formatUSD(tradesData.stats.totalBuysUsd)}
              icon={<DollarSign size={18} />}
              iconColor="emerald"
              subtitle={`${tradesData.stats.buyTradesCount} Buy Executions`}
            />

            <StatCard
              label="Total Realized Proceeds"
              value={formatUSD(tradesData.stats.totalSellsUsd)}
              icon={<TrendingUp size={18} />}
              iconColor="sky"
              subtitle={`${tradesData.stats.sellTradesCount} Sell Executions`}
            />

            <StatCard
              label="Net Cashflow"
              value={
                <span className={tradesData.stats.netInvestedUsd <= 0 ? "text-emerald-400" : "text-amber-400"}>
                  {formatUSD(tradesData.stats.netInvestedUsd)}
                </span>
              }
              icon={<ArrowRightLeft size={18} />}
              iconColor="violet"
              subtitle="Capital inflow vs outflow"
            />

            <StatCard
              label="Total Fees Paid"
              value={`$${tradesData.stats.totalFeesUsd}`}
              icon={<ShieldCheck size={18} />}
              iconColor="rose"
              subtitle="Binance trading commissions"
            />
          </div>

          {/* Trade Executions Table */}
          <div
            className="rounded-2xl border p-5 sm:p-6 space-y-4"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--app-fg)]">
                  Executed Trade History
                </h3>
                <p className="text-xs text-[var(--app-muted)]">
                  Execution log retrieved from Binance /api/v3/myTrades
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {tradesData.trades.length} Records
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border)]">
                    <th className="pb-3 font-semibold">Trade ID</th>
                    <th className="pb-3 font-semibold">Pair</th>
                    <th className="pb-3 font-semibold">Side</th>
                    <th className="pb-3 font-semibold text-right">Price ($)</th>
                    <th className="pb-3 font-semibold text-right">Quantity</th>
                    <th className="pb-3 font-semibold text-right">Total ($)</th>
                    <th className="pb-3 font-semibold text-right">Fee</th>
                    <th className="pb-3 font-semibold text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border-subtle)] font-mono">
                  {tradesData.trades.map((t) => (
                    <tr key={t.tradeId} className="hover:bg-[var(--app-card-hover)] transition-colors">
                      <td className="py-3 text-[var(--app-muted)]">#{t.tradeId}</td>
                      <td className="py-3 font-bold text-[var(--app-fg)]">
                        <div className="flex items-center gap-2">
                          <CryptoLogo symbol={t.symbol.replace(/USDT|USDC|BUSD|FDUSD|BTC$/, "")} size={20} className="rounded-md" />
                          <span>{t.symbol}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.side === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {t.side === "BUY" ? "BUY" : "SELL"}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[var(--app-fg)] tabular-nums">
                        ${t.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right text-[var(--app-fg)] tabular-nums">
                        {t.qty.toFixed(4)}
                      </td>
                      <td className="py-3 text-right font-bold text-[var(--app-fg)] tabular-nums">
                        ${t.quoteQty.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right text-amber-400 tabular-nums">
                        {t.commission} {t.commissionAsset}
                      </td>
                      <td className="py-3 text-right text-[var(--app-muted)] text-[11px]">
                        {new Date(t.executedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exited Assets / Realized Sales Ledger */}
          {tradesData.exitedAssets.length > 0 && (
            <div
              className="rounded-2xl border p-5 sm:p-6 space-y-4"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="pb-3 border-b border-[var(--app-border)]">
                <h3 className="text-base font-bold text-[var(--app-fg)]">
                  Exited / Fully Sold Assets
                </h3>
                <p className="text-xs text-[var(--app-muted)]">
                  Positions where all tokens were sold out to zero
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-[10px] uppercase text-[var(--app-muted)] border-b border-[var(--app-border)]">
                      <th className="pb-2 font-semibold">Asset</th>
                      <th className="pb-2 font-semibold text-right">Quantity Sold</th>
                      <th className="pb-2 font-semibold text-right">Avg Exit Price</th>
                      <th className="pb-2 font-semibold text-right">Total Realized ($)</th>
                      <th className="pb-2 font-semibold text-right">Last Exit Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)]">
                    {tradesData.exitedAssets.map((ex) => (
                      <tr key={ex.asset} className="hover:bg-[var(--app-card-hover)] transition-colors">
                        <td className="py-3 font-bold text-[var(--app-fg)]">
                          <div className="flex items-center gap-2">
                            <CryptoLogo symbol={ex.asset} size={24} className="rounded-lg" />
                            <span>{ex.asset}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right tabular-nums">{ex.totalSoldQuantity}</td>
                        <td className="py-3 text-right tabular-nums">${ex.averageExitPrice.toLocaleString()}</td>
                        <td className="py-3 text-right font-bold text-emerald-400 tabular-nums">
                          ${ex.totalRealizedUsd.toLocaleString()}
                        </td>
                        <td className="py-3 text-right text-[var(--app-muted)]">
                          {new Date(ex.lastSoldAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: EXCHANGE HEALTH & SYSTEM STATUS */}
      {/* ========================================================================= */}
      {activeView === "system" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="System Health"
              value={marketData.systemStatus?.status || "Operational"}
              icon={<ShieldCheck size={18} />}
              iconColor="emerald"
              subtitle="Binance Core Matching Engine"
            />

            <StatCard
              label="Clock Drift"
              value={`${marketData.systemStatus?.clockDriftMs || 0} ms`}
              icon={<Clock size={18} />}
              iconColor="sky"
              subtitle="Local vs Server Time synchronization"
            />

            <StatCard
              label="Rate Limit Tier"
              value="6,000 W/min"
              icon={<Cpu size={18} />}
              iconColor="amber"
              subtitle="IP Request Weight capacity"
            />
          </div>

          <div
            className="rounded-2xl border p-5 sm:p-6 space-y-4"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="pb-3 border-b border-[var(--app-border)]">
              <h3 className="text-base font-bold text-[var(--app-fg)]">
                Active Symbol Trading Filters & Rules ({selectedSymbol})
              </h3>
              <p className="text-xs text-[var(--app-muted)]">
                Precision specifications and lot requirements via /api/v3/exchangeInfo
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1.5">
                <div className="text-[10px] uppercase text-[var(--app-muted)]">PRICE_FILTER (Tick Size)</div>
                <div className="text-sm font-bold text-[var(--app-fg)]">
                  {marketData.selectedSymbol?.tradingRules?.tickSize || "0.01"}
                </div>
                <div className="text-[10px] text-[var(--app-muted)]">
                  Minimum price movement increments
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1.5">
                <div className="text-[10px] uppercase text-[var(--app-muted)]">LOT_SIZE (Step Size)</div>
                <div className="text-sm font-bold text-[var(--app-fg)]">
                  {marketData.selectedSymbol?.tradingRules?.stepSize || "0.00001"}
                </div>
                <div className="text-[10px] text-[var(--app-muted)]">
                  Minimum order quantity granularity
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)] space-y-1.5">
                <div className="text-[10px] uppercase text-[var(--app-muted)]">MIN_NOTIONAL</div>
                <div className="text-sm font-bold text-emerald-400">
                  ${marketData.selectedSymbol?.tradingRules?.minNotionalUsd || 5.0} USDT
                </div>
                <div className="text-[10px] text-[var(--app-muted)]">
                  Minimum acceptable trade value
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
