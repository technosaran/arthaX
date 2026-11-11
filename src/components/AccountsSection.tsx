"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, PieChart as PieChartIcon, Banknote } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import BankLogo from "@/components/BankLogo";
import AppleWalletCard from "@/components/AppleWalletCard";
import { saveToCache, invalidateCacheKeys, getFromLocalCache } from "@/utils/cacheClient";

const DEFAULT_CASH_ID = "00000000-0000-0000-0000-000000000001";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
  created_at?: string;
}

export default function AccountsSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const redisKey = getUserCacheKey(user?.id, CACHE_KEYS.ACCOUNTS);
  const redisLedgerKey = getUserCacheKey(user?.id, CACHE_KEYS.LEDGER);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency)
  const initialAccounts = React.useMemo(() => {
    return getFromLocalCache<Account[]>(redisKey) || [];
  }, [redisKey]);

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [loading, setLoading] = useState<boolean>(initialAccounts.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cash in hand editing state
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashBalanceInput, setCashBalanceInput] = useState("");
  const [savingCash, setSavingCash] = useState(false);

  // Form states for new accounts
  const [name, setName] = useState("");
  const [type, setType] = useState("Savings Account");
  const [balance, setBalance] = useState("");
  const [lastFour, setLastFour] = useState("");

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const isCashAccount = (acc: Account) => {
    return (
      acc.id === DEFAULT_CASH_ID ||
      acc.type === "Liquid Cash" ||
      acc.name.toLowerCase() === "cash in hand"
    );
  };

  const fetchAccounts = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    setErrorMsg(null);

    // 1. Instant Synchronous Check from Tier 1 & 2 Local Cache
    if (!skipCache) {
      const cached = getFromLocalCache<Account[]>(redisKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setAccounts(cached);
        setLoading(false);
      }
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg("Unable to retrieve accounts. Please try again.");
      } else if (data) {
        const mapped: Account[] = data.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          balance: Number(item.balance) || 0,
          last_four: item.last_four,
          created_at: item.created_at,
        }));

        // If user has zero accounts, seed a default Cash in Hand card for them
        if (mapped.length === 0) {
          const { data: newCash } = await supabase
            .from("accounts")
            .insert([
              {
                user_id: user.id,
                name: "Cash in Hand",
                type: "Liquid Cash",
                balance: 0.0,
                last_four: "CASH",
              },
            ])
            .select()
            .single();

          if (newCash) {
            mapped.push({
              id: newCash.id,
              name: newCash.name,
              type: newCash.type,
              balance: 0.0,
              last_four: "CASH",
              created_at: newCash.created_at,
            });
          }
        }

        // Sort so Cash in Hand is always first
        mapped.sort((a, b) => {
          if (isCashAccount(a)) return -1;
          if (isCashAccount(b)) return 1;
          return 0;
        });

        setAccounts(mapped);

        // Update Multi-Tier Cache (Local 0ms + Redis background)
        saveToCache(redisKey, mapped, 3600);
      }
    } catch {
      setErrorMsg("Unable to load accounts. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [user, redisKey]);

  useEffect(() => {
    if (!user) return;
    fetchAccounts();

    // Cross-device Realtime synchronization scoped to current user
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-accounts-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAccounts(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAccounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !balance) return;

    setSubmitting(true);
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.from("accounts").insert([
      {
        user_id: user.id,
        name: name.trim(),
        type,
        balance: parseFloat(balance) || 0,
        last_four: lastFour.trim() || null,
      },
    ]);

    if (error) {
      setErrorMsg("Failed to add account. Please try again.");
      showToast("Failed to Add Card", error.message || "Please check your inputs.", "error");
    } else {
      const addedName = name.trim();
      setName("");
      setBalance("");
      setLastFour("");
      setIsModalOpen(false);
      showToast("Card Linked Successfully", `${addedName} is now active in your portfolio.`, "success");

      // Invalidate Redis cache across accounts and ledger
      await invalidateCacheKeys([
        redisKey,
        redisLedgerKey,
        "arthax:cache:accounts",
        "arthax:cache:ledger",
      ]);
      await fetchAccounts(true);
    }
    setSubmitting(false);
  };

  const handleDeleteAccount = async (id: string) => {
    if (!user) return;
    const target = accounts.find((a) => a.id === id);
    if (target && isCashAccount(target)) {
      showToast("Protected Account", "Cash in Hand is a permanent built-in card and cannot be deleted.", "info");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setErrorMsg("Failed to delete account.");
      showToast("Delete Failed", "Could not remove the card.", "error");
    } else {
      showToast("Card Removed", `${target?.name || "Account"} has been unlinked.`, "info");
      await invalidateCacheKeys([
        redisKey,
        redisLedgerKey,
        "arthax:cache:accounts",
        "arthax:cache:ledger",
      ]);
      await fetchAccounts(true);
    }
  };

  const handleOpenEditCash = (cashAcc: Account) => {
    setCashBalanceInput(cashAcc.balance.toString());
    setIsEditingCash(true);
  };

  const handleSaveCashBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = parseFloat(cashBalanceInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast("Invalid Amount", "Please enter a valid positive number for cash.", "error");
      return;
    }

    const targetCash = accounts.find((a) => isCashAccount(a));
    if (!targetCash) {
      showToast("Account Not Found", "Cash in Hand account could not be found.", "error");
      return;
    }

    setSavingCash(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .update({ balance: parsed })
      .eq("id", targetCash.id)
      .eq("user_id", user.id);

    if (error) {
      showToast("Update Failed", "Could not update cash balance.", "error");
    } else {
      showToast("Cash Updated", `Cash in Hand updated to ${formatINR(parsed)}.`, "success");
      setIsEditingCash(false);
      await invalidateCacheKeys([
        redisKey,
        redisLedgerKey,
        "arthax:cache:accounts",
        "arthax:cache:ledger",
      ]);
      await fetchAccounts(true);
    }
    setSavingCash(false);
  };

  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  // Group portfolio assets for the colorful allocation chart
  const typeMap = accounts.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + curr.balance;
    return acc;
  }, {} as Record<string, number>);

  // Vibrant high-contrast fintech color palette
  const chartPalette = [
    "#10B981", // Emerald Green (Cash / Savings)
    "#3B82F6", // Royal Blue (HDFC / Banking)
    "#8B5CF6", // Purple / Violet (Fixed Deposits)
    "#06B6D4", // Neon Cyan (Investments / Demat)
    "#F59E0B", // Bright Amber / Gold
    "#EC4899", // Vivid Pink
    "#F43F5E", // Coral Rose
    "#14B8A6", // Teal
  ];

  const chartSegments = Object.entries(typeMap).map(([catType, catBalance], index) => {
    const percentage = totalBalance > 0 ? (catBalance / totalBalance) * 100 : 0;
    return {
      type: catType,
      balance: catBalance,
      percentage,
      color: chartPalette[index % chartPalette.length],
    };
  });

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <main
      className="flex-1 h-screen p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
                color: "var(--app-fg)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-400" />
              Live Sync
            </span>
          </div>
          <p className="text-xs opacity-70 mt-1">
            Connected debit cards, liquid cash vault, and asset allocation.
          </p>
        </div>

        {/* Add Account Modal Trigger */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm self-start sm:self-auto"
          style={{
            backgroundColor: "var(--app-fg)",
            color: "var(--app-bg)",
            border: "1px solid var(--app-border)",
          }}
        >
          <Plus size={15} />
          Add Account
        </button>
      </div>

      {errorMsg && (
        <div
          className="mb-6 p-4 rounded-xl text-xs border"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card)",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* COMBINED UNIFIED CARD: Total Portfolio Value + Asset Allocation Chart */}
      <div
        className="rounded-2xl p-6 sm:p-8 border mb-10 transition-colors shadow-sm"
        style={{
          backgroundColor: "var(--app-card)",
          borderColor: "var(--app-border)",
          color: "var(--app-fg)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Total Portfolio Summary */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold opacity-60">
                Total Combined Portfolio Value
              </span>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono tracking-tight mt-1">
                {loading ? "..." : formatINR(totalBalance)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span
                className="px-3 py-1 rounded-md border text-[11px] font-mono font-bold"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                  color: "var(--app-fg)",
                }}
              >
                INR (₹) Standard
              </span>
              <span
                className="px-3 py-1 rounded-md border text-[11px] font-mono opacity-80"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                {accounts.length} {accounts.length === 1 ? "Holding" : "Holdings"}
              </span>
            </div>
          </div>

          {/* Right Column: Asset Allocation Donut Chart & Color Legend */}
          <div
            className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-8 justify-end border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-8"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : accounts.length === 0 || totalBalance === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs opacity-60 w-full">
                <PieChartIcon size={28} className="opacity-40 mb-2" />
                <p>No allocation data available.</p>
                <p className="text-[11px] mt-1">Update Cash in Hand or link an account to view your breakdown.</p>
              </div>
            ) : (
              <>
                {/* Colorful SVG Donut Chart */}
                <div className="flex justify-center items-center relative flex-shrink-0">
                  <svg width="170" height="170" viewBox="0 0 120 120" className="transform -rotate-90">
                    <circle
                      cx="60"
                      cy="60"
                      r={radius}
                      fill="none"
                      stroke="var(--app-border-subtle)"
                      strokeWidth="14"
                    />
                    {chartSegments.map((segment, idx) => {
                      const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
                      const offset = cumulativeOffset;
                      cumulativeOffset += (segment.percentage / 100) * circumference;

                      return (
                        <circle
                          key={idx}
                          cx="60"
                          cy="60"
                          r={radius}
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="14"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={-offset}
                          className="transition-all duration-500 ease-out"
                        />
                      );
                    })}
                  </svg>

                  {/* Donut Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
                    <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">
                      Total Assets
                    </span>
                    <span className="text-[13px] font-bold font-mono tracking-tight">
                      {formatINR(totalBalance)}
                    </span>
                  </div>
                </div>

                {/* Legend with Vibrant Color Dots, Types, and Percentages */}
                <div className="space-y-2.5 w-full sm:max-w-xs">
                  <div className="flex items-center gap-1.5 pb-1 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                    <PieChartIcon size={13} className="opacity-70" />
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                      Asset Allocation
                    </span>
                  </div>

                  {chartSegments.map((segment, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: segment.color }}
                        />
                        <span className="truncate opacity-80 text-[11px] font-medium">{segment.type}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono flex-shrink-0 text-[11px]">
                        <span className="font-bold">{segment.percentage.toFixed(1)}%</span>
                        <span className="opacity-50 text-[10px]">({formatINR(segment.balance)})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Holdings & Connected Debit Cards Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Holdings & Debit Cards ({accounts.length})
            </h2>
            <p className="text-xs opacity-60 mt-0.5">
              Apple Wallet style cards with instant tap-to-pay styling and real-time ledger balance.
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
              color: "var(--app-fg)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-400" />
            Live Sync
          </span>
        </div>

        {loading ? (
          <div
            className="flex items-center justify-center p-16 rounded-xl border"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
          >
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          /* Responsive Apple Wallet Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((acc) => (
              <AppleWalletCard
                key={acc.id}
                account={acc}
                isCash={isCashAccount(acc)}
                onEditCash={handleOpenEditCash}
                onDelete={handleDeleteAccount}
                formatCurrency={formatINR}
              />
            ))}
          </div>
        )}
      </div>

      {/* POPUP MODAL: Add New Account */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 sm:p-8 space-y-6 shadow-2xl relative"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div className="flex items-center gap-3">
                <BankLogo name={name || "Bank"} size={38} />
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Add Connected Account</h3>
                  <p className="text-xs opacity-60">Enter account or bank details to link a new card.</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:opacity-75 transition-opacity cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Bank or Institution Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, SBI, ICICI, Zerodha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Account Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors cursor-pointer"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  >
                    <option value="Savings Account">Savings Account</option>
                    <option value="Checking / Current">Checking / Current</option>
                    <option value="Salary Account">Salary Account</option>
                    <option value="Trading / Demat">Trading / Demat</option>
                    <option value="Fixed Deposit">Fixed Deposit</option>
                    <option value="Mutual Funds">Mutual Funds</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Last 4 Digits (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4021"
                    value={lastFour}
                    onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm font-mono border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Initial Balance (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-mono opacity-60">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    required
                    className="w-full rounded-lg pl-8 pr-3.5 py-2.5 text-sm font-mono border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border transition-opacity cursor-pointer opacity-80 hover:opacity-100"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--app-fg)",
                    color: "var(--app-bg)",
                  }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Edit Cash in Hand Balance */}
      {isEditingCash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl border p-6 sm:p-8 space-y-6 shadow-2xl relative"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg border flex items-center justify-center"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  <Banknote size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Update Cash in Hand</h3>
                  <p className="text-xs opacity-60">Set your physical cash holdings balance.</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingCash(false)}
                className="p-1 rounded-lg hover:opacity-75 transition-opacity cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCashBalance} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Current Physical Cash Amount (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-mono opacity-60">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cashBalanceInput}
                    onChange={(e) => setCashBalanceInput(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-lg pl-8 pr-3.5 py-2.5 text-sm font-mono border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setIsEditingCash(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border transition-opacity cursor-pointer opacity-80 hover:opacity-100"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCash}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--app-fg)",
                    color: "var(--app-bg)",
                  }}
                >
                  {savingCash && <Loader2 size={13} className="animate-spin" />}
                  Save Cash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
