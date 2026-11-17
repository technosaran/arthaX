"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  RefreshCw,
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
  ChevronRight,
  ChevronDown,
  Activity,
  BarChart3,
  List,
  LayoutGrid,
  Calendar,
  Wallet,
  Receipt,
  FileText,
  Landmark,
  BadgePercent,
  Copy,
  Info,
  CalendarClock,
  Check,
  RotateCw,
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
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";

export interface BondHolding {
  id: string;
  user_id: string;
  isin: string;
  name: string;
  issuer_name: string;
  bond_type: "CORPORATE" | "GOVERNMENT" | "STATE_DEVELOPMENT" | "SGB" | "TAX_FREE" | "OTHER";
  platform: "INDIABONDS" | "GOLDENPI" | "ZERODHA" | "WINT_WEALTH" | "OTHER";
  demat_account_id?: string | null;
  demat_broker: string;
  face_value: number;
  quantity: number;
  avg_buy_price: number;
  invested_amount: number;
  current_price?: number | null;
  coupon_rate: number;
  ytm?: number | null;
  coupon_frequency: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" | "CUMULATIVE_AT_MATURITY";
  next_coupon_date?: string | null;
  maturity_date: string;
  issue_date?: string | null;
  credit_rating?: string | null;
  rating_agency?: string | null;
  seniority: "SENIOR_SECURED" | "SENIOR_UNSECURED" | "SUBORDINATED_TIER_2" | "PERPETUAL_AT1" | "GOVERNMENT_GUARANTEED";
  tax_status: "TAXABLE" | "TAX_FREE" | "TDS_EXEMPT";
  order_reference?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BondTransaction {
  id: string;
  user_id: string;
  holding_id: string;
  isin: string;
  type: "BUY" | "SELL" | "COUPON_PAYOUT" | "MATURITY_REDEMPTION";
  quantity: number;
  price: number;
  amount: number;
  platform: string;
  demat_account_id?: string | null;
  transaction_date: string;
  notes?: string | null;
  created_at: string;
  bond_holdings?: {
    name: string;
    isin: string;
    issuer_name: string;
    coupon_rate: number;
    platform: string;
  };
}

export interface UpcomingCoupon {
  id: string;
  name: string;
  issuer: string;
  isin: string;
  nextDate: string;
  expectedPayout: number;
  couponRate: number;
  frequency: string;
  platform: string;
}

const TYPE_COLORS: Record<string, string> = {
  CORPORATE: "#38bdf8", // Sky blue
  GOVERNMENT: "#10b981", // Emerald
  STATE_DEVELOPMENT: "#06b6d4", // Cyan
  SGB: "#eab308", // Gold
  TAX_FREE: "#a855f7", // Purple
  OTHER: "#94a3b8", // Slate
};

const RATING_COLORS: Record<string, string> = {
  SOVEREIGN: "#10b981",
  "CRISIL AAA": "#3b82f6",
  "ICRA AAA": "#3b82f6",
  "CARE AAA": "#3b82f6",
  "CRISIL AA+": "#f59e0b",
  "ICRA AA+": "#f59e0b",
  "CARE AA+": "#f59e0b",
  "CRISIL AA": "#f97316",
  "CRISIL AA-": "#fb923c",
};

export default function BondsSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = createClient();

  // State
  const [holdings, setHoldings] = useState<BondHolding[]>([]);
  const [transactions, setTransactions] = useState<BondTransaction[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string; balance: number }>>([]);
  const [zerodhaDematAccount, setZerodhaDematAccount] = useState<{ id: string; name: string; balance?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingZerodha, setSyncingZerodha] = useState(false);
  const [copiedIsin, setCopiedIsin] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"holdings" | "calendar" | "analytics" | "transactions" | "knowledge">("holdings");
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"value_desc" | "coupon_desc" | "next_payout_asc" | "maturity_asc" | "name_asc">("value_desc");

  // Optional Record Coupon Modal
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [selectedHoldingForCoupon, setSelectedHoldingForCoupon] = useState<BondHolding | null>(null);
  const [couponPayoutAmount, setCouponPayoutAmount] = useState<number>(0);
  const [couponPayoutDate, setCouponPayoutDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [autoAdvanceCoupon, setAutoAdvanceCoupon] = useState(true);
  const [savingTransaction, setSavingTransaction] = useState(false);

  // Formatters
  const formatINR = useCallback((val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  const formatDate = useCallback((dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/v1/bonds/holdings", { headers });
      if (res.ok) {
        const json = await res.json();
        setHoldings(json.holdings || []);
        setTransactions(json.transactions || []);
        setAccounts(json.accounts || []);
        setZerodhaDematAccount(json.zerodhaDematAccount || null);
      }
    } catch (err) {
      console.error("[Bonds] Error fetching data:", err);
      showToast("Error", "Failed to load bond portfolio", "error");
    } finally {
      setLoading(false);
    }
  }, [user, supabase, showToast]);

  // Sync Zerodha Demat holdings
  const handleSyncZerodha = useCallback(async (notify = true) => {
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
          "Failed to sync Zerodha Demat holdings";
        throw new Error(errorMsg);
      }

      const count = json.data?.bondsSynced ?? 0;
      if (notify) {
        showToast(
          "Zerodha Demat Synced!",
          count > 0
            ? `Synced and verified ${count} bond holding(s) in your Zerodha Demat.`
            : `Zerodha Demat verified! All holdings and live prices are up to date.`,
          "success"
        );
      }
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync Zerodha Demat holdings";
      if (notify) {
        showToast("Sync Notice", msg, "info");
      }
    } finally {
      setSyncingZerodha(false);
    }
  }, [supabase, showToast, fetchData]);

  // Initial load + Background Auto-Sync from Zerodha (0ms manual work)
  useEffect(() => {
    fetchData();

    // Silent background auto-sync from Zerodha when active session exists
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
  }, [fetchData, supabase]);

  // Copy ISIN to clipboard
  const handleCopyIsin = (isin: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(isin);
      setCopiedIsin(isin);
      setTimeout(() => setCopiedIsin(null), 2000);
      showToast("Copied", `ISIN ${isin} copied to clipboard`, "info");
    }
  };

  // Open Record Coupon Modal
  const handleOpenCouponModal = (bond: BondHolding) => {
    setSelectedHoldingForCoupon(bond);
    const qty = Number(bond.quantity) || 0;
    const faceVal = Number(bond.face_value) || 1000;
    const rate = Number(bond.coupon_rate) || 0;
    let multiplier = 1;
    if (bond.coupon_frequency === "MONTHLY") multiplier = 1 / 12;
    else if (bond.coupon_frequency === "QUARTERLY") multiplier = 1 / 4;
    else if (bond.coupon_frequency === "SEMI_ANNUAL") multiplier = 1 / 2;

    const est = Math.round(((qty * faceVal * rate) / 100) * multiplier * 100) / 100;
    setCouponPayoutAmount(est);
    setCouponPayoutDate(bond.next_coupon_date || new Date().toISOString().split("T")[0]);
    setIsCouponModalOpen(true);
  };

  // Submit Coupon Payout
  const handleSaveCouponPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHoldingForCoupon) return;
    try {
      setSavingTransaction(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/v1/bonds/transactions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          holding_id: selectedHoldingForCoupon.id,
          type: "COUPON_PAYOUT",
          quantity: Number(selectedHoldingForCoupon.quantity),
          price: 0,
          amount: Number(couponPayoutAmount),
          platform: selectedHoldingForCoupon.platform,
          demat_account_id: selectedHoldingForCoupon.demat_account_id,
          transaction_date: couponPayoutDate,
          notes: `Coupon interest received for ${selectedHoldingForCoupon.name}`,
          auto_advance_next_coupon: autoAdvanceCoupon,
        }),
      });

      if (res.ok) {
        showToast("Interest Credited", `Recorded ₹${couponPayoutAmount} coupon payout!`, "success");
        setIsCouponModalOpen(false);
        await fetchData();
      } else {
        const j = await res.json();
        showToast("Error", j.error?.message || "Failed to record transaction", "error");
      }
    } catch {
      showToast("Error", "Failed to record coupon payout", "error");
    } finally {
      setSavingTransaction(false);
    }
  };

  // Portfolio Aggregates & Calculations
  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalFaceValue = 0;
    let totalAnnualInterest = 0;
    let weightedCouponNum = 0;
    let weightedYtmNum = 0;
    let weightedYtmDen = 0;

    const typeDistribution: Record<string, number> = {};
    const ratingDistribution: Record<string, number> = {};
    const upcomingCoupons: UpcomingCoupon[] = [];

    const now = new Date();

    for (const b of holdings) {
      const qty = Number(b.quantity) || 0;
      const face = Number(b.face_value) || 1000;
      const buyPrice = Number(b.avg_buy_price) || face;
      const curPrice = Number(b.current_price) > 0 ? Number(b.current_price) : buyPrice;
      const rate = Number(b.coupon_rate) || 0;
      const ytm = Number(b.ytm) || rate;

      const bondInvested = Number(b.invested_amount) > 0 ? Number(b.invested_amount) : qty * buyPrice;
      const bondCurrent = qty * curPrice;
      const bondFaceTotal = qty * face;
      const bondAnnual = (bondFaceTotal * rate) / 100;

      totalInvested += bondInvested;
      totalCurrentValue += bondCurrent;
      totalFaceValue += bondFaceTotal;
      totalAnnualInterest += bondAnnual;
      weightedCouponNum += bondAnnual;

      if (ytm > 0 && bondInvested > 0) {
        weightedYtmNum += ytm * bondInvested;
        weightedYtmDen += bondInvested;
      }

      // Types
      const t = b.bond_type || "CORPORATE";
      typeDistribution[t] = (typeDistribution[t] || 0) + bondCurrent;

      // Ratings
      const r = b.credit_rating || "CRISIL AAA";
      ratingDistribution[r] = (ratingDistribution[r] || 0) + bondCurrent;

      // Upcoming coupons schedule
      if (b.next_coupon_date) {
        let mult = 1;
        if (b.coupon_frequency === "MONTHLY") mult = 1 / 12;
        else if (b.coupon_frequency === "QUARTERLY") mult = 1 / 4;
        else if (b.coupon_frequency === "SEMI_ANNUAL") mult = 1 / 2;
        else if (b.coupon_frequency === "CUMULATIVE_AT_MATURITY") mult = 0;

        const payout = bondAnnual * mult;
        upcomingCoupons.push({
          id: b.id,
          name: b.name,
          issuer: b.issuer_name,
          isin: b.isin,
          nextDate: b.next_coupon_date,
          expectedPayout: Math.round(payout * 100) / 100,
          couponRate: rate,
          frequency: b.coupon_frequency,
          platform: b.platform,
        });
      }
    }

    upcomingCoupons.sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());

    const weightedCouponRate = totalFaceValue > 0 ? (weightedCouponNum / totalFaceValue) * 100 : 0;
    const weightedYtm = weightedYtmDen > 0 ? weightedYtmNum / weightedYtmDen : 0;
    const totalPnl = totalCurrentValue - totalInvested;
    const totalReturnPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    let nextCouponDays: number | null = null;
    let nextCouponItem: UpcomingCoupon | null = null;
    if (upcomingCoupons.length > 0) {
      const first = upcomingCoupons[0];
      const diffMs = new Date(first.nextDate).getTime() - now.getTime();
      nextCouponDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      nextCouponItem = first;
    }

    return {
      totalInvested,
      totalCurrentValue,
      totalFaceValue,
      totalAnnualInterest,
      monthlyPassiveIncome: totalAnnualInterest / 12,
      weightedCouponRate,
      weightedYtm,
      totalPnl,
      totalReturnPct,
      typeDistribution,
      ratingDistribution,
      upcomingCoupons,
      nextCouponDays,
      nextCouponItem,
    };
  }, [holdings]);

  // Donut chart segments for Asset Allocation by Type
  const typeDonutSegments: DonutSegment[] = useMemo(() => {
    return Object.entries(stats.typeDistribution).map(([typeKey, val]) => {
      const labelMap: Record<string, string> = {
        CORPORATE: "Corporate NCDs",
        GOVERNMENT: "Govt G-Secs",
        STATE_DEVELOPMENT: "State SDLs",
        SGB: "Sovereign Gold Bonds",
        TAX_FREE: "Tax-Free PSU Bonds",
        OTHER: "Other Fixed Income",
      };
      return {
        label: labelMap[typeKey] || typeKey,
        value: val,
        color: TYPE_COLORS[typeKey] || "#64748b",
      };
    });
  }, [stats.typeDistribution]);

  // Donut chart segments for Credit Rating Breakdown
  const ratingDonutSegments: DonutSegment[] = useMemo(() => {
    return Object.entries(stats.ratingDistribution).map(([ratingKey, val]) => ({
      label: ratingKey,
      value: val,
      color: RATING_COLORS[ratingKey] || "#6366f1",
    }));
  }, [stats.ratingDistribution]);

  // Filtered & Sorted Holdings
  const filteredHoldings = useMemo(() => {
    return holdings
      .filter((b) => {
        if (selectedType !== "all" && b.bond_type !== selectedType) return false;
        if (selectedRating !== "all") {
          const r = (b.credit_rating || "").toUpperCase();
          if (selectedRating === "AAA_SOV" && !r.includes("AAA") && !r.includes("SOVEREIGN")) return false;
          if (selectedRating === "AA" && !r.includes("AA")) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = b.name.toLowerCase().includes(q);
          const matchIssuer = b.issuer_name.toLowerCase().includes(q);
          const matchIsin = b.isin.toLowerCase().includes(q);
          if (!matchName && !matchIssuer && !matchIsin) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "value_desc") {
          const valA = Number(a.quantity) * Number(a.current_price || a.avg_buy_price);
          const valB = Number(b.quantity) * Number(b.current_price || b.avg_buy_price);
          return valB - valA;
        }
        if (sortBy === "coupon_desc") {
          return Number(b.coupon_rate) - Number(a.coupon_rate);
        }
        if (sortBy === "next_payout_asc") {
          const tA = a.next_coupon_date ? new Date(a.next_coupon_date).getTime() : 9999999999999;
          const tB = b.next_coupon_date ? new Date(b.next_coupon_date).getTime() : 9999999999999;
          return tA - tB;
        }
        if (sortBy === "maturity_asc") {
          const mA = new Date(a.maturity_date).getTime();
          const mB = new Date(b.maturity_date).getTime();
          return mA - mB;
        }
        if (sortBy === "name_asc") {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [holdings, selectedType, selectedRating, searchQuery, sortBy]);

  return (
    <main
      className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 select-none transition-colors"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* 1. Header with PageHeader & Automated Actions (No Manual Add Button) */}
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <ShieldCheck className="text-emerald-400" size={26} />
            <span>Bonds & Fixed Income</span>
          </span>
        }
        description="Automated portfolio for Corporate Bonds, NCDs, SGBs & Sovereign G-Secs synced from your Zerodha Demat account"
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="font-mono">
              {holdings.length} {holdings.length === 1 ? "Bond" : "Bonds"}
            </Badge>
            {zerodhaDematAccount && (
              <Badge variant="success" className="font-mono">
                Demat Wallet: {formatINR(Number(zerodhaDematAccount.balance) || 0)}
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              leftIcon={<RotateCw size={13} className={loading ? "animate-spin" : ""} />}
              className="text-xs font-semibold"
            >
              Refresh Prices
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSyncZerodha(true)}
              disabled={syncingZerodha}
              leftIcon={<RefreshCw size={14} className={syncingZerodha ? "animate-spin" : ""} />}
              className="text-xs font-semibold shadow-xs"
            >
              {syncingZerodha ? "Syncing Zerodha Demat..." : "Sync Zerodha Demat"}
            </Button>
          </div>
        }
      />

      {/* 2. Zerodha Demat (CDSL) Custody Status Banner */}
      <div className="rounded-2xl border border-[var(--app-border)] p-4 sm:p-5 bg-[var(--app-card)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold flex-shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[var(--app-fg)] text-sm">Custody & Settlement:</span>
              <span className="font-mono text-emerald-400 font-bold">Zerodha Demat (CDSL)</span>
              <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                DP ID: 12081600
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                Auto-Synced
              </span>
            </div>
            <p className="text-xs text-[var(--app-muted)] mt-0.5">
              All bonds purchased through <strong>IndiaBonds</strong>, <strong>GoldenPi</strong>, or <strong>Zerodha Kite</strong> settle directly into your Zerodha CDSL Demat and are automatically tracked here.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Total Invested"
          value={loading ? <Skeleton className="h-7 w-28 rounded-lg" /> : formatINR(stats.totalInvested)}
          icon={<Wallet size={18} />}
          iconColor="sky"
          subtitle={
            <div className="flex items-center justify-between text-[11px] text-[var(--app-muted)] mt-1">
              <span>Face Value: {formatINR(stats.totalFaceValue)}</span>
              <span>{holdings.length} Holdings</span>
            </div>
          }
        />

        <StatCard
          title="Current Valuation"
          value={loading ? <Skeleton className="h-7 w-28 rounded-lg" /> : formatINR(stats.totalCurrentValue)}
          icon={<TrendingUp size={18} />}
          iconColor={stats.totalPnl >= 0 ? "emerald" : "rose"}
          trend={{
            value: `${stats.totalPnl >= 0 ? "+" : ""}${formatINR(stats.totalPnl)} (${stats.totalReturnPct.toFixed(2)}%)`,
            direction: stats.totalPnl >= 0 ? "up" : "down",
            label: "Unrealized P&L",
          }}
        />

        <StatCard
          title="Annual Coupon Income"
          value={loading ? <Skeleton className="h-7 w-28 rounded-lg" /> : formatINR(stats.totalAnnualInterest)}
          icon={<BadgePercent size={18} />}
          iconColor="emerald"
          subtitle={
            <div className="flex items-center justify-between text-[11px] text-[var(--app-muted)] mt-1">
              <span>Monthly: ~{formatINR(stats.monthlyPassiveIncome)}</span>
              <span className="text-emerald-400 font-semibold">{stats.weightedCouponRate.toFixed(2)}% p.a.</span>
            </div>
          }
        />

        <StatCard
          title="Next Coupon Payout"
          value={
            loading ? (
              <Skeleton className="h-7 w-28 rounded-lg" />
            ) : stats.nextCouponItem ? (
              formatINR(stats.nextCouponItem.expectedPayout)
            ) : (
              "₹0.00"
            )
          }
          icon={<CalendarClock size={18} />}
          iconColor="amber"
          subtitle={
            stats.nextCouponItem ? (
              <div className="truncate text-[11px] text-[var(--app-muted)] mt-1">
                <span className="text-amber-400 font-semibold">
                  {stats.nextCouponDays === 0 ? "Today" : `In ${stats.nextCouponDays} days`}
                </span>
                {" • "}
                <span>{formatDate(stats.nextCouponItem.nextDate)}</span>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--app-muted)]">No upcoming payout</span>
            )
          }
        />
      </div>

      {/* 4. Tab Navigation Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--app-border)] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("holdings")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "holdings"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            Demat Holdings ({holdings.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "calendar"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            <Calendar size={13} />
            Coupon Calendar
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "analytics"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            <BarChart3 size={13} />
            Portfolio Analytics
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "transactions"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            <History size={13} />
            Transactions ({transactions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("knowledge")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "knowledge"
                ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border border-[var(--app-border)] shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            <Sparkles size={13} className="text-amber-400" />
            Demat & Tax Guide
          </button>
        </div>

        {activeTab === "holdings" && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setDisplayMode("table")}
              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                displayMode === "table"
                  ? "bg-[var(--app-card-elevated)] border-[var(--app-border)] text-[var(--app-fg)]"
                  : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-fg)]"
              }`}
              title="Table view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("grid")}
              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                displayMode === "grid"
                  ? "bg-[var(--app-card-elevated)] border-[var(--app-border)] text-[var(--app-fg)]"
                  : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-fg)]"
              }`}
              title="Grid card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        )}
      </div>

      {/* 5. TAB 1: DEMAT HOLDINGS VIEW */}
      {activeTab === "holdings" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
              <input
                type="text"
                placeholder="Search holdings by name, issuer, or ISIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] focus:outline-none focus:border-[var(--app-accent)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-fg)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="CORPORATE">Corporate NCDs</option>
                <option value="GOVERNMENT">Govt G-Secs</option>
                <option value="STATE_DEVELOPMENT">State SDLs</option>
                <option value="SGB">SGBs</option>
                <option value="TAX_FREE">Tax-Free Bonds</option>
              </select>

              {/* Rating Filter */}
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-fg)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Ratings</option>
                <option value="AAA_SOV">AAA & Sovereign</option>
                <option value="AA">AA Series</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs px-2.5 py-2 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-fg)] focus:outline-none cursor-pointer"
              >
                <option value="value_desc">Valuation: High to Low</option>
                <option value="coupon_desc">Coupon: High to Low</option>
                <option value="next_payout_asc">Next Payout: Soonest</option>
                <option value="maturity_asc">Maturity: Soonest</option>
                <option value="name_asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          {/* Holdings Content */}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : filteredHoldings.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={28} className="text-emerald-400" />}
              title={holdings.length === 0 ? "No bond holdings found in Zerodha Demat" : "No matching bonds found"}
              description={
                holdings.length === 0
                  ? "Any Corporate Bonds, NCDs, Sovereign G-Secs, or SGBs purchased on IndiaBonds, GoldenPi, or Zerodha Kite are custodied in your Zerodha CDSL Demat and will appear here automatically upon sync."
                  : "Try clearing your search query or adjusting your filters."
              }
              action={
                <Button
                  variant="primary"
                  onClick={() => handleSyncZerodha(true)}
                  disabled={syncingZerodha}
                  leftIcon={<RefreshCw size={14} className={syncingZerodha ? "animate-spin" : ""} />}
                >
                  {syncingZerodha ? "Syncing Zerodha Demat..." : "Sync Zerodha Demat"}
                </Button>
              }
            />
          ) : displayMode === "table" ? (
            /* TABLE VIEW */
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--app-card-elevated)] border-b border-[var(--app-border)] text-[var(--app-muted)] font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Bond & Issuer</th>
                      <th className="py-3 px-4">Type & Safety</th>
                      <th className="py-3 px-4">Coupon Rate</th>
                      <th className="py-3 px-4">Next Payout</th>
                      <th className="py-3 px-4">Maturity</th>
                      <th className="py-3 px-4 text-right">Holdings</th>
                      <th className="py-3 px-4 text-right">Valuation</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)]">
                    {filteredHoldings.map((b) => {
                      const qty = Number(b.quantity) || 0;
                      const buyPrice = Number(b.avg_buy_price) || 0;
                      const curPrice = Number(b.current_price || buyPrice);
                      const invested = Number(b.invested_amount) > 0 ? Number(b.invested_amount) : qty * buyPrice;
                      const curVal = qty * curPrice;
                      const pnl = curVal - invested;
                      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

                      return (
                        <tr key={b.id} className="hover:bg-[var(--app-card-hover)] transition-colors">
                          {/* 1. Name & Issuer */}
                          <td className="py-3.5 px-4 min-w-[220px]">
                            <div className="space-y-1">
                              <div className="font-semibold text-[var(--app-fg)] text-xs flex items-center gap-1.5">
                                <span>{b.name}</span>
                                {b.tax_status === "TAX_FREE" && (
                                  <Badge variant="violet" size="xs">
                                    Tax-Free
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-2">
                                <span>{b.issuer_name}</span>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyIsin(b.isin)}
                                  className="font-mono text-[10px] text-[var(--app-muted)] hover:text-[var(--app-fg)] flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--app-card-elevated)] border border-[var(--app-border-subtle)] cursor-pointer"
                                  title="Copy ISIN"
                                >
                                  {copiedIsin === b.isin ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                                  <span>{b.isin}</span>
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Zerodha Demat (CDSL)
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Type & Rating */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-[var(--app-fg)]">
                                {b.credit_rating || "CRISIL AAA"}
                              </div>
                              <div className="text-[11px] text-[var(--app-muted)]">
                                {b.bond_type.replace(/_/g, " ")}
                              </div>
                              <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-[var(--app-card-elevated)] text-[var(--app-muted)] border border-[var(--app-border-subtle)]">
                                {b.seniority.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>

                          {/* 3. Coupon Rate & Frequency */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="font-bold text-emerald-400 text-xs">
                                {Number(b.coupon_rate).toFixed(2)}% p.a.
                              </div>
                              <div className="text-[11px] text-[var(--app-muted)]">
                                {b.coupon_frequency.replace(/_/g, " ")}
                              </div>
                              {Number(b.ytm) > 0 && (
                                <div className="text-[10px] text-[var(--app-muted)] font-mono">
                                  YTM: {Number(b.ytm).toFixed(2)}%
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 4. Next Payout */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {b.next_coupon_date ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-amber-400 text-xs">
                                  {formatDate(b.next_coupon_date)}
                                </div>
                                <div className="text-[10px] text-[var(--app-muted)]">
                                  Est: {formatINR(((qty * Number(b.face_value) * Number(b.coupon_rate)) / 100) * (b.coupon_frequency === "MONTHLY" ? 1 / 12 : b.coupon_frequency === "SEMI_ANNUAL" ? 1 / 2 : b.coupon_frequency === "QUARTERLY" ? 1 / 4 : 1))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[var(--app-muted)] text-[11px]">Cumulative</span>
                            )}
                          </td>

                          {/* 5. Maturity */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="font-medium text-[var(--app-fg)] text-xs">
                                {formatDate(b.maturity_date)}
                              </div>
                              <div className="text-[10px] text-[var(--app-muted)]">
                                {Math.max(0, Math.ceil((new Date(b.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365)))} yrs left
                              </div>
                            </div>
                          </td>

                          {/* 6. Holdings */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="font-semibold text-[var(--app-fg)] text-xs">
                                {qty} {qty === 1 ? "unit" : "units"}
                              </div>
                              <div className="text-[10px] text-[var(--app-muted)]">
                                Avg: {formatINR(buyPrice)}
                              </div>
                              <div className="text-[10px] text-[var(--app-muted)]">
                                Face: {formatINR(Number(b.face_value))}
                              </div>
                            </div>
                          </td>

                          {/* 7. Valuation & P&L */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="font-bold text-[var(--app-fg)] text-xs">
                                {formatINR(curVal)}
                              </div>
                              <div
                                className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                                  pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {pnl >= 0 ? "+" : ""}
                                {formatINR(pnl)} ({pnlPct.toFixed(1)}%)
                              </div>
                            </div>
                          </td>

                          {/* 8. Actions (Coupon Payout logging) */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenCouponModal(b)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 h-auto"
                              title="Record interest credit"
                            >
                              <Receipt size={13} className="mr-1" />
                              Log Payout
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredHoldings.map((b) => {
                const qty = Number(b.quantity) || 0;
                const buyPrice = Number(b.avg_buy_price) || 0;
                const curPrice = Number(b.current_price || buyPrice);
                const invested = Number(b.invested_amount) > 0 ? Number(b.invested_amount) : qty * buyPrice;
                const curVal = qty * curPrice;
                const pnl = curVal - invested;
                const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

                return (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 space-y-4 shadow-xs hover:border-[var(--app-border-hover)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-[var(--app-fg)] flex items-center gap-1.5">
                          <span>{b.name}</span>
                          {b.tax_status === "TAX_FREE" && (
                            <Badge variant="violet" size="xs">
                              Tax-Free
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--app-muted)] mt-0.5">{b.issuer_name}</p>
                      </div>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Zerodha Demat
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-2 border-y border-[var(--app-border-subtle)] text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--app-muted)] block">Coupon Rate</span>
                        <span className="font-bold text-emerald-400 text-sm">
                          {Number(b.coupon_rate).toFixed(2)}% p.a.
                        </span>
                        <span className="text-[10px] text-[var(--app-muted)] block">
                          {b.coupon_frequency.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-[var(--app-muted)] block">Valuation</span>
                        <span className="font-bold text-[var(--app-fg)] text-sm">{formatINR(curVal)}</span>
                        <span className={`text-[10px] font-semibold block ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {pnl >= 0 ? "+" : ""}
                          {formatINR(pnl)} ({pnlPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--app-muted)]">
                      <div>
                        <span className="text-[10px] block">Next Payout</span>
                        <span className="font-medium text-amber-400">
                          {b.next_coupon_date ? formatDate(b.next_coupon_date) : "Cumulative"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] block">Maturity</span>
                        <span className="font-medium text-[var(--app-fg)]">{formatDate(b.maturity_date)}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-[var(--app-border-subtle)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyIsin(b.isin)}
                          className="font-mono text-[10px] text-[var(--app-muted)] hover:text-[var(--app-fg)] flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--app-card-elevated)] border border-[var(--app-border-subtle)] cursor-pointer"
                        >
                          {copiedIsin === b.isin ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                          <span>{b.isin}</span>
                        </button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenCouponModal(b)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 h-auto"
                      >
                        Log Payout
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 2: COUPON & INTEREST CASH FLOW CALENDAR */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[var(--app-fg)] flex items-center gap-2">
                  <CalendarClock size={16} className="text-amber-400" />
                  Upcoming Coupon Interest Payouts
                </h3>
                <p className="text-xs text-[var(--app-muted)]">
                  Scheduled interest credits settling to your bank account or Zerodha balance.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-[var(--app-muted)] block uppercase tracking-wider">
                  Annual Passive Cash Flow
                </span>
                <span className="text-base font-bold text-emerald-400">
                  {formatINR(stats.totalAnnualInterest)}
                </span>
              </div>
            </div>

            {stats.upcomingCoupons.length === 0 ? (
              <EmptyState
                icon={<CalendarClock size={28} className="text-amber-400" />}
                title="No coupon dates recorded"
                description="Bonds synced from your Zerodha Demat account will automatically populate this interest payout schedule."
              />
            ) : (
              <div className="divide-y divide-[var(--app-border-subtle)]">
                {stats.upcomingCoupons.map((c, idx) => {
                  const d = new Date(c.nextDate);
                  const daysLeft = Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  const isSoon = daysLeft <= 30;

                  return (
                    <div
                      key={`${c.id}-${idx}`}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--app-card-hover)] px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold border ${
                            isSoon
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-[var(--app-card-elevated)] text-[var(--app-fg)] border-[var(--app-border)]"
                          }`}
                        >
                          <span className="text-[10px] uppercase font-mono">
                            {d.toLocaleString("en-IN", { month: "short" })}
                          </span>
                          <span className="text-base leading-none">{d.getDate()}</span>
                        </div>

                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs text-[var(--app-fg)] flex items-center gap-2">
                            <span>{c.name}</span>
                            <span className="text-[10px] font-normal text-[var(--app-muted)]">({c.isin})</span>
                          </div>
                          <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-2">
                            <span>{c.issuer}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-medium">{c.couponRate}% p.a.</span>
                            <span>•</span>
                            <span>{c.frequency.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-400 block">
                            +{formatINR(c.expectedPayout)}
                          </span>
                          <span className="text-[10px] text-amber-400 font-medium">
                            {daysLeft === 0 ? "Due Today" : `In ${daysLeft} days`}
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const b = holdings.find((h) => h.id === c.id);
                            if (b) handleOpenCouponModal(b);
                          }}
                          leftIcon={<Receipt size={13} />}
                          className="text-xs text-emerald-400 border-emerald-500/30"
                        >
                          Mark Credited
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TAB 3: PORTFOLIO ANALYTICS VIEW */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Bond Type Allocation */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Asset Allocation by Bond Type
            </h3>
            <InteractiveDonutChart
              title="Bond Types"
              totalLabel="Portfolio Value"
              totalValue={stats.totalCurrentValue}
              segments={typeDonutSegments}
              formatter={formatINR}
            />
          </div>

          {/* Chart 2: Credit Safety Breakdown */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Credit Safety & Rating Quality
            </h3>
            <InteractiveDonutChart
              title="Credit Ratings"
              totalLabel="Portfolio Value"
              totalValue={stats.totalCurrentValue}
              segments={ratingDonutSegments}
              formatter={formatINR}
            />
          </div>

          {/* Yield & Duration Metrics */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 space-y-4 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Yield & Performance Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)]">
                <span className="text-[10px] text-[var(--app-muted)] uppercase tracking-wider block">
                  Weighted Coupon Rate
                </span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">
                  {stats.weightedCouponRate.toFixed(2)}%
                </span>
                <span className="text-[11px] text-[var(--app-muted)]">Annualized yield on Face Value</span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)]">
                <span className="text-[10px] text-[var(--app-muted)] uppercase tracking-wider block">
                  Weighted YTM
                </span>
                <span className="text-xl font-bold text-sky-400 mt-1 block">
                  {stats.weightedYtm > 0 ? `${stats.weightedYtm.toFixed(2)}%` : "N/A"}
                </span>
                <span className="text-[11px] text-[var(--app-muted)]">Yield to Maturity</span>
              </div>

              <div className="p-4 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)]">
                <span className="text-[10px] text-[var(--app-muted)] uppercase tracking-wider block">
                  Demat Custody
                </span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">
                  CDSL Zerodha
                </span>
                <span className="text-[11px] text-[var(--app-muted)]">DP ID: 12081600</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. TAB 4: TRANSACTIONS VIEW */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <EmptyState
              icon={<History size={28} className="text-sky-400" />}
              title="No bond transactions recorded"
              description="Historical buys, sales, or coupon payouts will appear here automatically."
            />
          ) : (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--app-card-elevated)] border-b border-[var(--app-border)] text-[var(--app-muted)] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Bond</th>
                    <th className="py-3 px-4">Custody</th>
                    <th className="py-3 px-4 text-right">Units</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border-subtle)]">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[var(--app-card-hover)] transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--app-muted)] whitespace-nowrap">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === "COUPON_PAYOUT"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : tx.type === "BUY"
                              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {tx.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--app-fg)]">{tx.bond_holdings?.name || tx.isin}</div>
                        <div className="text-[10px] text-[var(--app-muted)] font-mono">{tx.isin}</div>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[var(--app-muted)]">
                        Zerodha Demat
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px]">
                        {tx.type === "COUPON_PAYOUT" ? "—" : tx.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-xs whitespace-nowrap">
                        <span className={tx.type === "COUPON_PAYOUT" ? "text-emerald-400" : "text-[var(--app-fg)]"}>
                          {tx.type === "COUPON_PAYOUT" ? "+" : ""}
                          {formatINR(Number(tx.amount))}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[var(--app-muted)] max-w-xs truncate">
                        {tx.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 9. TAB 5: DEMAT & TAX GUIDE */}
      {activeTab === "knowledge" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 space-y-3">
            <div className="flex items-center gap-2 text-sky-400">
              <Landmark size={18} />
              <h3 className="font-bold text-sm text-[var(--app-fg)]">How IndiaBonds & GoldenPi Settle into Zerodha</h3>
            </div>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
              When investing in bonds or debentures via SEBI-regulated Online Bond Platform Providers (OBPP) like IndiaBonds or GoldenPi:
            </p>
            <ul className="text-xs text-[var(--app-muted)] space-y-1.5 list-disc pl-4">
              <li>
                You link your existing <strong>Zerodha Demat Account</strong> (CDSL DP ID: <code>12081600</code>).
              </li>
              <li>
                Trade clearing and settlement occurs via Indian clearing corporations (ICCL / NSCCL).
              </li>
              <li>
                All units are credited directly to your CDSL Zerodha Demat and reflected in your Kite portfolio automatically.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <BadgePercent size={18} />
              <h3 className="font-bold text-sm text-[var(--app-fg)]">Taxation on Bond Interest in India</h3>
            </div>
            <ul className="text-xs text-[var(--app-muted)] space-y-2">
              <li className="p-2.5 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)]">
                <strong className="text-[var(--app-fg)]">Listed Corporate Bonds & NCDs:</strong> Coupon interest is taxed at your income tax slab rate under "Income from Other Sources". TDS of 10% applies under Section 193.
              </li>
              <li className="p-2.5 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)]">
                <strong className="text-[var(--app-fg)]">Tax-Free PSU Bonds:</strong> Coupon interest from designated bonds (NHAI, REC, PFC, IRFC) is 100% tax-free under Section 10(15)(iv)(h) with zero TDS.
              </li>
              <li className="p-2.5 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)]">
                <strong className="text-[var(--app-fg)]">Sovereign Gold Bonds (SGB):</strong> 2.50% annual interest is taxable at slab rate. Capital gains on redemption upon maturity are 100% tax-free.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* 10. LIGHTWEIGHT MODAL: LOG COUPON INTEREST CREDITED */}
      <Modal
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        title="Record Interest Received"
        description="Log coupon payment credited to your bank account or Zerodha balance."
        size="md"
      >
        {selectedHoldingForCoupon && (
          <form onSubmit={handleSaveCouponPayout} className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] space-y-0.5">
              <span className="font-semibold text-xs text-[var(--app-fg)]">
                {selectedHoldingForCoupon.name}
              </span>
              <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-1.5">
                <span>Coupon: {selectedHoldingForCoupon.coupon_rate}% p.a.</span>
                <span>•</span>
                <span>{selectedHoldingForCoupon.coupon_frequency}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                label="Interest Received (₹) *"
                type="number"
                step="any"
                value={couponPayoutAmount}
                onChange={(e) => setCouponPayoutAmount(Number(e.target.value))}
                required
                autoFocus
              />

              <Input
                label="Payout Credit Date *"
                type="date"
                value={couponPayoutDate}
                onChange={(e) => setCouponPayoutDate(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                id="advanceCoupon"
                checked={autoAdvanceCoupon}
                onChange={(e) => setAutoAdvanceCoupon(e.target.checked)}
                className="rounded accent-[var(--app-accent)]"
              />
              <label htmlFor="advanceCoupon" className="text-xs text-[var(--app-fg)] cursor-pointer">
                Automatically advance next coupon date ({selectedHoldingForCoupon.coupon_frequency})
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border)]">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCouponModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={savingTransaction}>
                {savingTransaction ? "Recording..." : "Confirm & Save"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}
