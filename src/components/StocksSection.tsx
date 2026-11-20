"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Search,
  ExternalLink,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Layers,
  History,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRightLeft,
  X,
  Target,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Activity,
  BarChart3,
  List,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import BankLogo from "@/components/BankLogo";
import EntityLogo from "@/components/EntityLogo";

export interface StockHolding {
  id: string;
  user_id: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  company_name: string;
  sector: string;
  quantity: number;
  avg_buy_price: number;
  currency: string;
  account_id: string | null;
  notes: string | null;
  target_price: number | null;
  stop_loss: number | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransaction {
  id: string;
  user_id: string;
  holding_id: string;
  symbol: string;
  exchange: "NSE" | "BSE";
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  brokerage_charges: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export interface StockQuote {
  symbol: string;
  exchange: "NSE" | "BSE";
  companyName: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  currency: "INR";
  lastUpdated: string;
  isStale?: boolean;
}

export interface MarketStatus {
  isOpen: boolean;
  phase: "LIVE" | "PRE_MARKET" | "POST_MARKET" | "CLOSED_WEEKEND" | "CLOSED";
  message: string;
  istTime: string;
}

const SECTOR_OPTIONS = [
  "IT Services",
  "Banking & Finance",
  "Energy & Power",
  "Automobile",
  "FMCG & Consumer",
  "Healthcare & Pharma",
  "Metals & Mining",
  "Infrastructure & Construction",
  "Telecommunications",
  "Chemicals",
  "Capital Markets & Fintech",
  "Other",
];

const SECTOR_COLORS: Record<string, string> = {
  "IT Services": "#38bdf8", // Sky blue
  "Banking & Finance": "#34d399", // Emerald
  "Energy & Power": "#f59e0b", // Amber
  "Automobile": "#f43f5e", // Rose
  "FMCG & Consumer": "#a855f7", // Purple
  "Healthcare & Pharma": "#ec4899", // Pink
  "Metals & Mining": "#64748b", // Slate
  "Infrastructure & Construction": "#d97706", // Orange
  "Telecommunications": "#06b6d4", // Cyan
  "Chemicals": "#84cc16", // Lime
  "Capital Markets & Fintech": "#6366f1", // Indigo
  "Other": "#94a3b8", // Muted
};

export default function StocksSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Holdings & Quotes State
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string; balance?: number }[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<boolean>(false);
  const autoSyncedRef = useRef<boolean>(false);
  const holdingsRef = useRef<StockHolding[]>(holdings);

  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);
  const [refreshingQuotes, setRefreshingQuotes] = useState(false);
  const [syncingZerodha, setSyncingZerodha] = useState(false);
  const [viewTab, setViewTab] = useState<string>("holdings");
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "profit" | "loss" | "gainers">("all");
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"value_desc" | "pnl_desc" | "pnl_asc" | "day_desc" | "symbol_asc">(
    "value_desc"
  );

  // Formatters
  const formatINR = useCallback((val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  const formatNumber = useCallback((val: number, maxDigits = 2) => {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: maxDigits,
    }).format(val);
  }, []);

  // Fetch real Indian market quotes from /api/v1/stocks/quote
  const fetchQuotesForHoldings = useCallback(async (list: StockHolding[], force = false) => {
    if (list.length === 0) return;
    try {
      setRefreshingQuotes(true);
      const symbolParams = list.map((h) => `${h.symbol}:${h.exchange}`).join(",");
      const url = `/api/v1/stocks/quote?symbols=${encodeURIComponent(symbolParams)}${
        force ? "&refresh=true" : ""
      }`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.quotes) {
          setQuotes((prev) => ({ ...prev, ...data.quotes }));
        }
        if (data.marketStatus) {
          setMarketStatus(data.marketStatus);
        }
        if (force) {
          showToast("Quotes Updated", "Latest Indian stock market prices refreshed successfully.", "success");
        }
      }
    } catch (err) {
      console.error("[Stocks] Error updating quotes:", err);
      if (force) {
        showToast("Quote Refresh Failed", "Could not fetch latest market prices from NSE/BSE.", "error");
      }
    } finally {
      setRefreshingQuotes(false);
    }
  }, [showToast]);

  // Fetch initial data: holdings, transactions, accounts
  const fetchData = useCallback(async () => {
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (holdingsRef.current.length === 0) {
        setLoading(true);
      }
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const [holdingsRes, accountsRes] = await Promise.all([
        fetch("/api/v1/stocks/holdings", { headers }),
        supabase.from("accounts").select("id, name, type, balance").order("name", { ascending: true }),
      ]);

      if (accountsRes.data) {
        setAccounts(accountsRes.data);
      }

      if (holdingsRes.ok) {
        const json = await holdingsRes.json();
        const holdingsData: StockHolding[] = json.holdings || [];
        setHoldings(holdingsData);
        setTransactions(json.transactions || []);

        // Immediately fetch live quotes for all holdings
        if (holdingsData.length > 0) {
          fetchQuotesForHoldings(holdingsData, false);
        }
      }
    } catch (err) {
      console.error("[Stocks] Error loading holdings:", err);
      showToast("Portfolio Load Failed", "Failed to load stock portfolio data. Please check connection.", "error");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [user, supabase, showToast, fetchQuotesForHoldings]);

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

  // Sync holdings directly from Zerodha Kite API
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
          "Failed to sync Zerodha portfolio";
        throw new Error(errorMsg);
      }
      const count = json.data?.stocksSynced ?? 0;
      const wallet = json.data?.walletBalance;
      showToast(
        "Zerodha Synced!",
        count > 0
          ? `Successfully synced ${count} stocks from Zerodha Kite.`
          : `Zerodha sync completed! Wallet balance: ₹${wallet ?? 0}. No active stock holdings in Zerodha DEMAT.`,
        "success"
      );
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync Zerodha stocks";
      showToast("Zerodha Sync Failed", msg, "error");
    } finally {
      setSyncingZerodha(false);
    }
  };

  // Portfolio Calculations
  const portfolioStats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalDayChange = 0;
    let profitableCount = 0;
    let lossCount = 0;

    const enriched = [];
    for (const h of holdings) {
      const quoteKey = `${h.symbol}:${h.exchange}`;
      const quote = quotes[quoteKey];

      const qty = Number(h.quantity) || 0;
      const avgPrice = Number(h.avg_buy_price) || 0;
      const invested = qty * avgPrice;

      // Current Price fallback to avgPrice if quote not loaded yet
      const ltp = quote && quote.currentPrice > 0 ? quote.currentPrice : avgPrice;
      const currentValue = qty * ltp;
      const pnl = currentValue - invested;
      const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

      const dayChangePerShare = quote?.change || 0;
      const dayChangePercent = quote?.changePercent || 0;
      const dayTotalChange = qty * dayChangePerShare;

      totalInvested += invested;
      totalCurrentValue += currentValue;
      totalDayChange += dayTotalChange;

      if (pnl >= 0) profitableCount++;
      else lossCount++;

      enriched.push({
        ...h,
        qty,
        avgPrice,
        invested,
        ltp,
        currentValue,
        pnl,
        pnlPercent,
        dayChangePerShare,
        dayChangePercent,
        dayTotalChange,
        quote,
      });
    }

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const dayChangePercent = totalInvested > 0 ? (totalDayChange / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalPnL,
      totalPnLPercent,
      totalDayChange,
      dayChangePercent,
      profitableCount,
      lossCount,
      enrichedHoldings: enriched,
    };
  }, [holdings, quotes]);

  // Filtered & Sorted Holdings
  const displayedHoldings = useMemo(() => {
    let list = [...portfolioStats.enrichedHoldings];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.company_name.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q)
      );
    }

    // Profit / Loss / Gainer filter
    if (filterType === "profit") {
      list = list.filter((item) => item.pnl > 0);
    } else if (filterType === "loss") {
      list = list.filter((item) => item.pnl < 0);
    } else if (filterType === "gainers") {
      list = list.filter((item) => item.dayChangePercent > 0);
    }

    // Sector filter
    if (selectedSector !== "all") {
      list = list.filter((item) => item.sector === selectedSector);
    }

    // Sort order
    list.sort((a, b) => {
      switch (sortBy) {
        case "value_desc":
          return b.currentValue - a.currentValue;
        case "pnl_desc":
          return b.pnlPercent - a.pnlPercent;
        case "pnl_asc":
          return a.pnlPercent - b.pnlPercent;
        case "day_desc":
          return b.dayChangePercent - a.dayChangePercent;
        case "symbol_asc":
          return a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });

    return list;
  }, [portfolioStats.enrichedHoldings, searchQuery, filterType, selectedSector, sortBy]);

  // Sector breakdown segments for InteractiveDonutChart
  const sectorSegments: DonutSegment[] = useMemo(() => {
    const sectorTotals: Record<string, number> = {};

    for (const h of portfolioStats.enrichedHoldings) {
      const sec = h.sector || "Other";
      sectorTotals[sec] = (sectorTotals[sec] || 0) + h.currentValue;
    }

    const totalVal = portfolioStats.totalCurrentValue;

    return Object.entries(sectorTotals)
      .map(([sec, val]) => ({
        label: sec,
        value: val,
        color: SECTOR_COLORS[sec] || "#38bdf8",
        percentage: totalVal > 0 ? (val / totalVal) * 100 : 0,
        subtitle: formatINR(val),
      }))
      .sort((a, b) => b.value - a.value);
  }, [portfolioStats.enrichedHoldings, portfolioStats.totalCurrentValue, formatINR]);

  // Stock weight allocation segments
  const stockWeightSegments: DonutSegment[] = useMemo(() => {
    const totalVal = portfolioStats.totalCurrentValue;
    return portfolioStats.enrichedHoldings
      .map((h, i) => {
        const palette = [
          "#38bdf8",
          "#34d399",
          "#f59e0b",
          "#a855f7",
          "#f43f5e",
          "#ec4899",
          "#06b6d4",
          "#84cc16",
          "#6366f1",
          "#eab308",
        ];
        return {
          label: h.symbol,
          value: h.currentValue,
          color: palette[i % palette.length],
          percentage: totalVal > 0 ? (h.currentValue / totalVal) * 100 : 0,
          subtitle: `${h.qty} shares • ${formatINR(h.currentValue)}`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [portfolioStats.enrichedHoldings, portfolioStats.totalCurrentValue, formatINR]);

  // Deep Links for Zerodha Kite
  const getKiteChartUrl = (symbol: string, exchange = "NSE") => {
    return `https://kite.zerodha.com/chart/ext/ciq/${exchange}/${encodeURIComponent(symbol)}`;
  };

  const getTradingViewUrl = (symbol: string, exchange = "NSE") => {
    return `https://in.tradingview.com/chart/?symbol=${exchange}:${encodeURIComponent(symbol)}`;
  };

  const zerodhaAccount = useMemo(() => {
    return accounts.find(
      (a) =>
        a.name.toLowerCase().includes("zerodha") ||
        a.name.toLowerCase().includes("kite") ||
        a.type.toUpperCase() === "INVESTMENT"
    );
  }, [accounts]);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* SECTION HEADER WITH LIVE ZERODHA STATUS */}
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <TrendingUp className="text-emerald-400" size={26} />
            <span>Stocks & Equities Portfolio</span>
          </span>
        }
        description="Indian markets (NSE & BSE) portfolio with real-time price updates auto-synced from Zerodha Kite"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw size={13} className={syncingZerodha ? "animate-spin" : ""} />}
              disabled={syncingZerodha}
              onClick={handleSyncZerodha}
              title="Sync Zerodha Demat holdings and margins"
            >
              {syncingZerodha ? "Syncing Zerodha..." : "Sync Zerodha"}
            </Button>
          </div>
        }
      />

      {/* TOP PORTFOLIO STATS (ZERODHA KITE STYLE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Invested */}
        <StatCard
          label="Total Invested"
          value={loading ? <Skeleton className="h-8 w-32 rounded-lg" /> : formatINR(portfolioStats.totalInvested)}
          subtitle={`${holdings.length} stocks across NSE & BSE`}
          icon={<Layers className="text-sky-400" size={18} />}
        />

        {/* Current Portfolio Value */}
        <StatCard
          label="Current Portfolio Value"
          value={
            loading ? (
              <Skeleton className="h-8 w-36 rounded-lg" />
            ) : (
              <span className="text-[var(--app-fg)] font-bold">
                {formatINR(portfolioStats.totalCurrentValue)}
              </span>
            )
          }
          subtitle={
            portfolioStats.totalInvested > 0
              ? `${portfolioStats.totalCurrentValue >= portfolioStats.totalInvested ? "+" : ""}${formatINR(
                  portfolioStats.totalPnL
                )} total delta`
              : "No stock positions yet"
          }
          icon={<BarChart3 className="text-emerald-400" size={18} />}
        />

        {/* Total Overall P&L */}
        <StatCard
          label="Overall Returns (P&L)"
          value={
            loading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span
                className={`font-mono font-bold ${
                  portfolioStats.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {portfolioStats.totalPnL >= 0 ? "+" : ""}
                {formatINR(portfolioStats.totalPnL)}
              </span>
            )
          }
          subtitle={
            <span
              className={`font-semibold ${
                portfolioStats.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {portfolioStats.totalPnL >= 0 ? "+" : ""}
              {portfolioStats.totalPnLPercent.toFixed(2)}% absolute return
            </span>
          }
          icon={
            portfolioStats.totalPnL >= 0 ? (
              <TrendingUp className="text-emerald-400" size={18} />
            ) : (
              <TrendingDown className="text-rose-400" size={18} />
            )
          }
        />

        {/* Today's P&L */}
        <StatCard
          label="Day's P&L (Today)"
          value={
            loading ? (
              <Skeleton className="h-8 w-32 rounded-lg" />
            ) : (
              <span
                className={`font-mono font-bold ${
                  portfolioStats.totalDayChange >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {portfolioStats.totalDayChange >= 0 ? "+" : ""}
                {formatINR(portfolioStats.totalDayChange)}
              </span>
            )
          }
          subtitle={
            <span
              className={`font-semibold ${
                portfolioStats.totalDayChange >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {portfolioStats.totalDayChange >= 0 ? "+" : ""}
              {portfolioStats.dayChangePercent.toFixed(2)}% vs Prev Close
            </span>
          }
          icon={
            portfolioStats.totalDayChange >= 0 ? (
              <ArrowUpRight className="text-emerald-400" size={18} />
            ) : (
              <ArrowDownRight className="text-rose-400" size={18} />
            )
          }
        />
      </div>

      {/* VIEW TABS & TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--app-border)]">
        <SegmentedControl
          value={viewTab}
          onChange={(val) => setViewTab(val)}
          options={[
            {
              value: "holdings",
              label: `Holdings (${holdings.length})`,
              icon: <List size={14} />,
            },
            {
              value: "allocation",
              label: "Sector & Allocation",
              icon: <PieChartIcon size={14} />,
            },
            {
              value: "transactions",
              label: `Trade Activity (${transactions.length})`,
              icon: <History size={14} />,
            },
          ]}
        />

        {/* Table vs Grid toggle for Holdings View */}
        {viewTab === "holdings" && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-[var(--app-muted)] hidden sm:inline">View:</span>
            <div className="flex items-center p-1 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setDisplayMode("table")}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  displayMode === "table"
                    ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] font-semibold shadow-xs"
                    : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                }`}
                title="Zerodha Kite Table View"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("grid")}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  displayMode === "grid"
                    ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] font-semibold shadow-xs"
                    : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                }`}
                title="Visual Card Grid"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: HOLDINGS TAB */}
      {viewTab === "holdings" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]"
              />
              <input
                type="text"
                placeholder="Search symbol (e.g. RELIANCE, TCS, ETERNAL)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-fg)] placeholder-[var(--app-muted)] focus:outline-none focus:border-[var(--app-accent)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Pills & Sector Dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Profit / Loss Filter Pills */}
              <div className="flex items-center p-1 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-xs">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "profit", label: `Profit (${portfolioStats.profitableCount})` },
                    { id: "loss", label: `Loss (${portfolioStats.lossCount})` },
                    { id: "gainers", label: "Day Gainers" },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setFilterType(pill.id)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      filterType === pill.id
                        ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] font-semibold shadow-xs"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Sector Dropdown */}
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-fg)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Sectors</option>
                {SECTOR_OPTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-fg)] focus:outline-none cursor-pointer"
              >
                <option value="value_desc">Sort: Highest Value</option>
                <option value="pnl_desc">Sort: Highest P&L %</option>
                <option value="pnl_asc">Sort: Lowest P&L %</option>
                <option value="day_desc">Sort: Day Change %</option>
                <option value="symbol_asc">Sort: Symbol (A-Z)</option>
              </select>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : holdings.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={36} className="text-emerald-400" />}
              title="No Stocks Found in Portfolio"
              description={
                zerodhaAccount && Number(zerodhaAccount.balance) > 0
                  ? `Zerodha Demat wallet cash margin is active: ${formatINR(Number(zerodhaAccount.balance))}. Stock holdings will appear automatically once purchased in Zerodha Kite.`
                  : "Your Demat stock holdings from Zerodha Kite will automatically synchronize and appear here."
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<RefreshCw size={14} className={syncingZerodha ? "animate-spin" : ""} />}
                  disabled={syncingZerodha}
                  onClick={handleSyncZerodha}
                >
                  {syncingZerodha ? "Syncing Zerodha..." : "Sync Zerodha Now"}
                </Button>
              }
            />
          ) : displayedHoldings.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[var(--app-card)] border border-[var(--app-border)]">
              <p className="text-sm text-[var(--app-muted)]">No stocks matched your search filters.</p>
              <Button
                variant="ghost"
                size="xs"
                className="mt-3"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("all");
                  setSelectedSector("all");
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : displayMode === "table" ? (
            /* ZERODHA KITE TABULAR HOLDINGS VIEW */
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] bg-[var(--app-card-elevated)]/60 text-[var(--app-muted)] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Instrument</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                      <th className="py-3 px-4 text-right">Avg. Cost</th>
                      <th className="py-3 px-4 text-right">LTP (Live)</th>
                      <th className="py-3 px-4 text-right">Cur. Value</th>
                      <th className="py-3 px-4 text-right">Total P&L</th>
                      <th className="py-3 px-4 text-right">Day&apos;s Chg</th>
                      <th className="py-3 px-4 text-center">Chart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)]">
                    {displayedHoldings.map((h) => {
                      const isProfit = h.pnl >= 0;
                      const isDayPositive = h.dayChangePercent >= 0;

                      return (
                        <tr
                          key={h.id}
                          className="hover:bg-[var(--app-card-hover)] transition-colors group"
                        >
                          {/* Instrument / Symbol */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {/* Stock Avatar / Emblem */}
                              <EntityLogo
                                name={h.company_name || h.symbol}
                                category="Investment"
                                size={32}
                                className="rounded-xl flex-shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[var(--app-fg)] group-hover:text-sky-400 transition-colors">
                                    {h.symbol}
                                  </span>
                                  <Badge
                                    size="xs"
                                    variant={h.exchange === "NSE" ? "info" : "neutral"}
                                  >
                                    {h.exchange}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-[var(--app-muted)] truncate max-w-[170px]">
                                  {h.company_name}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-[var(--app-fg)]">
                            {formatNumber(h.qty)}
                          </td>

                          {/* Average Buy Price */}
                          <td className="py-3.5 px-4 text-right font-mono text-[var(--app-muted)]">
                            {formatINR(h.avgPrice)}
                          </td>

                          {/* Last Traded Price (LTP) */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[var(--app-fg)]">
                            <div className="flex items-center justify-end gap-1">
                              <span>{formatINR(h.ltp)}</span>
                              {h.quote?.isStale && (
                                <span className="text-[10px] text-amber-400" title="Offline / cached price">
                                  •
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Current Value */}
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-[var(--app-fg)]">
                            {formatINR(h.currentValue)}
                          </td>

                          {/* Total P&L (₹ and %) */}
                          <td className="py-3.5 px-4 text-right">
                            <div
                              className={`font-mono font-bold ${
                                isProfit ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isProfit ? "+" : ""}
                              {formatINR(h.pnl)}
                            </div>
                            <div
                              className={`text-[10px] font-semibold ${
                                isProfit ? "text-emerald-500/90" : "text-rose-500/90"
                              }`}
                            >
                              {isProfit ? "+" : ""}
                              {h.pnlPercent.toFixed(2)}%
                            </div>
                          </td>

                          {/* Day's Change (₹ and %) */}
                          <td className="py-3.5 px-4 text-right">
                            <div
                              className={`font-mono text-xs font-semibold ${
                                isDayPositive ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isDayPositive ? "+" : ""}
                              {h.dayChangePercent.toFixed(2)}%
                            </div>
                            <div className="text-[10px] text-[var(--app-muted)] font-mono">
                              {isDayPositive ? "+" : ""}
                              {formatINR(h.dayTotalChange)}
                            </div>
                          </td>

                          {/* Zerodha Kite Chart Link */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center">
                              <a
                                href={getKiteChartUrl(h.symbol, h.exchange)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                                title="Open Chart in Zerodha Kite"
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

              {/* Table Footer with Summary */}
              <div className="p-4 bg-[var(--app-card-elevated)]/40 border-t border-[var(--app-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-[var(--app-muted)]">
                  Showing <strong>{displayedHoldings.length}</strong> of{" "}
                  <strong>{holdings.length}</strong> stock positions
                </div>
                <div className="flex items-center gap-4 font-mono font-medium">
                  <div>
                    <span className="text-[var(--app-muted)]">Invested: </span>
                    <strong className="text-[var(--app-fg)]">
                      {formatINR(portfolioStats.totalInvested)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[var(--app-muted)]">Current: </span>
                    <strong className="text-[var(--app-fg)]">
                      {formatINR(portfolioStats.totalCurrentValue)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[var(--app-muted)]">Net P&L: </span>
                    <strong
                      className={
                        portfolioStats.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                      }
                    >
                      {portfolioStats.totalPnL >= 0 ? "+" : ""}
                      {formatINR(portfolioStats.totalPnL)} (
                      {portfolioStats.totalPnLPercent.toFixed(2)}%)
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* VISUAL CARD GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {displayedHoldings.map((h) => {
                const isProfit = h.pnl >= 0;
                const isDayPositive = h.dayChangePercent >= 0;

                return (
                  <div
                    key={h.id}
                    className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] hover:border-sky-500/40 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-xs group"
                  >
                    {/* Top Row: Symbol, Exchange & Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <EntityLogo
                          name={h.company_name || h.symbol}
                          category="Investment"
                          size={40}
                          className="rounded-xl flex-shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-[var(--app-fg)]">
                              {h.symbol}
                            </span>
                            <Badge
                              size="xs"
                              variant={h.exchange === "NSE" ? "info" : "neutral"}
                            >
                              {h.exchange}
                            </Badge>
                          </div>
                          <div className="text-xs text-[var(--app-muted)] truncate max-w-[180px]">
                            {h.company_name}
                          </div>
                        </div>
                      </div>

                      {/* Kite Chart Button */}
                      <a
                        href={getKiteChartUrl(h.symbol, h.exchange)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                        title="View Chart on Zerodha Kite"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    {/* Middle Row: Live Price & Day Change */}
                    <div className="flex items-baseline justify-between pt-1 border-t border-[var(--app-border)]/60">
                      <div>
                        <div className="text-[11px] text-[var(--app-muted)]">Live Price (LTP)</div>
                        <div className="text-lg font-mono font-bold text-[var(--app-fg)]">
                          {formatINR(h.ltp)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-[var(--app-muted)]">Day&apos;s Change</div>
                        <div
                          className={`text-sm font-mono font-semibold flex items-center justify-end gap-0.5 ${
                            isDayPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isDayPositive ? (
                            <ArrowUpRight size={13} />
                          ) : (
                            <ArrowDownRight size={13} />
                          )}
                          <span>
                            {isDayPositive ? "+" : ""}
                            {h.dayChangePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Holdings Metrics: Qty, Avg Price, Cur Value */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[var(--app-card-elevated)]/50 text-xs">
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)] uppercase">Quantity</div>
                        <div className="font-mono font-medium text-[var(--app-fg)]">
                          {formatNumber(h.qty)} shares
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)] uppercase">Avg. Cost</div>
                        <div className="font-mono text-[var(--app-muted)]">
                          {formatINR(h.avgPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)] uppercase">Invested</div>
                        <div className="font-mono text-[var(--app-fg)]">
                          {formatINR(h.invested)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)] uppercase">Cur. Value</div>
                        <div className="font-mono font-semibold text-[var(--app-fg)]">
                          {formatINR(h.currentValue)}
                        </div>
                      </div>
                    </div>

                    {/* P&L Banner & Buttons */}
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)]">Total Return</div>
                        <div
                          className={`font-mono font-bold text-sm ${
                            isProfit ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isProfit ? "+" : ""}
                          {formatINR(h.pnl)} ({isProfit ? "+" : ""}
                          {h.pnlPercent.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SECTOR & ALLOCATION TAB */}
      {viewTab === "allocation" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sector Breakdown Chart */}
            <div className="p-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--app-fg)]">Sector Allocation</h3>
                  <p className="text-xs text-[var(--app-muted)]">
                    Diversification across industries & market segments
                  </p>
                </div>
                <Badge variant="info">{sectorSegments.length} Sectors</Badge>
              </div>

              <InteractiveDonutChart
                title="Sector Breakdown"
                totalLabel="Equity Value"
                totalValue={portfolioStats.totalCurrentValue}
                segments={sectorSegments}
                formatter={formatINR}
                unitLabel="Sector"
                emptyMessage="No stocks logged"
                emptySubMessage="Add your stock holdings to see sector diversification"
              />
            </div>

            {/* Individual Stock Weight Chart */}
            <div className="p-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--app-fg)]">Stock Concentration</h3>
                  <p className="text-xs text-[var(--app-muted)]">
                    Top holding weights (% of total portfolio)
                  </p>
                </div>
                <Badge variant="sky">{holdings.length} Holdings</Badge>
              </div>

              <InteractiveDonutChart
                title="Top Stocks"
                totalLabel="Total Equity"
                totalValue={portfolioStats.totalCurrentValue}
                segments={stockWeightSegments}
                formatter={formatINR}
                unitLabel="Stock"
                emptyMessage="No stocks logged"
                emptySubMessage="Log stock positions to analyze concentration risk"
              />
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: TRADE ACTIVITY LOG / LEDGER */}
      {viewTab === "transactions" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {transactions.length === 0 ? (
            <EmptyState
              icon={<History size={36} className="text-sky-400" />}
              title="No Trade Transactions Recorded"
              description="Whenever you record a stock buy or sell lot, an immutable transaction receipt will be logged here."
            />
          ) : (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] overflow-hidden shadow-xs">
              <div className="p-4 border-b border-[var(--app-border)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--app-fg)]">Execution Ledger</h3>
                  <p className="text-xs text-[var(--app-muted)]">
                    Audit trail of all manual buy and sell transactions
                  </p>
                </div>
                <Badge variant="neutral">{transactions.length} Records</Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] bg-[var(--app-card-elevated)]/60 text-[var(--app-muted)] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4 text-right">Price (₹)</th>
                      <th className="py-3 px-4 text-right">Total (₹)</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)]">
                    {transactions.map((txn) => {
                      const isBuy = txn.type === "BUY";
                      const totalAmount = txn.quantity * txn.price + (txn.brokerage_charges || 0);

                      return (
                        <tr key={txn.id} className="hover:bg-[var(--app-card-hover)] transition-colors">
                          <td className="py-3 px-4 text-[var(--app-muted)] font-mono">
                            {txn.transaction_date}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                isBuy
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              {txn.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-[var(--app-fg)]">
                            <div className="flex items-center gap-1.5">
                              <span>{txn.symbol}</span>
                              <Badge size="xs" variant="neutral">
                                {txn.exchange}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[var(--app-fg)] font-medium">
                            {formatNumber(txn.quantity)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[var(--app-muted)]">
                            {formatINR(txn.price)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-bold ${
                              isBuy ? "text-emerald-400" : "text-sky-400"
                            }`}
                          >
                            {formatINR(totalAmount)}
                          </td>
                          <td className="py-3 px-4 text-[var(--app-muted)] max-w-xs truncate">
                            {txn.notes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </main>
  );
}
