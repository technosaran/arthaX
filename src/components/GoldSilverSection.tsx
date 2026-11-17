"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Gem,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Lock,
  Home,
  Cloud,
  Copy,
  Check,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Scale,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  Calendar,
  CreditCard,
  Building,
  Activity,
  Award,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import {
  BullionHolding,
  BullionTransaction,
  BullionRates,
  MetalType,
  BullionItemType,
  StorageLocation,
  calculateHoldingMetrics,
  calculatePortfolioSummary,
  getStandardPurityPercentage,
  formatCurrencyINR,
  gramsToTolas,
  gramsToSovereigns,
} from "@/utils/bullionCalculations";

const DEFAULT_RATES: BullionRates = {
  gold24kPerGram: 11000,
  gold22kPerGram: 10083,
  gold18kPerGram: 8250,
  gold14kPerGram: 6417,
  silver999PerGram: 160,
  silver925PerGram: 148,
  goldChange24h: 35,
  goldChangePercent24h: 0.32,
  silverChange24h: 1.2,
  silverChangePercent24h: 0.75,
  goldToSilverRatio: 68.75,
  usdinr: 93.46,
  goldUsdPerOz: 3865,
  silverUsdPerOz: 47.5,
  dayHighGold24k: 11100,
  dayLowGold24k: 10920,
  dayHighSilver999: 162.5,
  dayLowSilver999: 158.0,
  lastUpdated: new Date().toISOString(),
  marketStatus: {
    isOpen: true,
    phase: "LIVE",
    message: "Bullion spot & futures trading is active (MCX / COMEX Live).",
  },
};

const GOLD_PURITY_OPTIONS = [
  { value: "24K", label: "24K (99.9% Pure Bullion)" },
  { value: "22K", label: "22K (91.6% Hallmark Indian Gold)" },
  { value: "18K", label: "18K (75.0% Diamond / Stone Jewelry)" },
  { value: "14K", label: "14K (58.3% Daily Jewelry)" },
];

const SILVER_PURITY_OPTIONS = [
  { value: "999", label: "999 (99.9% Fine Bullion / Coin)" },
  { value: "925", label: "925 (92.5% Sterling Silver)" },
  { value: "9999", label: "999.9 (Minted Investment Bar)" },
];

const ITEM_TYPE_OPTIONS = [
  { value: "COIN", label: "Minted Coin" },
  { value: "BAR", label: "Investment Bar" },
  { value: "JEWELRY", label: "Hallmarked Jewelry" },
  { value: "SOVEREIGN", label: "Sovereign / Pavan (8g)" },
  { value: "UTENSIL", label: "Utensil / Puja Item" },
  { value: "BULLION", label: "Raw Bullion" },
  { value: "OTHER", label: "Other Asset" },
];

const STORAGE_OPTIONS = [
  { value: "Home Safe", label: "Home Safe" },
  { value: "Bank Locker", label: "Bank Safe Deposit Locker" },
  { value: "Digital Vault", label: "Custodial Vault / Digital Vault" },
  { value: "Custom", label: "Other Location" },
];

export default function GoldSilverSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Core State
  const [holdings, setHoldings] = useState<BullionHolding[]>([]);
  const [transactions, setTransactions] = useState<BullionTransaction[]>([]);
  const [rates, setRates] = useState<BullionRates>(DEFAULT_RATES);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; balance: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingRates, setRefreshingRates] = useState(false);

  // Filters & View State
  const [metalFilter, setMetalFilter] = useState<"ALL" | "GOLD" | "SILVER">("ALL");
  const [storageFilter, setStorageFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<BullionHolding | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Add / Edit
  const [formMetal, setFormMetal] = useState<MetalType>("GOLD");
  const [formName, setFormName] = useState("");
  const [formItemType, setFormItemType] = useState<BullionItemType>("COIN");
  const [formPurity, setFormPurity] = useState("24K");
  const [formWeightGrams, setFormWeightGrams] = useState<string>("");
  const [formQuantity, setFormQuantity] = useState<string>("1");
  const [formBuyPricePerGram, setFormBuyPricePerGram] = useState<string>("");
  const [formMakingCharges, setFormMakingCharges] = useState<string>("0");
  const [formTaxGst, setFormTaxGst] = useState<string>("0");
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [formStorageLocation, setFormStorageLocation] = useState<string>("Home Safe");
  const [formCertId, setFormCertId] = useState("");
  const [formAccountId, setFormAccountId] = useState<string>("");
  const [formNotes, setFormNotes] = useState("");

  // Sell Modal State
  const [sellWeight, setSellWeight] = useState<string>("");
  const [sellPricePerGram, setSellPricePerGram] = useState<string>("");
  const [sellDate, setSellDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [sellNotes, setSellNotes] = useState("");

  // 1. Fetch Real-time Bullion Rates
  const fetchRates = useCallback(
    async (force = false) => {
      try {
        setRefreshingRates(true);
        const url = `/api/v1/bullion/rates${force ? "?refresh=true" : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.rates) {
            setRates(data.rates);
          }
          if (force) {
            showToast("Rates Updated", "Live spot prices refreshed successfully", "success");
          }
        }
      } catch (err) {
        console.error("[Bullion Rates] Refresh failed:", err);
        if (force) {
          showToast("Refresh Failed", "Could not fetch latest bullion spot rates", "error");
        }
      } finally {
        setRefreshingRates(false);
      }
    },
    [showToast]
  );

  // 2. Fetch Holdings & Transactions
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [holdingsRes, accountsRes] = await Promise.all([
        fetch("/api/v1/bullion/holdings"),
        supabase.from("accounts").select("id, name, balance").order("name", { ascending: true }),
      ]);

      if (accountsRes.data) {
        setAccounts(accountsRes.data);
      }

      if (holdingsRes.ok) {
        const json = await holdingsRes.json();
        setHoldings(json.holdings || []);
        setTransactions(json.transactions || []);
      }
    } catch (err) {
      console.error("[Bullion] Error fetching portfolio:", err);
      showToast("Error", "Failed to load physical bullion holdings", "error");
    } finally {
      setLoading(false);
    }
  }, [user, supabase, showToast]);

  useEffect(() => {
    fetchRates();
    fetchData();
  }, [fetchRates, fetchData]);

  // 3. Supabase Realtime Subscription for live multi-tab updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("bullion_holdings_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bullion_holdings",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, fetchData]);

  // Portfolio Summary
  const summary = useMemo(() => {
    return calculatePortfolioSummary(holdings, rates);
  }, [holdings, rates]);

  // Filtered Holdings
  const filteredHoldings = useMemo(() => {
    return holdings.filter((item) => {
      if (metalFilter !== "ALL" && item.metal !== metalFilter) return false;
      if (storageFilter !== "ALL" && item.storage_location !== storageFilter) return false;
      if (typeFilter !== "ALL" && item.item_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.name.toLowerCase().includes(q);
        const certMatch = item.cert_id?.toLowerCase().includes(q);
        const notesMatch = item.notes?.toLowerCase().includes(q);
        const purityMatch = item.purity.toLowerCase().includes(q);
        return nameMatch || certMatch || notesMatch || purityMatch;
      }
      return true;
    });
  }, [holdings, metalFilter, storageFilter, typeFilter, searchQuery]);

  // Donut Chart Segments
  const donutSegments: DonutSegment[] = useMemo(() => {
    const list: DonutSegment[] = [];
    if (summary.gold.currentValue > 0) {
      list.push({
        label: "Gold Assets",
        value: summary.gold.currentValue,
        color: "#f59e0b", // Amber/Gold
        subtitle: `${summary.gold.totalWeightGrams.toFixed(1)}g (${summary.gold.weightInSovereigns.toFixed(1)} Sov)`,
      });
    }
    if (summary.silver.currentValue > 0) {
      list.push({
        label: "Silver Assets",
        value: summary.silver.currentValue,
        color: "#94a3b8", // Slate/Silver
        subtitle: `${summary.silver.totalWeightGrams.toFixed(1)}g (${summary.silver.weightInKg.toFixed(2)} kg)`,
      });
    }
    return list;
  }, [summary]);

  // Preset Auto-fill for Buy Price when metal/purity changes
  const handleMetalChange = (metal: MetalType) => {
    setFormMetal(metal);
    if (metal === "GOLD") {
      setFormPurity("24K");
      setFormBuyPricePerGram(rates.gold24kPerGram.toString());
    } else {
      setFormPurity("999");
      setFormBuyPricePerGram(rates.silver999PerGram.toString());
    }
  };

  const handlePurityChange = (purity: string) => {
    setFormPurity(purity);
    if (formMetal === "GOLD") {
      if (purity === "24K") setFormBuyPricePerGram(rates.gold24kPerGram.toString());
      else if (purity === "22K") setFormBuyPricePerGram(rates.gold22kPerGram.toString());
      else if (purity === "18K") setFormBuyPricePerGram(rates.gold18kPerGram.toString());
      else if (purity === "14K") setFormBuyPricePerGram(rates.gold14kPerGram.toString());
    } else {
      if (purity === "999" || purity === "9999") setFormBuyPricePerGram(rates.silver999PerGram.toString());
      else if (purity === "925") setFormBuyPricePerGram(rates.silver925PerGram.toString());
    }
  };

  // Open Add Modal with fresh default values
  const openAddModal = (presetMetal: MetalType = "GOLD") => {
    setFormMetal(presetMetal);
    setFormName("");
    setFormItemType("COIN");
    setFormPurity(presetMetal === "GOLD" ? "24K" : "999");
    setFormWeightGrams("");
    setFormQuantity("1");
    setFormBuyPricePerGram(
      presetMetal === "GOLD" ? rates.gold24kPerGram.toString() : rates.silver999PerGram.toString()
    );
    setFormMakingCharges("0");
    setFormTaxGst("0");
    setFormPurchaseDate(new Date().toISOString().split("T")[0]);
    setFormStorageLocation("Home Safe");
    setFormCertId("");
    setFormAccountId("");
    setFormNotes("");
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (holding: BullionHolding) => {
    setSelectedHolding(holding);
    setFormMetal(holding.metal);
    setFormName(holding.name);
    setFormItemType(holding.item_type);
    setFormPurity(holding.purity);
    setFormWeightGrams(holding.weight_grams.toString());
    setFormQuantity(holding.quantity.toString());
    setFormBuyPricePerGram(holding.buy_price_per_gram.toString());
    setFormMakingCharges(holding.making_charges.toString());
    setFormTaxGst(holding.tax_gst.toString());
    setFormPurchaseDate(holding.purchase_date);
    setFormStorageLocation(holding.storage_location);
    setFormCertId(holding.cert_id || "");
    setFormAccountId(holding.account_id || "");
    setFormNotes(holding.notes || "");
    setIsEditModalOpen(true);
  };

  // Open Sell Modal
  const openSellModal = (holding: BullionHolding) => {
    setSelectedHolding(holding);
    const metrics = calculateHoldingMetrics(holding, rates);
    setSellWeight(metrics.totalWeight.toString());
    setSellPricePerGram(metrics.currentRatePerGram.toString());
    setSellDate(new Date().toISOString().split("T")[0]);
    setSellNotes("");
    setIsSellModalOpen(true);
  };

  // Save New Asset
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("Validation Error", "Please provide a name for this asset", "error");
      return;
    }
    const weight = parseFloat(formWeightGrams);
    if (isNaN(weight) || weight <= 0) {
      showToast("Validation Error", "Please enter a valid weight in grams", "error");
      return;
    }
    const buyPrice = parseFloat(formBuyPricePerGram);
    if (isNaN(buyPrice) || buyPrice < 0) {
      showToast("Validation Error", "Please enter a valid buy price per gram", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/bullion/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metal: formMetal,
          name: formName.trim(),
          item_type: formItemType,
          purity: formPurity,
          purity_percentage: getStandardPurityPercentage(formMetal, formPurity),
          weight_grams: weight,
          quantity: parseFloat(formQuantity) || 1,
          buy_price_per_gram: buyPrice,
          making_charges: parseFloat(formMakingCharges) || 0,
          tax_gst: parseFloat(formTaxGst) || 0,
          purchase_date: formPurchaseDate,
          storage_location: formStorageLocation,
          cert_id: formCertId.trim() || null,
          account_id: formAccountId || null,
          notes: formNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to add asset");
      }

      showToast("Asset Added", `${formName} recorded successfully`, "success");
      setIsAddModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving asset";
      showToast("Error", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHolding) return;

    const weight = parseFloat(formWeightGrams);
    if (isNaN(weight) || weight <= 0) {
      showToast("Validation Error", "Weight must be greater than 0", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/bullion/holdings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedHolding.id,
          metal: formMetal,
          name: formName.trim(),
          item_type: formItemType,
          purity: formPurity,
          purity_percentage: getStandardPurityPercentage(formMetal, formPurity),
          weight_grams: weight,
          quantity: parseFloat(formQuantity) || 1,
          buy_price_per_gram: parseFloat(formBuyPricePerGram) || 0,
          making_charges: parseFloat(formMakingCharges) || 0,
          tax_gst: parseFloat(formTaxGst) || 0,
          purchase_date: formPurchaseDate,
          storage_location: formStorageLocation,
          cert_id: formCertId.trim() || null,
          account_id: formAccountId || null,
          notes: formNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update holding");
      }

      showToast("Updated", "Asset details updated successfully", "success");
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error updating asset";
      showToast("Error", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Sell Transaction
  const handleSaveSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHolding) return;

    const weight = parseFloat(sellWeight);
    if (isNaN(weight) || weight <= 0) {
      showToast("Validation Error", "Please enter a valid weight to sell", "error");
      return;
    }

    const price = parseFloat(sellPricePerGram);
    if (isNaN(price) || price <= 0) {
      showToast("Validation Error", "Please enter a valid selling price per gram", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/bullion/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holding_id: selectedHolding.id,
          metal: selectedHolding.metal,
          type: "SELL",
          weight_grams: weight,
          price_per_gram: price,
          transaction_date: sellDate,
          notes: sellNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to record sale");
      }

      showToast("Sale Recorded", `Sold ${weight}g at ₹${price}/g`, "success");
      setIsSellModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error executing sale";
      showToast("Error", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Holding
  const handleDeleteHolding = async () => {
    if (!selectedHolding) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/bullion/holdings?id=${selectedHolding.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete holding");
      }

      showToast("Asset Removed", "Physical asset removed from tracker", "info");
      setIsDeleteModalOpen(false);
      setSelectedHolding(null);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error deleting asset";
      showToast("Error", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Copy Hallmark / HUID to Clipboard
  const handleCopyCert = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied", `Hallmark ID ${text} copied to clipboard`, "info");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Physical Gold & Silver"
        description="Real-time valuation of your physical bullion, coins, bars, and hallmarked jewelry with live spot rates."
        icon={<Gem size={26} className="text-amber-400" />}
        badge={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Spot Feed</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRates(true)}
              disabled={refreshingRates}
              className="gap-1.5"
            >
              <RefreshCw size={14} className={refreshingRates ? "animate-spin text-amber-400" : ""} />
              <span>Refresh Rates</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => openAddModal("GOLD")}
              className="gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-md shadow-amber-500/20"
            >
              <Plus size={15} />
              <span>Add Metal Asset</span>
            </Button>
          </div>
        }
      />

      {/* 2. LIVE SPOT RATES BANNER */}
      <div
        className="rounded-2xl p-4 sm:p-5 border relative overflow-hidden backdrop-blur-xl transition-all shadow-sm"
        style={{
          backgroundColor: "var(--app-card)",
          borderColor: "var(--app-border)",
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
              <Activity size={14} className="text-amber-400" />
              <span>Live Bullion Benchmarks</span>
            </div>
            <span className="text-[var(--app-border)]">|</span>
            <span className="text-xs text-[var(--app-muted)]">
              USD/INR: <span className="font-mono text-[var(--app-fg)] font-semibold">₹{rates.usdinr}</span>
            </span>
            <span className="text-[var(--app-border)]">|</span>
            <span className="text-xs text-[var(--app-muted)]">
              Gold/Silver Ratio:{" "}
              <span className="font-mono text-amber-400 font-semibold">{rates.goldToSilverRatio} : 1</span>
            </span>
            {rates.marketStatus && (
              <Badge variant={rates.marketStatus.isOpen ? "success" : "neutral"} size="sm">
                {rates.marketStatus.phase}
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-[var(--app-muted)] font-mono">
            Updated: {new Date(rates.lastUpdated).toLocaleTimeString("en-IN")}
          </div>
        </div>

        {/* Live Rate Badges Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[var(--app-border)]">
          {/* 24K Gold */}
          <div className="p-3 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400">Gold 24K (99.9%)</span>
              <span
                className={`text-[10px] font-mono font-bold flex items-center ${
                  rates.goldChangePercent24h >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {rates.goldChangePercent24h >= 0 ? "+" : ""}
                {rates.goldChangePercent24h}%
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[var(--app-fg)] tabular-nums">
              {formatCurrencyINR(rates.gold24kPerGram)}
              <span className="text-xs text-[var(--app-muted)] font-normal"> /g</span>
            </div>
            <div className="text-[10px] text-[var(--app-muted)] font-mono">
              ₹{(rates.gold24kPerGram * 10).toLocaleString("en-IN")} per 10g
            </div>
          </div>

          {/* 22K Gold Hallmark */}
          <div className="p-3 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-500">Gold 22K (91.6%)</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">Hallmark</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[var(--app-fg)] tabular-nums">
              {formatCurrencyINR(rates.gold22kPerGram)}
              <span className="text-xs text-[var(--app-muted)] font-normal"> /g</span>
            </div>
            <div className="text-[10px] text-[var(--app-muted)] font-mono">
              ₹{(rates.gold22kPerGram * 10).toLocaleString("en-IN")} per 10g
            </div>
          </div>

          {/* 999 Fine Silver */}
          <div className="p-3 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Silver 999 (Fine)</span>
              <span
                className={`text-[10px] font-mono font-bold flex items-center ${
                  rates.silverChangePercent24h >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {rates.silverChangePercent24h >= 0 ? "+" : ""}
                {rates.silverChangePercent24h}%
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[var(--app-fg)] tabular-nums">
              {formatCurrencyINR(rates.silver999PerGram)}
              <span className="text-xs text-[var(--app-muted)] font-normal"> /g</span>
            </div>
            <div className="text-[10px] text-[var(--app-muted)] font-mono">
              ₹{(rates.silver999PerGram * 1000).toLocaleString("en-IN")} per 1 kg
            </div>
          </div>

          {/* 925 Sterling Silver */}
          <div className="p-3 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400">Silver 925 (Sterling)</span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">Jewelry</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[var(--app-fg)] tabular-nums">
              {formatCurrencyINR(rates.silver925PerGram)}
              <span className="text-xs text-[var(--app-muted)] font-normal"> /g</span>
            </div>
            <div className="text-[10px] text-[var(--app-muted)] font-mono">
              ₹{(rates.silver925PerGram * 1000).toLocaleString("en-IN")} per 1 kg
            </div>
          </div>
        </div>
      </div>

      {/* 3. EXECUTIVE STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Bullion Net Worth */}
        <StatCard
          title="Total Precious Metals Value"
          value={formatCurrencyINR(summary.totalCurrentValue)}
          icon={<Gem size={20} className="text-amber-400" />}
          iconColor="amber"
          trend={{
            value: `${summary.totalReturnPercent >= 0 ? "+" : ""}${summary.totalReturnPercent}%`,
            direction: summary.totalReturnPercent >= 0 ? "up" : "down",
            label: "overall return",
          }}
          subtitle={
            <div className="text-xs text-[var(--app-muted)]">
              Invested:{" "}
              <span className="font-mono font-medium text-[var(--app-fg)]">
                {formatCurrencyINR(summary.totalInvested)}
              </span>
            </div>
          }
        />

        {/* Physical Gold Reserve */}
        <StatCard
          title="Physical Gold Reserve"
          value={formatCurrencyINR(summary.gold.currentValue)}
          icon={<Award size={20} className="text-amber-400" />}
          iconColor="amber"
          subtitle={
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-amber-400">
                {summary.gold.totalWeightGrams.toFixed(2)} g Total
              </div>
              <div className="text-[11px] text-[var(--app-muted)]">
                {summary.gold.weightInSovereigns.toFixed(2)} Sovereigns • {summary.gold.weightInTolas.toFixed(2)} Tolas
              </div>
            </div>
          }
        />

        {/* Physical Silver Reserve */}
        <StatCard
          title="Physical Silver Reserve"
          value={formatCurrencyINR(summary.silver.currentValue)}
          icon={<Scale size={20} className="text-slate-300" />}
          iconColor="neutral"
          subtitle={
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-300">
                {summary.silver.totalWeightGrams >= 1000
                  ? `${summary.silver.weightInKg.toFixed(3)} kg`
                  : `${summary.silver.totalWeightGrams.toFixed(1)} g`}
              </div>
              <div className="text-[11px] text-[var(--app-muted)]">
                {summary.silver.weightInTolas.toFixed(2)} Tolas • {summary.silver.itemCount} Items
              </div>
            </div>
          }
        />

        {/* Unrealized Gain / Loss */}
        <StatCard
          title="Net Unrealized P&L"
          value={
            <span className={summary.totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {summary.totalUnrealizedPnL >= 0 ? "+" : ""}
              {formatCurrencyINR(summary.totalUnrealizedPnL)}
            </span>
          }
          icon={
            summary.totalUnrealizedPnL >= 0 ? (
              <TrendingUp size={20} className="text-emerald-400" />
            ) : (
              <TrendingDown size={20} className="text-rose-400" />
            )
          }
          iconColor={summary.totalUnrealizedPnL >= 0 ? "emerald" : "rose"}
          subtitle={
            <div className="text-xs text-[var(--app-muted)]">
              {summary.totalUnrealizedPnL >= 0 ? "Profitable holding position" : "Market cost basis below current value"}
            </div>
          }
        />
      </div>

      {/* 4. VISUAL ALLOCATION & VAULT STORAGE BREAKDOWN */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Donut Chart: Gold vs Silver Asset Split */}
          <div className="lg:col-span-5">
            <InteractiveDonutChart
              title="Metals Allocation"
              totalLabel="Portfolio Value"
              totalValue={summary.totalCurrentValue}
              segments={donutSegments}
              formatter={formatCurrencyINR}
              icon={<Gem size={18} className="text-amber-400" />}
            />
          </div>

          {/* Storage Vault Breakdown & Security Distribution */}
          <div className="lg:col-span-7">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck size={18} className="text-emerald-400" />
                      <span>Physical Custody & Storage Distribution</span>
                    </CardTitle>
                    <CardDescription>
                      Where your physical gold and silver assets are safely stored.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(summary.byStorage).map(([location, data]) => {
                    const isBank = location.toLowerCase().includes("bank");
                    const isHome = location.toLowerCase().includes("home");
                    const isVault = location.toLowerCase().includes("vault");

                    return (
                      <div
                        key={location}
                        className="p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-elevated)] space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-2 font-semibold text-[var(--app-fg)]">
                            {isBank && <Lock size={15} className="text-sky-400" />}
                            {isHome && <Home size={15} className="text-emerald-400" />}
                            {isVault && <Cloud size={15} className="text-violet-400" />}
                            {!isBank && !isHome && !isVault && <Building size={15} className="text-amber-400" />}
                            <span>{location}</span>
                            <span className="text-xs text-[var(--app-muted)] font-normal">
                              ({data.count} {data.count === 1 ? "asset" : "assets"})
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-[var(--app-fg)]">
                              {formatCurrencyINR(data.totalValue)}
                            </span>
                            <span className="ml-2 text-xs text-[var(--app-muted)] font-mono">
                              ({data.percent}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[var(--app-track-bg)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isBank ? "bg-sky-400" : isHome ? "bg-emerald-400" : "bg-violet-400"
                            }`}
                            style={{ width: `${data.percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 5. HOLDINGS MANAGEMENT SECTION */}
      <div className="space-y-4">
        {/* Controls Bar: Filter by metal, storage, search, and layout toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <SegmentedControl
              value={metalFilter}
              onChange={(val) => setMetalFilter(val as "ALL" | "GOLD" | "SILVER")}
              options={[
                { value: "ALL", label: `All (${holdings.length})` },
                { value: "GOLD", label: `Gold (${summary.gold.itemCount})` },
                { value: "SILVER", label: `Silver (${summary.silver.itemCount})` },
              ]}
              size="sm"
            />

            {/* Storage Filter */}
            <select
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-xs text-[var(--app-fg)] focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Storage Locations</option>
              <option value="Home Safe">Home Safe</option>
              <option value="Bank Locker">Bank Locker</option>
              <option value="Digital Vault">Digital Vault</option>
            </select>

            {/* Form Factor Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-xs text-[var(--app-fg)] focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Asset Types</option>
              <option value="COIN">Coins</option>
              <option value="BAR">Bars</option>
              <option value="JEWELRY">Jewelry</option>
              <option value="SOVEREIGN">Sovereigns</option>
              <option value="UTENSIL">Utensils</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative w-48 sm:w-64">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search asset, HUID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-xs text-[var(--app-fg)] focus:outline-hidden focus:border-[var(--app-accent)]"
              />
            </div>
          </div>
        </div>

        {/* 6. HOLDINGS DISPLAY (Grid or Empty State) */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : filteredHoldings.length === 0 ? (
          <EmptyState
            icon={<Gem size={24} className="text-amber-400" />}
            title={holdings.length === 0 ? "No physical gold or silver added yet" : "No matching assets found"}
            description={
              holdings.length === 0
                ? "Start tracking your physical gold coins, bars, sovereigns, and hallmarked jewelry with live real-time valuation."
                : "Try adjusting your search query or filters to find what you're looking for."
            }
            action={
              holdings.length === 0 ? (
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openAddModal("GOLD")}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Plus size={14} className="mr-1.5" />
                    Add Gold Asset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddModal("SILVER")}
                  >
                    <Plus size={14} className="mr-1.5" />
                    Add Silver Asset
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredHoldings.map((item) => {
              const metrics = calculateHoldingMetrics(item, rates);
              const isGold = item.metal === "GOLD";

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border transition-all duration-200 overflow-hidden relative group hover:border-[var(--app-border-hover)] hover:shadow-md flex flex-col justify-between"
                  style={{
                    backgroundColor: "var(--app-card)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  {/* Metallic Header Bar */}
                  <div
                    className={`h-1.5 w-full ${
                      isGold
                        ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500"
                        : "bg-gradient-to-r from-slate-400 via-gray-200 to-slate-500"
                    }`}
                  />

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Top Row: Metal / Purity & Action Buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              isGold
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                : "bg-slate-400/15 text-slate-300 border border-slate-400/25"
                            }`}
                          >
                            {item.metal} • {item.purity}
                          </span>

                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--app-card-elevated)] text-[var(--app-muted)] border border-[var(--app-border)]">
                            {item.item_type}
                          </span>
                        </div>

                        <h3 className="font-bold text-base text-[var(--app-fg)] line-clamp-1" title={item.name}>
                          {item.name}
                        </h3>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openSellModal(item)}
                          className="p-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-elevated)] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-[var(--app-muted)] hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Record Sale"
                        >
                          <DollarSign size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-elevated)] hover:bg-[var(--app-card-hover)] text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-colors cursor-pointer"
                          title="Edit Asset"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHolding(item);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-elevated)] hover:bg-rose-500/10 hover:border-rose-500/30 text-[var(--app-muted)] hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Asset"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Weight & Customary Unit Conversions */}
                    <div className="p-3 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--app-muted)]">
                          Physical Weight
                        </div>
                        <div className="text-base font-extrabold font-mono text-[var(--app-fg)]">
                          {metrics.totalWeight.toFixed(2)} g
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-[var(--app-muted)] font-mono">
                        {isGold && (
                          <>
                            <div>{metrics.weightInSovereigns.toFixed(2)} Sovereigns</div>
                            <div>{metrics.weightInTolas.toFixed(2)} Tolas</div>
                          </>
                        )}
                        {!isGold && (
                          <>
                            <div>{metrics.weightInKg.toFixed(3)} kg</div>
                            <div>{metrics.weightInTolas.toFixed(2)} Tolas</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Financial Valuation */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--app-border)]">
                      <div>
                        <div className="text-[10px] text-[var(--app-muted)]">Purchase Cost</div>
                        <div className="text-xs font-mono font-semibold text-[var(--app-fg)]">
                          {formatCurrencyINR(metrics.investedAmount)}
                        </div>
                        <div className="text-[10px] text-[var(--app-muted)] font-mono">
                          ₹{item.buy_price_per_gram}/g
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-[var(--app-muted)]">Current Live Value</div>
                        <div className="text-sm font-mono font-extrabold text-[var(--app-fg)]">
                          {formatCurrencyINR(metrics.currentValue)}
                        </div>
                        <div
                          className={`text-[10px] font-mono font-bold ${
                            metrics.isProfit ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {metrics.isProfit ? "+" : ""}
                          {formatCurrencyINR(metrics.unrealizedPnL)} ({metrics.returnPercent}%)
                        </div>
                      </div>
                    </div>

                    {/* Bottom Metadata: Storage & Hallmark HUID */}
                    <div className="flex items-center justify-between text-[11px] text-[var(--app-muted)] pt-2 border-t border-[var(--app-border)]">
                      <div className="flex items-center gap-1.5 truncate">
                        <Lock size={12} className="text-sky-400 flex-shrink-0" />
                        <span className="truncate">{item.storage_location}</span>
                      </div>

                      {item.cert_id ? (
                        <button
                          type="button"
                          onClick={() => handleCopyCert(item.cert_id!, item.id)}
                          className="flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-card-elevated)] border border-[var(--app-border)] hover:text-[var(--app-fg)] transition-colors cursor-pointer"
                          title="Click to copy Hallmark HUID"
                        >
                          {copiedId === item.id ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                          <span>{item.cert_id}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono opacity-60">
                          {item.purchase_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. MODAL: ADD PHYSICAL ASSET */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Physical Bullion Asset"
        description="Record physical gold or silver bars, coins, sovereigns, or jewelry."
        size="md"
      >
        <form onSubmit={handleSaveAdd} className="space-y-2.5">
          {/* Row 1: Metal Choice & Form Factor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold tracking-tight text-[var(--app-fg)] mb-1 select-none">
                Precious Metal
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleMetalChange("GOLD")}
                  className={`py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                    formMetal === "GOLD"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-xs"
                      : "border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  <Gem size={13} className="text-amber-400" />
                  <span>Gold</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleMetalChange("SILVER")}
                  className={`py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                    formMetal === "SILVER"
                      ? "bg-slate-400/20 border-slate-400/40 text-slate-200 shadow-xs"
                      : "border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  <Scale size={13} className="text-slate-300" />
                  <span>Silver</span>
                </button>
              </div>
            </div>

            <Select
              label="Form Factor / Item Type"
              value={formItemType}
              onChange={(e) => setFormItemType(e.target.value as BullionItemType)}
              options={ITEM_TYPE_OPTIONS}
            />
          </div>

          {/* Row 2: Asset Name & Purity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Asset Description / Name *"
              placeholder={formMetal === "GOLD" ? "e.g., 24K Gold Bar 10g" : "e.g., 999 Silver Coin 50g"}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />

            <Select
              label="Purity Grade"
              value={formPurity}
              onChange={(e) => handlePurityChange(e.target.value)}
              options={formMetal === "GOLD" ? GOLD_PURITY_OPTIONS : SILVER_PURITY_OPTIONS}
            />
          </div>

          {/* Row 3: Weight & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Weight in Grams *"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="e.g. 10.000"
              value={formWeightGrams}
              onChange={(e) => setFormWeightGrams(e.target.value)}
              required
            />

            <Input
              label="Quantity *"
              type="number"
              min="1"
              step="1"
              value={formQuantity}
              onChange={(e) => setFormQuantity(e.target.value)}
              required
            />
          </div>

          {/* Row 4: Buy Rate & Purchase Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Buy Rate (₹ / gram) *"
              type="number"
              step="0.01"
              value={formBuyPricePerGram}
              onChange={(e) => setFormBuyPricePerGram(e.target.value)}
              required
            />

            <Input
              label="Purchase Date"
              type="date"
              value={formPurchaseDate}
              onChange={(e) => setFormPurchaseDate(e.target.value)}
              required
            />
          </div>

          {/* Total Cost Calculation Summary */}
          {formWeightGrams && formBuyPricePerGram && (
            <div className="p-2.5 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] flex items-center justify-between text-xs">
              <span className="text-[var(--app-muted)]">Total Purchase Cost Preview:</span>
              <span className="font-bold font-mono text-[var(--app-fg)]">
                {formatCurrencyINR(
                  (parseFloat(formWeightGrams) || 0) *
                    (parseFloat(formQuantity) || 1) *
                    (parseFloat(formBuyPricePerGram) || 0)
                )}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border)]">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {submitting ? "Saving..." : "Add to Portfolio"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. MODAL: RECORD SALE / SELL */}
      <Modal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        title="Record Precious Metal Sale"
        description="Liquidate or sell physical metal at spot rate or dealer price."
        size="md"
      >
        <form onSubmit={handleSaveSell} className="space-y-2.5">
          {selectedHolding && (
            <div className="p-2.5 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] space-y-0.5">
              <div className="font-bold text-xs text-[var(--app-fg)]">{selectedHolding.name}</div>
              <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-1.5">
                <span>{selectedHolding.metal} • {selectedHolding.purity}</span>
                <span>•</span>
                <span>
                  Available:{" "}
                  <strong className="text-[var(--app-fg)] font-mono">
                    {(selectedHolding.weight_grams * selectedHolding.quantity).toFixed(2)} g
                  </strong>
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Weight to Sell (grams) *"
              type="number"
              step="0.001"
              value={sellWeight}
              onChange={(e) => setSellWeight(e.target.value)}
              required
            />

            <Input
              label="Sell Price (₹ / gram) *"
              type="number"
              step="0.01"
              value={sellPricePerGram}
              onChange={(e) => setSellPricePerGram(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
            <Input
              label="Sale Date"
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              required
            />

            {sellWeight && sellPricePerGram ? (
              <div className="p-2.5 rounded-xl bg-[var(--app-card-elevated)] border border-[var(--app-border)] flex items-center justify-between text-xs">
                <span className="text-[var(--app-muted)]">Realized:</span>
                <span className="font-bold font-mono text-emerald-400">
                  {formatCurrencyINR(
                    (parseFloat(sellWeight) || 0) * (parseFloat(sellPricePerGram) || 0)
                  )}
                </span>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border)]">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsSellModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? "Processing..." : "Confirm & Record Sale"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 9. MODAL: EDIT ASSET */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Physical Bullion Asset"
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Asset Description / Name *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />

            <Select
              label="Form Factor"
              value={formItemType}
              onChange={(e) => setFormItemType(e.target.value as BullionItemType)}
              options={ITEM_TYPE_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Select
              label="Purity Grade"
              value={formPurity}
              onChange={(e) => handlePurityChange(e.target.value)}
              options={formMetal === "GOLD" ? GOLD_PURITY_OPTIONS : SILVER_PURITY_OPTIONS}
            />

            <Input
              label="Weight (grams) *"
              type="number"
              step="0.001"
              value={formWeightGrams}
              onChange={(e) => setFormWeightGrams(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border)]">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 10. MODAL: DELETE ASSET CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Precious Metal Asset"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--app-muted)]">
            Are you sure you want to remove{" "}
            <strong className="text-[var(--app-fg)]">{selectedHolding?.name}</strong> from your
            physical metal holdings? This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={submitting}
              onClick={handleDeleteHolding}
            >
              {submitting ? "Deleting..." : "Delete Asset"}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
