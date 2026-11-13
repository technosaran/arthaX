"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Loader2,
  X,
  PieChart as PieChartIcon,
  Banknote,
  ArrowRightLeft,
  ShieldCheck,
  History,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Wallet,
  Calendar,
  Filter,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
import BankLogo from "@/components/BankLogo";
import AppleWalletCard from "@/components/AppleWalletCard";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import { saveToCache, invalidateCacheKeys, getFromLocalCache } from "@/utils/cacheClient";

const DEFAULT_CASH_ID = "00000000-0000-0000-0000-000000000001";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
  classification?: "asset" | "liability";
  created_at?: string;
}

export interface AccountActivity {
  id: string;
  sourceType: "transfer" | "expense" | "income";
  type: "TRANSFER" | "DEBIT" | "CREDIT";
  title: string;
  amount: number;
  date: string;
  notes?: string | null;
  category?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
  created_at?: string;
}

export default function AccountsSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const redisKey = getUserCacheKey(user?.id, CACHE_KEYS.ACCOUNTS);
  const redisLedgerKey = getUserCacheKey(user?.id, CACHE_KEYS.LEDGER);
  const redisTransfersKey = getUserCacheKey(user?.id, CACHE_KEYS.TRANSFERS);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency)
  const initialAccounts = React.useMemo(() => {
    return getFromLocalCache<Account[]>(redisKey) || [];
  }, [redisKey]);

  const initialHistory = React.useMemo(() => {
    return getFromLocalCache<AccountActivity[]>(redisTransfersKey) || [];
  }, [redisTransfersKey]);

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [loading, setLoading] = useState<boolean>(initialAccounts.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // History and Activity State
  const [activityHistory, setActivityHistory] = useState<AccountActivity[]>(initialHistory);
  const [historyLoading, setHistoryLoading] = useState<boolean>(initialHistory.length === 0);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | "transfers" | "expenses" | "income">("all");
  const [historySearch, setHistorySearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null);

  // Cash in hand editing state
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashBalanceInput, setCashBalanceInput] = useState("");
  const [savingCash, setSavingCash] = useState(false);

  // Form states for new accounts
  const [name, setName] = useState("");
  const [type, setType] = useState("Savings Account");
  const [classification, setClassification] = useState<"asset" | "liability">("asset");
  const [balance, setBalance] = useState("");
  const [lastFour, setLastFour] = useState("");

  // Internal Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [transferNotes, setTransferNotes] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

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
      const cachedHistory = getFromLocalCache<AccountActivity[]>(redisTransfersKey);
      if (cachedHistory && Array.isArray(cachedHistory)) {
        setActivityHistory(cachedHistory);
        setHistoryLoading(false);
      }
    }

    try {
      const supabase = createClient();
      const [accountsRes, transfersRes, expensesRes, incomeRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("transfers")
          .select("*")
          .eq("user_id", user.id)
          .order("transfer_date", { ascending: false })
          .limit(200),
        supabase
          .from("expenses")
          .select("id, title, amount, category, account_id, expense_date, notes, created_at")
          .eq("user_id", user.id)
          .order("expense_date", { ascending: false })
          .limit(200),
        supabase
          .from("income")
          .select("id, title, amount, category, account_id, received_date, notes, created_at")
          .eq("user_id", user.id)
          .order("received_date", { ascending: false })
          .limit(200),
      ]);

      if (accountsRes.error) {
        setErrorMsg("Unable to retrieve accounts. Please try again.");
      } else if (accountsRes.data) {
        const mapped: Account[] = accountsRes.data.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          balance: Number(item.balance) || 0,
          last_four: item.last_four,
          classification: item.classification || (
            (item.type?.toLowerCase().includes("credit") || item.name?.toLowerCase().includes("credit") || item.type?.toLowerCase().includes("loan"))
              ? "liability"
              : "asset"
          ),
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
        saveToCache(redisKey, mapped, 3600);

        // Build account ID -> Name lookup map
        const accountMap = new Map(mapped.map((a) => [a.id, a.name]));

        // Map Transfers
        const transferActivities: AccountActivity[] = (transfersRes.data || []).map((t) => {
          const fromName = accountMap.get(t.from_account_id) || "Source Account";
          const toName = accountMap.get(t.to_account_id) || "Destination Account";
          return {
            id: t.id,
            sourceType: "transfer",
            type: "TRANSFER",
            title: t.notes ? `Transfer: ${t.notes}` : `Transfer to ${toName}`,
            amount: Number(t.amount) || 0,
            date: t.transfer_date,
            notes: t.notes,
            category: "Internal Transfer",
            fromAccountId: t.from_account_id,
            fromAccountName: fromName,
            toAccountId: t.to_account_id,
            toAccountName: toName,
            created_at: t.created_at,
          };
        });

        // Map Expenses (Debits)
        const expenseActivities: AccountActivity[] = (expensesRes.data || []).map((e) => ({
          id: e.id,
          sourceType: "expense",
          type: "DEBIT",
          title: e.title || "Expense",
          amount: Number(e.amount) || 0,
          date: e.expense_date,
          notes: e.notes,
          category: e.category,
          accountId: e.account_id,
          accountName: e.account_id ? (accountMap.get(e.account_id) || "Account") : "Unlinked Account",
          created_at: e.created_at,
        }));

        // Map Income (Credits)
        const incomeActivities: AccountActivity[] = (incomeRes.data || []).map((i) => ({
          id: i.id,
          sourceType: "income",
          type: "CREDIT",
          title: i.title || "Income",
          amount: Number(i.amount) || 0,
          date: i.received_date,
          notes: i.notes,
          category: i.category,
          accountId: i.account_id,
          accountName: i.account_id ? (accountMap.get(i.account_id) || "Account") : "Unlinked Account",
          created_at: i.created_at,
        }));

        const combinedActivities: AccountActivity[] = [
          ...transferActivities,
          ...expenseActivities,
          ...incomeActivities,
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.created_at && a.created_at ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : 0));

        setActivityHistory(combinedActivities);
        setHistoryLoading(false);
        saveToCache(redisTransfersKey, combinedActivities, 3600);
      }
    } catch {
      setErrorMsg("Unable to load accounts. Please check your connection.");
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  }, [user, redisKey, redisTransfersKey]);

  useEffect(() => {
    if (!user) return;
    fetchAccounts();

    // Cross-device Realtime synchronization scoped to current user across accounts, transfers, expenses, income
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-accounts-and-history-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchAccounts(true)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transfers",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchAccounts(true)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchAccounts(true)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "income",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchAccounts(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAccounts]);

  const handleDeleteTransfer = async (transferId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to reverse this transfer? Balances will be restored to both accounts.")) {
      return;
    }

    setDeletingTransferId(transferId);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("fn_delete_transfer_atomic", {
        p_transfer_id: transferId,
        p_user_id: user.id,
      });

      if (error) {
        showToast("Reversal Failed", error.message || "Failed to reverse transfer.", "error");
      } else {
        showToast("Transfer Reversed", "Transfer rolled back and account balances restored successfully.", "success");
        await invalidateCacheKeys([
          redisKey,
          redisLedgerKey,
          redisTransfersKey,
        ]);
        await fetchAccounts(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error reversing transfer";
      showToast("Reversal Error", msg, "error");
    } finally {
      setDeletingTransferId(null);
    }
  };

  const formatHistoryDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const filteredHistory = useMemo(() => {
    return activityHistory.filter((item) => {
      // 1. Account filter
      if (selectedAccountId) {
        if (item.sourceType === "transfer") {
          if (item.fromAccountId !== selectedAccountId && item.toAccountId !== selectedAccountId) {
            return false;
          }
        } else {
          if (item.accountId !== selectedAccountId) {
            return false;
          }
        }
      }

      // 2. Type filter
      if (historyTypeFilter === "transfers" && item.sourceType !== "transfer") return false;
      if (historyTypeFilter === "expenses" && item.sourceType !== "expense") return false;
      if (historyTypeFilter === "income" && item.sourceType !== "income") return false;

      // 3. Search query
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchNotes = item.notes?.toLowerCase().includes(query);
        const matchCategory = item.category?.toLowerCase().includes(query);
        const matchAccount = item.accountName?.toLowerCase().includes(query);
        const matchFrom = item.fromAccountName?.toLowerCase().includes(query);
        const matchTo = item.toAccountName?.toLowerCase().includes(query);
        if (!matchTitle && !matchNotes && !matchCategory && !matchAccount && !matchFrom && !matchTo) {
          return false;
        }
      }

      return true;
    });
  }, [activityHistory, selectedAccountId, historyTypeFilter, historySearch]);

  const historyStats = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    let transferCount = 0;

    for (const item of filteredHistory) {
      if (item.sourceType === "income") {
        totalInflow += item.amount;
      } else if (item.sourceType === "expense") {
        totalOutflow += item.amount;
      } else if (item.sourceType === "transfer") {
        transferCount++;
        if (selectedAccountId) {
          if (item.toAccountId === selectedAccountId) {
            totalInflow += item.amount;
          } else if (item.fromAccountId === selectedAccountId) {
            totalOutflow += item.amount;
          }
        }
      }
    }

    return {
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      transferCount,
      totalCount: filteredHistory.length,
    };
  }, [filteredHistory, selectedAccountId]);

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
        classification,
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
      setClassification("asset");
      setIsModalOpen(false);
      showToast("Card Linked Successfully", `${addedName} is now active in your portfolio.`, "success");

      // Invalidate Redis cache across accounts and ledger
      await invalidateCacheKeys([
        redisKey,
        redisLedgerKey,
      ]);
      await fetchAccounts(true);
    }
    setSubmitting(false);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsedAmount = parseFloat(transferAmount);
    if (!transferFromId || !transferToId || isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Invalid Transfer", "Please select source and destination accounts and a positive amount.", "error");
      return;
    }
    if (transferFromId === transferToId) {
      showToast("Invalid Transfer", "Source and destination accounts must be distinct.", "error");
      return;
    }

    setTransferSubmitting(true);
    const supabase = createClient();
    try {
      const { data: res, error } = await supabase.rpc("fn_record_transfer_atomic", {
        p_user_id: user.id,
        p_from_account_id: transferFromId,
        p_to_account_id: transferToId,
        p_amount: parsedAmount,
        p_transfer_date: transferDate,
        p_notes: transferNotes.trim() || null,
      });

      if (error) {
        showToast("Transfer Failed", error.message || "Failed to execute transfer.", "error");
      } else {
        showToast("Transfer Complete", `Transferred ${formatINR(parsedAmount)} from ${res?.from_account || "account"} to ${res?.to_account || "account"}.`, "success");
        setIsTransferModalOpen(false);
        setTransferAmount("");
        setTransferNotes("");
        await invalidateCacheKeys([
          redisKey,
          redisLedgerKey,
          redisTransfersKey,
        ]);
        await fetchAccounts(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected transfer error occurred.";
      showToast("Transfer Failed", msg, "error");
    } finally {
      setTransferSubmitting(false);
    }
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

  const totalAssets = accounts
    .filter((a) => a.classification !== "liability")
    .reduce((acc, curr) => acc + curr.balance, 0);

  const totalLiabilities = accounts
    .filter((a) => a.classification === "liability")
    .reduce((acc, curr) => acc + curr.balance, 0);

  const netWorth = totalAssets - totalLiabilities;
  const totalBalance = totalAssets;

  // Group portfolio assets for the colorful allocation chart
  const typeMap = accounts.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + curr.balance;
    return acc;
  }, {} as Record<string, number>);

  // Modern minimalist fintech color palette
  const chartPalette = [
    "#10B981", // Emerald (Cash / Savings)
    "#3B82F6", // Royal Blue (HDFC / Banking)
    "#8B5CF6", // Purple / Violet (Fixed Deposits)
    "#06B6D4", // Neon Cyan (Investments / Demat)
    "#F59E0B", // Bright Amber / Gold
    "#EC4899", // Vivid Pink
    "#F43F5E", // Rose / Red
    "#14B8A6", // Teal
  ];

  const donutSegments: DonutSegment[] = Object.entries(typeMap).map(([catType, catBalance], index) => ({
    label: catType,
    value: catBalance,
    color: chartPalette[index % chartPalette.length],
  }));

  return (
    <main
      className="flex-1 h-full p-3.5 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Accounts</h1>
          </div>
          <p className="text-xs opacity-70 mt-1">
            Connected accounts, liquid cash vault, liabilities, and asset allocation breakdown.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Transfer Money Button */}
          <button
            onClick={() => {
              if (accounts.length < 2) {
                showToast("Need 2 Accounts", "Please create at least 2 accounts to transfer funds.", "info");
                return;
              }
              setTransferFromId(accounts[0]?.id || "");
              setTransferToId(accounts[1]?.id || "");
              setIsTransferModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-card)",
              color: "var(--app-fg)",
            }}
          >
            <ArrowRightLeft size={14} className="text-sky-400" />
            Transfer Funds
          </button>

          {/* Add Account Modal Trigger */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
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
        className="rounded-2xl p-4 sm:p-6 md:p-8 border mb-8 sm:mb-10 transition-colors shadow-sm"
        style={{
          backgroundColor: "var(--app-card)",
          borderColor: "var(--app-border)",
          color: "var(--app-fg)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
          {/* Left Column: Total Portfolio Summary with Assets & Liabilities */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold opacity-60">
                Net Portfolio Value (Assets - Liabilities)
              </span>
              <div className="text-2xl sm:text-4xl lg:text-5xl font-extrabold font-mono tracking-tight mt-1 break-all sm:break-normal">
                {loading ? "..." : formatINR(netWorth)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div
                className="p-3 rounded-xl border"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <div className="text-[10px] uppercase font-mono tracking-wider opacity-60">
                  Total Assets
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 mt-0.5">
                  {formatINR(totalAssets)}
                </div>
              </div>
              <div
                className="p-3 rounded-xl border"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <div className="text-[10px] uppercase font-mono tracking-wider opacity-60">
                  Total Liabilities
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-rose-400 mt-0.5">
                  {formatINR(totalLiabilities)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
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
            className="lg:col-span-7 flex items-center justify-end border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-8"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Loader2 size={24} className="animate-spin opacity-50" />
              </div>
            ) : (
              <InteractiveDonutChart
                title="Asset Allocation"
                totalLabel="Total Assets"
                totalValue={totalBalance}
                segments={donutSegments}
                formatter={formatINR}
                emptyMessage="No allocation data available."
                emptySubMessage="Update Cash in Hand or link an account to view your breakdown."
                icon={<PieChartIcon size={24} className="opacity-50 text-[var(--app-accent)]" />}
              />
            )}
          </div>
        </div>
      </div>

      {/* Holdings & Connected Debit Cards Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Holdings & Accounts ({accounts.length})
            </h2>
            <p className="text-xs opacity-60 mt-0.5">
              Click any card to filter history to that account.
            </p>
          </div>
          {selectedAccountId && (
            <button
              onClick={() => setSelectedAccountId(null)}
              className="self-start sm:self-auto text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-all cursor-pointer font-medium"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              <X size={12} />
              <span>Clear Filter ({accounts.find((a) => a.id === selectedAccountId)?.name})</span>
            </button>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {accounts.map((acc) => (
              <AppleWalletCard
                key={acc.id}
                account={acc}
                isCash={isCashAccount(acc)}
                onEditCash={handleOpenEditCash}
                onDelete={handleDeleteAccount}
                formatCurrency={formatINR}
                isSelected={selectedAccountId === acc.id}
                onSelect={(card) => {
                  setSelectedAccountId((prev) => (prev === card.id ? null : card.id));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ACCOUNT HISTORY & RECENT ACTIVITY SECTION */}
      <div className="mt-10 sm:mt-12 space-y-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: "var(--app-border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <History size={17} className="text-sky-400" />
              <h2 className="text-base font-bold tracking-tight">
                Account History & Activity
              </h2>
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                  color: "var(--app-fg)",
                }}
              >
                {filteredHistory.length}
              </span>
            </div>
            <p className="text-xs opacity-60 mt-0.5">
              {selectedAccountId
                ? `Filtered activity for ${accounts.find((a) => a.id === selectedAccountId)?.name || "selected account"}.`
                : "Chronological log of internal transfers, card debits, and credited income across your accounts."}
            </p>
          </div>

          {/* Top Controls: Account Selector + Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(e.target.value || null)}
              className="px-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors cursor-pointer font-medium"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
              }}
            >
              <option value="">All Accounts ({accounts.length})</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatINR(a.balance)})
                </option>
              ))}
            </select>

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 opacity-50" />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors w-36 sm:w-44 font-medium"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                  color: "var(--app-fg)",
                }}
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch("")}
                  className="absolute right-2 top-2 opacity-50 hover:opacity-100 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Tabs & Quick Inflow/Outflow Statistics Bar */}
        <div
          className="p-3 sm:p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          style={{
            borderColor: "var(--app-border-subtle)",
            backgroundColor: "var(--app-card)",
          }}
        >
          {/* Activity Category Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All Activity" },
              { id: "transfers", label: "Transfers" },
              { id: "expenses", label: "Debits" },
              { id: "income", label: "Credits" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHistoryTypeFilter(tab.id as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  historyTypeFilter === tab.id
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-400 font-bold shadow-xs"
                    : "border-transparent opacity-60 hover:opacity-100 hover:bg-[var(--app-bg)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 font-mono text-xs flex-wrap self-end sm:self-auto">
            <div className="flex items-center gap-1.5 opacity-80">
              <span className="text-[10px] uppercase opacity-60 font-medium">Inflow:</span>
              <span className="text-emerald-400 font-bold">{formatINR(historyStats.totalInflow)}</span>
            </div>
            <span className="opacity-20">•</span>
            <div className="flex items-center gap-1.5 opacity-80">
              <span className="text-[10px] uppercase opacity-60 font-medium">Outflow:</span>
              <span className="text-rose-400 font-bold">{formatINR(historyStats.totalOutflow)}</span>
            </div>
            <span className="opacity-20">•</span>
            <div className="flex items-center gap-1.5 opacity-80">
              <span className="text-[10px] uppercase opacity-60 font-medium">Net:</span>
              <span
                className={`font-bold ${
                  historyStats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatINR(historyStats.netFlow)}
              </span>
            </div>
          </div>
        </div>

        {/* History Records Container */}
        {historyLoading ? (
          <div
            className="flex items-center justify-center p-16 rounded-xl border"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
          >
            <Loader2 size={24} className="animate-spin opacity-50" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div
            className="p-12 sm:p-16 rounded-2xl border text-center space-y-3"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-card)",
            }}
          >
            <History size={36} className="mx-auto opacity-30 text-sky-400" />
            <h3 className="text-base font-bold">No Account Activity Found</h3>
            <p className="text-xs opacity-60 max-w-sm mx-auto">
              {selectedAccountId || historyTypeFilter !== "all" || historySearch
                ? "No transactions or transfers match your current filter settings."
                : "Transactions, transfers, and card expenditures will appear here automatically."}
            </p>
            {(selectedAccountId || historyTypeFilter !== "all" || historySearch) && (
              <button
                onClick={() => {
                  setSelectedAccountId(null);
                  setHistoryTypeFilter("all");
                  setHistorySearch("");
                }}
                className="mt-2 text-xs px-3.5 py-1.5 rounded-lg border font-semibold opacity-80 hover:opacity-100 cursor-pointer"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden shadow-sm transition-colors"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            {/* Desktop Table Header */}
            <div
              className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-mono uppercase tracking-wider opacity-60 border-b select-none font-semibold"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-3">Account Flow</div>
              <div className="col-span-2 text-right">Amount & Action</div>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: "var(--app-border-subtle)" }}>
              {filteredHistory.slice(0, visibleCount).map((item) => {
                const isTransfer = item.sourceType === "transfer";
                const isIncome = item.sourceType === "income";
                const isExpense = item.sourceType === "expense";

                // Determine display color and direction for transfers relative to filtered account
                let isTransferOutgoing = false;
                let isTransferIncoming = false;
                if (isTransfer && selectedAccountId) {
                  if (item.fromAccountId === selectedAccountId) isTransferOutgoing = true;
                  if (item.toAccountId === selectedAccountId) isTransferIncoming = true;
                }

                return (
                  <div
                    key={`${item.sourceType}-${item.id}`}
                    className="p-4 sm:px-5 sm:py-3.5 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 items-start md:items-center hover:bg-[var(--app-card-hover)] transition-colors"
                  >
                    {/* Date */}
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-xs font-mono opacity-80">
                        {formatHistoryDate(item.date)}
                      </span>
                    </div>

                    {/* Type Badge */}
                    <div className="col-span-2">
                      {isTransfer ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 border border-sky-500/30 text-sky-400">
                          <ArrowRightLeft size={10} />
                          Transfer
                        </span>
                      ) : isIncome ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <ArrowUpRight size={10} />
                          Credit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-400">
                          <ArrowDownRight size={10} />
                          Debit
                        </span>
                      )}
                    </div>

                    {/* Description & Category */}
                    <div className="col-span-3 min-w-0">
                      <div className="text-xs font-semibold truncate capitalize" title={item.title}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono opacity-50 truncate">
                          {item.category || (isTransfer ? "Internal Transfer" : "General")}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] opacity-40 truncate" title={item.notes}>
                            • {item.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Account Flow */}
                    <div className="col-span-3 min-w-0">
                      {isTransfer ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span className="truncate opacity-80 font-mono text-[11px]" title={item.fromAccountName || ""}>
                            {item.fromAccountName}
                          </span>
                          <span className="text-sky-400 flex-shrink-0">➔</span>
                          <span className="truncate opacity-80 font-mono text-[11px]" title={item.toAccountName || ""}>
                            {item.toAccountName}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs font-mono opacity-80 truncate text-[11px]">
                          {item.accountName}
                        </div>
                      )}
                    </div>

                    {/* Amount & Actions */}
                    <div className="col-span-2 w-full md:w-auto flex items-center justify-between md:justify-end gap-3 self-end md:self-auto">
                      <div
                        className={`font-mono text-xs sm:text-sm font-bold tracking-tight ${
                          isIncome || isTransferIncoming
                            ? "text-emerald-400"
                            : isExpense || isTransferOutgoing
                            ? "text-rose-400"
                            : "text-sky-400"
                        }`}
                      >
                        {isIncome || isTransferIncoming
                          ? `+${formatINR(item.amount)}`
                          : isExpense || isTransferOutgoing
                          ? `-${formatINR(item.amount)}`
                          : formatINR(item.amount)}
                      </div>

                      {/* Transfer Delete / Rollback Action */}
                      {isTransfer && (
                        <button
                          onClick={() => handleDeleteTransfer(item.id)}
                          disabled={deletingTransferId === item.id}
                          title="Reverse transfer and restore balances"
                          className="w-7 h-7 rounded-lg border flex items-center justify-center opacity-60 hover:opacity-100 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-30"
                          style={{
                            borderColor: "var(--app-border-subtle)",
                            backgroundColor: "var(--app-bg)",
                          }}
                        >
                          {deletingTransferId === item.id ? (
                            <Loader2 size={12} className="animate-spin text-rose-400" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button if items exceed visibleCount */}
            {filteredHistory.length > visibleCount && (
              <div
                className="p-3 text-center border-t"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                <button
                  onClick={() => setVisibleCount((prev) => prev + 25)}
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg border opacity-80 hover:opacity-100 transition-all cursor-pointer font-mono"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  Load More ({filteredHistory.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* POPUP MODAL: Add New Account */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl relative"
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
                    Account Classification
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setClassification("asset")}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        classification === "asset"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold"
                          : "opacity-60 border-[var(--app-border)]"
                      }`}
                    >
                      Asset (Bank/Cash)
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassification("liability")}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        classification === "liability"
                          ? "border-rose-500 bg-rose-500/10 text-rose-400 font-bold"
                          : "opacity-60 border-[var(--app-border)]"
                      }`}
                    >
                      Liability (Credit/Loan)
                    </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl relative"
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

      {/* POPUP MODAL: Account-to-Account Internal Transfer */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl relative"
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
                  <ArrowRightLeft size={18} className="text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Internal Account Transfer</h3>
                  <p className="text-xs opacity-60">Move money between accounts without altering income or expenses.</p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-lg hover:opacity-75 transition-opacity cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    From Account (Debit)
                  </label>
                  <select
                    value={transferFromId}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    required
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm font-medium border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  >
                    <option value="" disabled>Select source account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === transferToId}>
                        {a.name} ({formatINR(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    To Account (Credit)
                  </label>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    required
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm font-medium border focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                  >
                    <option value="" disabled>Select destination account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === transferFromId}>
                        {a.name} ({formatINR(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Amount (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-mono opacity-60">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
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

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Transfer Date
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
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
                  Transfer Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ATM withdrawal / Credit card bill payoff"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border transition-opacity cursor-pointer opacity-80 hover:opacity-100"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--app-fg)",
                    color: "var(--app-bg)",
                  }}
                >
                  {transferSubmitting && <Loader2 size={13} className="animate-spin" />}
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
