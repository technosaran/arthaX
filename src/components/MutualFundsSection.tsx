"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Coins,
  RefreshCw,
  Search,
  PieChart as PieChartIcon,
  History,
  X,
  ShieldCheck,
  List,
  LayoutGrid,
  Calendar,
  Wallet,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";

export interface MutualFundHolding {
  id: string;
  user_id: string;
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  category: string;
  sub_category?: string | null;
  plan_type: "Direct" | "Regular";
  dividend_option: "Growth" | "IDCW" | "Bonus";
  folio_number: string;
  units: number;
  avg_nav: number;
  invested_amount: number;
  current_nav: number;
  previous_nav?: number;
  nav_date?: string | null;
  isin?: string | null;
  is_sip_active: boolean;
  sip_amount: number;
  sip_frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY";
  sip_day: number;
  sip_step_up_percent: number;
  account_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MutualFundTransaction {
  id: string;
  user_id: string;
  holding_id: string;
  scheme_code: string;
  scheme_name: string;
  type: "SIP" | "BUY" | "SELL" | "SWITCH_IN" | "SWITCH_OUT";
  units: number;
  nav: number;
  amount: number;
  stamp_duty: number;
  transaction_date: string;
  notes?: string | null;
  created_at: string;
}

export interface NavQuote {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  assetClass: "Equity" | "Debt" | "Hybrid" | "Commodity" | "Other";
  currentNav: number;
  previousNav: number;
  change: number;
  changePercent: number;
  navDate: string;
  lastUpdated: string;
  isin?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Flexi Cap": "#6366f1", // Indigo
  "Small Cap": "#f43f5e", // Rose
  "Mid Cap": "#f59e0b", // Amber
  "Large Cap": "#38bdf8", // Sky blue
  "Large & Mid Cap": "#0ea5e9", // Ocean
  "ELSS (Tax Saver)": "#10b981", // Emerald
  "Index Fund": "#a855f7", // Purple
  "Value & Contra": "#ec4899", // Pink
  "Hybrid / Balanced": "#06b6d4", // Cyan
  "Debt & Liquid": "#64748b", // Slate
  "Commodities": "#eab308", // Yellow / Gold
  "International FoF": "#14b8a6", // Teal
  "Equity (Other)": "#94a3b8", // Muted
};

const AMC_COLORS = [
  "#387ED1", // Zerodha / Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#6366F1", // Indigo
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#84CC16", // Lime
];

export default function MutualFundsSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Holdings & Quotes State
  const [holdings, setHoldings] = useState<MutualFundHolding[]>([]);
  const [transactions, setTransactions] = useState<MutualFundTransaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, NavQuote>>({});

  // UI state
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<boolean>(false);
  const autoSyncedRef = useRef<boolean>(false);
  const holdingsRef = useRef<MutualFundHolding[]>(holdings);

  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);
  const [syncingZerodha, setSyncingZerodha] = useState(false);
  const [viewTab, setViewTab] = useState<string>("holdings");
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "profit" | "loss" | "sip_active" | "elss">("all");
  const selectedCategory = "all";
  const selectedAMC = "all";
  const [sortBy, setSortBy] = useState<"value_desc" | "pnl_desc" | "pnl_asc" | "returns_desc" | "name_asc">(
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

  const formatNumber = useCallback((val: number, maxDigits = 3) => {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: maxDigits,
    }).format(val);
  }, []);

  // Fetch live NAV quotes from MFAPI
  const fetchNavsForHoldings = useCallback(async (holdingsList: MutualFundHolding[], notify = true) => {
    if (holdingsList.length === 0) return;
    try {
      const codes = Array.from(new Set(holdingsList.map((h) => h.scheme_code))).join(",");
      const res = await fetch(`/api/v1/mutual-funds/nav?codes=${encodeURIComponent(codes)}`);

      if (res.ok) {
        const json = await res.json();
        if (json.quotes) {
          setQuotes((prev) => ({ ...prev, ...json.quotes }));
          if (notify) {
            showToast("AMFI NAVs Updated", "Latest mutual fund Net Asset Values loaded successfully.", "success");
          }
        }
      }
    } catch (err) {
      console.warn("[MF NAV] Batch fetch failed:", err);
      if (notify) {
        showToast("AMFI Notice", "Could not refresh live AMFI NAVs. Displaying last recorded valuations.", "warning");
      }
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

      const holdingsRes = await fetch("/api/v1/mutual-funds/holdings", { headers });

      if (holdingsRes.ok) {
        const json = await holdingsRes.json();
        const holdingsData: MutualFundHolding[] = json.holdings || [];
        setHoldings(holdingsData);
        setTransactions(json.transactions || []);

        // Immediately fetch live NAVs for all holdings
        if (holdingsData.length > 0) {
          fetchNavsForHoldings(holdingsData, false);
        }
      }
    } catch (err) {
      console.error("[Mutual Funds] Error loading portfolio:", err);
      showToast("Portfolio Load Failed", "Failed to load mutual funds portfolio.", "error");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [user, supabase, showToast, fetchNavsForHoldings]);

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

  // Sync Coin DEMAT Mutual Funds directly from Zerodha Kite API
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
          "Failed to sync Zerodha Coin portfolio";
        throw new Error(errorMsg);
      }
      const count = json.data?.mfSynced ?? 0;
      showToast(
        "Zerodha Coin Synced!",
        count > 0
          ? `Successfully synced ${count} mutual funds from Zerodha Coin.`
          : `Zerodha Coin sync completed! No active mutual fund holdings in Zerodha DEMAT.`,
        "success"
      );
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync Zerodha mutual funds";
      showToast("Zerodha Coin Sync Failed", msg, "error");
    } finally {
      setSyncingZerodha(false);
    }
  };

  // Portfolio aggregates and calculations
  const portfolioStats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let todayChange = 0;
    let activeSipsCount = 0;
    let monthlySipCommitment = 0;
    let elssInvested = 0;

    for (const h of holdings) {
      const liveQuote = quotes[h.scheme_code];
      const nav = liveQuote?.currentNav || h.current_nav || h.avg_nav;
      const change = liveQuote?.change || 0;

      const units = Number(h.units) || 0;
      const invested = Number(h.invested_amount) > 0 ? Number(h.invested_amount) : +(units * (Number(h.avg_nav) || 0)).toFixed(2);
      const currentVal = +(units * nav).toFixed(2);

      totalInvested += invested;
      totalCurrentValue += currentVal;
      todayChange += +(units * change).toFixed(2);

      if (h.is_sip_active) {
        activeSipsCount++;
        const sAmount = Number(h.sip_amount) || 0;
        if (h.sip_frequency === "MONTHLY") {
          monthlySipCommitment += sAmount;
        } else if (h.sip_frequency === "WEEKLY") {
          monthlySipCommitment += sAmount * 4.33;
        } else if (h.sip_frequency === "QUARTERLY") {
          monthlySipCommitment += sAmount / 3;
        }
      }

      if (h.category.toLowerCase().includes("elss") || h.scheme_name.toLowerCase().includes("elss") || h.scheme_name.toLowerCase().includes("tax saver")) {
        elssInvested += invested;
      }
    }

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? +((totalPnL / totalInvested) * 100).toFixed(2) : 0;
    const todayChangePercent =
      totalCurrentValue - todayChange > 0 ? +((todayChange / (totalCurrentValue - todayChange)) * 100).toFixed(2) : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalPnL,
      totalPnLPercent,
      todayChange,
      todayChangePercent,
      activeSipsCount,
      monthlySipCommitment: Math.round(monthlySipCommitment),
      elssInvested,
    };
  }, [holdings, quotes]);

  // Filtered and sorted holdings
  const filteredHoldings = useMemo(() => {
    return holdings
      .filter((h) => {
        // Search text
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            h.scheme_name.toLowerCase().includes(q) ||
            h.fund_house.toLowerCase().includes(q) ||
            h.category.toLowerCase().includes(q) ||
            h.folio_number.toLowerCase().includes(q) ||
            h.scheme_code.includes(q);
          if (!matches) return false;
        }

        // Quick filter pills
        const liveQuote = quotes[h.scheme_code];
        const currentNav = liveQuote?.currentNav || h.current_nav || h.avg_nav;
        const currentVal = (Number(h.units) || 0) * currentNav;
        const investedVal = Number(h.invested_amount) > 0 ? Number(h.invested_amount) : (Number(h.units) || 0) * (Number(h.avg_nav) || 0);
        const pnl = currentVal - investedVal;

        if (filterType === "profit" && pnl <= 0) return false;
        if (filterType === "loss" && pnl >= 0) return false;
        if (filterType === "sip_active" && !h.is_sip_active) return false;
        if (filterType === "elss" && !(h.category.toLowerCase().includes("elss") || h.scheme_name.toLowerCase().includes("tax saver"))) return false;

        // Category filter
        if (selectedCategory !== "all" && h.category !== selectedCategory) return false;

        // AMC filter
        if (selectedAMC !== "all" && h.fund_house !== selectedAMC) return false;

        return true;
      })
      .sort((a, b) => {
        const aNav = quotes[a.scheme_code]?.currentNav || a.current_nav || a.avg_nav;
        const bNav = quotes[b.scheme_code]?.currentNav || b.current_nav || b.avg_nav;
        const aVal = (Number(a.units) || 0) * aNav;
        const bVal = (Number(b.units) || 0) * bNav;
        const aInvested = Number(a.invested_amount) > 0 ? Number(a.invested_amount) : (Number(a.units) || 0) * (Number(a.avg_nav) || 0);
        const bInvested = Number(b.invested_amount) > 0 ? Number(b.invested_amount) : (Number(b.units) || 0) * (Number(b.avg_nav) || 0);
        const aPnL = aVal - aInvested;
        const bPnL = bVal - bInvested;
        const aReturns = aInvested > 0 ? (aPnL / aInvested) * 100 : 0;
        const bReturns = bInvested > 0 ? (bPnL / bInvested) * 100 : 0;

        if (sortBy === "value_desc") return bVal - aVal;
        if (sortBy === "pnl_desc") return bPnL - aPnL;
        if (sortBy === "pnl_asc") return aPnL - bPnL;
        if (sortBy === "returns_desc") return bReturns - aReturns;
        if (sortBy === "name_asc") return a.scheme_name.localeCompare(b.scheme_name);
        return 0;
      });
  }, [holdings, quotes, searchQuery, filterType, selectedCategory, selectedAMC, sortBy]);

  // Donut chart: Category Allocation
  const categorySegments: DonutSegment[] = useMemo(() => {
    const catMap: Record<string, number> = {};
    holdings.forEach((h) => {
      const nav = quotes[h.scheme_code]?.currentNav || h.current_nav || h.avg_nav;
      const val = (Number(h.units) || 0) * nav;
      const cat = h.category || "Equity";
      catMap[cat] = (catMap[cat] || 0) + val;
    });

    return Object.entries(catMap)
      .map(([name, value]) => ({
        label: name,
        value,
        color: CATEGORY_COLORS[name] || "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, quotes]);

  // Donut chart: AMC / Fund House Allocation
  const amcSegments: DonutSegment[] = useMemo(() => {
    const amcMap: Record<string, number> = {};
    holdings.forEach((h) => {
      const nav = quotes[h.scheme_code]?.currentNav || h.current_nav || h.avg_nav;
      const val = (Number(h.units) || 0) * nav;
      const amc = h.fund_house || "Other";
      amcMap[amc] = (amcMap[amc] || 0) + val;
    });

    return Object.entries(amcMap)
      .map(([name, value], idx) => ({
        label: name,
        value,
        color: AMC_COLORS[idx % AMC_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, quotes]);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* 1. SECTION PAGE HEADER & ZERODHA COIN BADGE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--app-border)]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--app-fg)] flex items-center gap-2">
              <Coins className="text-[#387ED1]" size={26} />
              <span>Mutual Funds</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={13} className={syncingZerodha ? "animate-spin" : ""} />}
            disabled={syncingZerodha}
            onClick={handleSyncZerodha}
            title="Sync Zerodha Coin mutual funds"
          >
            {syncingZerodha ? "Syncing Coin..." : "Sync Zerodha Coin"}
          </Button>
        </div>
      </div>

      {/* 2. STAT CARDS / EXECUTIVE KPI BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Portfolio Value */}
        <StatCard
          label="Current Portfolio Value"
          value={formatINR(portfolioStats.totalCurrentValue)}
          subtitle={`${holdings.length} Direct Scheme${holdings.length === 1 ? "" : "s"}`}
          icon={<Coins size={16} className="text-[#387ED1]" />}
          trend={
            portfolioStats.todayChange !== 0
              ? {
                  direction: portfolioStats.todayChange >= 0 ? "up" : "down",
                  value: `${portfolioStats.todayChange >= 0 ? "+" : ""}${formatINR(
                    portfolioStats.todayChange
                  )} (${portfolioStats.todayChangePercent}%) Today`,
                }
              : undefined
          }
        />

        {/* Total Invested & Overall P&L */}
        <StatCard
          label="Total Investment"
          value={formatINR(portfolioStats.totalInvested)}
          subtitle="Net Cost Basis"
          icon={<Wallet size={16} className="text-emerald-400" />}
          trend={{
            direction: portfolioStats.totalPnL >= 0 ? "up" : "down",
            value: `${portfolioStats.totalPnL >= 0 ? "+" : ""}${formatINR(
              portfolioStats.totalPnL
            )} (${portfolioStats.totalPnLPercent}%) Total`,
          }}
        />

        {/* Active SIPs & Monthly Inflow */}
        <StatCard
          label="Active SIPs"
          value={String(portfolioStats.activeSipsCount)}
          subtitle={`${formatINR(portfolioStats.monthlySipCommitment)} / month outflow`}
          icon={<Calendar size={16} className="text-sky-400" />}
        />

        {/* Section 80C ELSS Tax Savings */}
        <div
          className="rounded-2xl border border-[var(--app-border)] p-4 sm:p-5 flex flex-col justify-between transition-all"
          style={{ backgroundColor: "var(--app-card)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
              ELSS Tax Saver (80C)
            </span>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-[var(--app-fg)]">
              {formatINR(portfolioStats.elssInvested)}
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--app-muted)] mt-1">
              <span>Section 80C Limit</span>
              <span>₹1,50,000</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[var(--app-card-elevated)] h-1.5 rounded-full mt-2 overflow-hidden border border-[var(--app-border)]">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round((portfolioStats.elssInvested / 150000) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABS NAVIGATION */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-1 overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setViewTab("holdings")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              viewTab === "holdings"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
            }`}
          >
            <List size={14} />
            <span>Holdings ({holdings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab("sips")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              viewTab === "sips"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
            }`}
          >
            <Calendar size={14} className="text-[#387ED1]" />
            <span>SIP Schedule ({portfolioStats.activeSipsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab("allocations")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              viewTab === "allocations"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
            }`}
          >
            <PieChartIcon size={14} className="text-emerald-400" />
            <span>Asset & AMC Allocation</span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab("transactions")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              viewTab === "transactions"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
            }`}
          >
            <History size={14} />
            <span>Order History ({transactions.length})</span>
          </button>
        </div>

        {viewTab === "holdings" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDisplayMode("table")}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                displayMode === "table"
                  ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border-[var(--app-border)] shadow-xs"
                  : "text-[var(--app-muted)] border-transparent hover:bg-[var(--app-card-hover)]"
              }`}
              title="Table view"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("grid")}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                displayMode === "grid"
                  ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border-[var(--app-border)] shadow-xs"
                  : "text-[var(--app-muted)] border-transparent hover:bg-[var(--app-card-hover)]"
              }`}
              title="Card view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        )}
      </div>

      {/* 4. VIEW CONTENT */}
      {viewTab === "holdings" && (
        <div className="space-y-4">
          {/* Filters & Search Control Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-[var(--app-muted)]" size={15} />
              <input
                type="text"
                placeholder="Search by fund name, AMC, folio, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-fg)] placeholder-[var(--app-muted)] focus:outline-none focus:border-[#387ED1] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  filterType === "all"
                    ? "border-[#387ED1] bg-[#387ED1]/10 text-[#387ED1]"
                    : "border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
                }`}
              >
                All ({holdings.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("sip_active")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  filterType === "sip_active"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
                }`}
              >
                Active SIPs
              </button>
              <button
                type="button"
                onClick={() => setFilterType("profit")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  filterType === "profit"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
                }`}
              >
                In Profit
              </button>
              <button
                type="button"
                onClick={() => setFilterType("loss")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  filterType === "loss"
                    ? "border-rose-500 bg-rose-500/10 text-rose-400"
                    : "border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
                }`}
              >
                In Loss
              </button>
              <button
                type="button"
                onClick={() => setFilterType("elss")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  filterType === "elss"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                    : "border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
                }`}
              >
                ELSS (80C)
              </button>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-fg)] focus:outline-none focus:border-[#387ED1] cursor-pointer"
              >
                <option value="value_desc">Highest Value</option>
                <option value="pnl_desc">Highest Gain (₹)</option>
                <option value="returns_desc">Highest Return (%)</option>
                <option value="pnl_asc">Lowest Gain (₹)</option>
                <option value="name_asc">Scheme Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Holdings List: Loading / Empty / Data */}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : filteredHoldings.length === 0 ? (
            <EmptyState
              icon={<Coins size={28} className="text-[#387ED1]" />}
              title="No Mutual Fund Holdings Found"
              description={
                searchQuery || filterType !== "all"
                  ? "Try clearing filters to view your investments."
                  : "Your mutual fund holdings from Zerodha Coin will automatically synchronize and appear here."
              }
              action={
                !searchQuery && filterType === "all" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<RefreshCw size={14} className={syncingZerodha ? "animate-spin" : ""} />}
                    disabled={syncingZerodha}
                    onClick={handleSyncZerodha}
                  >
                    {syncingZerodha ? "Syncing Coin..." : "Sync Zerodha Coin Now"}
                  </Button>
                ) : undefined
              }
            />
          ) : displayMode === "table" ? (
            /* Table View */
            <div
              className="rounded-2xl border border-[var(--app-border)] overflow-hidden shadow-xs"
              style={{ backgroundColor: "var(--app-card)" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] bg-[var(--app-card-elevated)] text-[var(--app-muted)] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Scheme & AMC</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Units Held</th>
                      <th className="py-3 px-4 text-right">Avg NAV</th>
                      <th className="py-3 px-4 text-right">Live NAV</th>
                      <th className="py-3 px-4 text-right">Invested Value</th>
                      <th className="py-3 px-4 text-right">Current Value</th>
                      <th className="py-3 px-4 text-right">Total Returns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)]">
                    {filteredHoldings.map((h) => {
                      const quote = quotes[h.scheme_code];
                      const liveNav = quote?.currentNav || h.current_nav || h.avg_nav;
                      const dayChange = quote?.change || 0;
                      const dayChangePercent = quote?.changePercent || 0;

                      const units = Number(h.units) || 0;
                      const avgNav = Number(h.avg_nav) || 0;
                      const invested =
                        Number(h.invested_amount) > 0 ? Number(h.invested_amount) : +(units * avgNav).toFixed(2);
                      const currentVal = +(units * liveNav).toFixed(2);
                      const pnl = currentVal - invested;
                      const pnlPercent = invested > 0 ? +((pnl / invested) * 100).toFixed(2) : 0;
                      const isProfit = pnl >= 0;

                      return (
                        <tr
                          key={h.id}
                          className="hover:bg-[var(--app-card-hover)] transition-colors group"
                        >
                          {/* Scheme Name & Folio */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-[var(--app-fg)] group-hover:text-[#387ED1] transition-colors line-clamp-1 max-w-xs sm:max-w-md">
                                {h.scheme_name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--app-muted)]">
                                <span>{h.fund_house}</span>
                                <span>•</span>
                                <span className="font-mono">Folio: {h.folio_number}</span>
                                {h.is_sip_active && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                      <Calendar size={11} />
                                      SIP ₹{formatNumber(h.sip_amount, 0)} (Day {h.sip_day})
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border"
                              style={{
                                backgroundColor: `${CATEGORY_COLORS[h.category] || "#94a3b8"}15`,
                                borderColor: `${CATEGORY_COLORS[h.category] || "#94a3b8"}40`,
                                color: CATEGORY_COLORS[h.category] || "var(--app-fg)",
                              }}
                            >
                              {h.category}
                            </span>
                          </td>

                          {/* Units */}
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-[var(--app-fg)]">
                            {formatNumber(units, 3)}
                          </td>

                          {/* Avg NAV */}
                          <td className="py-3.5 px-4 text-right font-mono text-[var(--app-muted)]">
                            ₹{formatNumber(avgNav, 2)}
                          </td>

                          {/* Live NAV & 1-day Change */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="font-mono font-bold text-[var(--app-fg)]">
                              ₹{formatNumber(liveNav, 2)}
                            </div>
                            {dayChange !== 0 && (
                              <div
                                className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${
                                  dayChange >= 0 ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {dayChange >= 0 ? "+" : ""}
                                {formatNumber(dayChange, 2)} ({dayChangePercent}%)
                              </div>
                            )}
                          </td>

                          {/* Invested Value */}
                          <td className="py-3.5 px-4 text-right font-mono text-[var(--app-muted)]">
                            {formatINR(invested)}
                          </td>

                          {/* Current Value */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[var(--app-fg)]">
                            {formatINR(currentVal)}
                          </td>

                          {/* Returns (₹ & %) */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div
                              className={`font-mono font-bold ${
                                isProfit ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isProfit ? "+" : ""}
                              {formatINR(pnl)}
                            </div>
                            <div
                              className={`text-[10px] font-mono ${
                                isProfit ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isProfit ? "+" : ""}
                              {pnlPercent}%
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Card / Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHoldings.map((h) => {
                const quote = quotes[h.scheme_code];
                const liveNav = quote?.currentNav || h.current_nav || h.avg_nav;

                const units = Number(h.units) || 0;
                const avgNav = Number(h.avg_nav) || 0;
                const invested =
                  Number(h.invested_amount) > 0 ? Number(h.invested_amount) : +(units * avgNav).toFixed(2);
                const currentVal = +(units * liveNav).toFixed(2);
                const pnl = currentVal - invested;
                const pnlPercent = invested > 0 ? +((pnl / invested) * 100).toFixed(2) : 0;
                const isProfit = pnl >= 0;

                return (
                  <div
                    key={h.id}
                    className="rounded-2xl border border-[var(--app-border)] p-4 flex flex-col justify-between transition-all hover:border-[#387ED1]/50 shadow-xs group"
                    style={{ backgroundColor: "var(--app-card)" }}
                  >
                    <div>
                      {/* Card Header: Category & Folio */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                          style={{
                            backgroundColor: `${CATEGORY_COLORS[h.category] || "#94a3b8"}15`,
                            borderColor: `${CATEGORY_COLORS[h.category] || "#94a3b8"}40`,
                            color: CATEGORY_COLORS[h.category] || "var(--app-fg)",
                          }}
                        >
                          {h.category}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--app-muted)]">
                          {h.folio_number}
                        </span>
                      </div>

                      {/* Scheme Name */}
                      <h3 className="font-bold text-sm text-[var(--app-fg)] group-hover:text-[#387ED1] transition-colors line-clamp-2">
                        {h.scheme_name}
                      </h3>
                      <p className="text-xs text-[var(--app-muted)] mt-0.5">{h.fund_house}</p>

                      {/* SIP Badge if active */}
                      {h.is_sip_active && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 mt-2">
                          <Calendar size={11} />
                          <span>
                            SIP ₹{formatNumber(h.sip_amount, 0)} on {h.sip_day}th of month
                          </span>
                        </div>
                      )}

                      {/* Financial Grid */}
                      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[var(--app-border)] text-xs">
                        <div>
                          <div className="text-[var(--app-muted)]">Units</div>
                          <div className="font-mono font-semibold text-[var(--app-fg)]">
                            {formatNumber(units, 3)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--app-muted)]">Live NAV</div>
                          <div className="font-mono font-semibold text-[var(--app-fg)]">
                            ₹{formatNumber(liveNav, 2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--app-muted)]">Invested</div>
                          <div className="font-mono text-[var(--app-fg)]">{formatINR(invested)}</div>
                        </div>
                        <div>
                          <div className="text-[var(--app-muted)]">Current Value</div>
                          <div className="font-mono font-bold text-[var(--app-fg)]">
                            {formatINR(currentVal)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Returns */}
                    <div className="mt-4 pt-3 border-t border-[var(--app-border)] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)] uppercase font-semibold">
                          Returns
                        </div>
                        <div
                          className={`font-mono font-bold text-xs ${
                            isProfit ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isProfit ? "+" : ""}
                          {formatINR(pnl)} ({pnlPercent}%)
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

      {/* 5. SIP SCHEDULE TAB */}
      {viewTab === "sips" && (
        <div className="space-y-6">
          <div
            className="rounded-2xl border border-[var(--app-border)] p-5 shadow-xs"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--app-border)]">
              <div>
                <h2 className="text-base font-bold text-[var(--app-fg)] flex items-center gap-2">
                  <Calendar size={18} className="text-[#387ED1]" />
                  <span>Systematic Investment Plans (SIP)</span>
                </h2>
                <p className="text-xs text-[var(--app-muted)] mt-0.5">
                  Monthly automated disciplined investment schedules on Zerodha Coin.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--app-muted)]">Monthly Outflow</div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {formatINR(portfolioStats.monthlySipCommitment)}
                </div>
              </div>
            </div>

            {/* List of active SIPs */}
            <div className="divide-y divide-[var(--app-border)] mt-2">
              {holdings.filter((h) => h.is_sip_active).length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--app-muted)]">
                  No active SIPs configured. Edit a fund holding or add a new fund with SIP enabled.
                </div>
              ) : (
                holdings
                  .filter((h) => h.is_sip_active)
                  .sort((a, b) => a.sip_day - b.sip_day)
                  .map((h) => (
                    <div
                      key={h.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#387ED1]/10 text-[#387ED1] border border-[#387ED1]/20 flex flex-col items-center justify-center font-mono flex-shrink-0">
                          <span className="text-[10px] uppercase font-bold">DAY</span>
                          <span className="text-sm font-black leading-none">{h.sip_day}</span>
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[var(--app-fg)] line-clamp-1">
                            {h.scheme_name}
                          </div>
                          <div className="text-[11px] text-[var(--app-muted)]">
                            {h.fund_house} • {h.sip_frequency} • Folio: {h.folio_number}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        <div className="text-right">
                          <div className="text-xs font-bold font-mono text-[var(--app-fg)]">
                            {formatINR(h.sip_amount)}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-semibold">Active</div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. ALLOCATION CHARTS TAB */}
      {viewTab === "allocations" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="rounded-2xl border border-[var(--app-border)] p-5 shadow-xs"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <InteractiveDonutChart
              title="Category & Market Cap Allocation"
              totalLabel="Mutual Funds"
              totalValue={portfolioStats.totalCurrentValue}
              segments={categorySegments}
              formatter={formatINR}
              unitLabel="Category"
              emptyMessage="No funds logged"
              emptySubMessage="Add mutual fund investments to view diversification"
            />
          </div>

          <div
            className="rounded-2xl border border-[var(--app-border)] p-5 shadow-xs"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <InteractiveDonutChart
              title="AMC / Fund House Allocation"
              totalLabel="Total Equity"
              totalValue={portfolioStats.totalCurrentValue}
              segments={amcSegments}
              formatter={formatINR}
              unitLabel="Fund House"
              emptyMessage="No funds logged"
              emptySubMessage="Log funds to view concentration across Indian AMCs"
            />
          </div>
        </div>
      )}

      {/* 7. TRANSACTION HISTORY TAB */}
      {viewTab === "transactions" && (
        <div
          className="rounded-2xl border border-[var(--app-border)] overflow-hidden shadow-xs"
          style={{ backgroundColor: "var(--app-card)" }}
        >
          <div className="p-4 border-b border-[var(--app-border)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--app-fg)] flex items-center gap-2">
              <History size={16} className="text-[#387ED1]" />
              <span>Investment & Redemption Log</span>
            </h2>
            <span className="text-xs text-[var(--app-muted)] font-mono">
              {transactions.length} records
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--app-muted)]">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--app-border)] bg-[var(--app-card-elevated)] text-[var(--app-muted)] font-semibold uppercase">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Scheme</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Units</th>
                    <th className="py-3 px-4 text-right">NAV</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[var(--app-card-hover)]">
                      <td className="py-3 px-4 font-mono text-[var(--app-muted)]">
                        {tx.transaction_date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[var(--app-fg)] line-clamp-1 max-w-xs">
                        {tx.scheme_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === "SIP"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : tx.type === "BUY"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--app-fg)]">
                        {formatNumber(tx.units, 3)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--app-muted)]">
                        ₹{formatNumber(tx.nav, 2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[var(--app-fg)]">
                        {formatINR(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-[var(--app-muted)] truncate max-w-xs">
                        {tx.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </main>
  );
}
