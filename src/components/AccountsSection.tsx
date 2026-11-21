"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  ArrowDownRight,
  Trash2,
  Wallet,
  Calendar,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Landmark,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/cacheKeys";
import BankLogo from "@/components/BankLogo";
import AppleWalletCard from "@/components/AppleWalletCard";
import AccountAdjustModal from "@/components/AccountAdjustModal";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import { saveToCache, invalidateCacheKeys, getFromLocalCache, invalidateAllFinancialCache } from "@/utils/cacheClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";

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
  sourceType: "transfer";
  type: "TRANSFER";
  title: string;
  amount: number;
  date: string;
  notes?: string | null;
  category?: string | null;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
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
  const [viewMode, setViewMode] = useState<"holdings" | "history">("holdings");

  // History and Activity State (Account Section Data Only)
  const [activityHistory, setActivityHistory] = useState<AccountActivity[]>(initialHistory);
  const [historyLoading, setHistoryLoading] = useState<boolean>(initialHistory.length === 0);
  const inFlightRef = useRef<boolean>(false);
  const pendingRefetchRef = useRef<boolean>(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | "inflow" | "outflow">("all");
  const [historySearch, setHistorySearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null);

  // Cash in hand editing state
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashBalanceInput, setCashBalanceInput] = useState("");
  const [savingCash, setSavingCash] = useState(false);
  const [syncingZerodha, setSyncingZerodha] = useState(false);

  // Account Adjustment & Deposit Modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustAccount, setAdjustAccount] = useState<Account | null>(null);
  const [adjustInitialMode, setAdjustInitialMode] = useState<"deposit" | "withdraw" | "adjust">("deposit");

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

  const isDematAccount = (acc: Account) => {
    return (
      acc.type.toUpperCase() === "INVESTMENT" ||
      acc.name.toLowerCase().includes("zerodha") ||
      acc.name.toLowerCase().includes("demat") ||
      acc.name.toLowerCase().includes("trading")
    );
  };

  const isZerodhaAccount = (acc: Account) => {
    return (
      acc.name.toLowerCase().includes("zerodha") ||
      acc.name.toLowerCase().includes("kite")
    );
  };

  const fetchAccounts = useCallback(async (skipCache: boolean = false) => {
    if (!user) return;
    if (inFlightRef.current) {
      pendingRefetchRef.current = true;
      return;
    }
    inFlightRef.current = true;
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

      // Parallel burst: Fetch accounts and internal transfers (Account Section data only)
      const [accountsRes, transfersRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, type, balance, last_four, classification, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("transfers")
          .select("id, from_account_id, to_account_id, amount, transfer_date, notes, created_at")
          .eq("user_id", user.id)
          .order("transfer_date", { ascending: false })
          .limit(100),
      ]);

      if (accountsRes.error) {
        setErrorMsg("Failed to load accounts.");
        return;
      }

      const fetchedAccounts: Account[] = (accountsRes.data || []).map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: Number(acc.balance) || 0,
        last_four: acc.last_four,
        classification:
          acc.classification ||
          (acc.type?.toLowerCase().includes("credit") ||
          acc.name?.toLowerCase().includes("credit") ||
          acc.type?.toLowerCase().includes("loan")
            ? "liability"
            : "asset"),
        created_at: acc.created_at,
      }));

      // Auto-provision permanent Cash in Hand account if missing
      const hasCash = fetchedAccounts.some(isCashAccount);
      if (!hasCash) {
        const { data: newCash, error: cashErr } = await supabase
          .from("accounts")
          .insert([
            {
              id: DEFAULT_CASH_ID,
              user_id: user.id,
              name: "Cash in Hand",
              type: "Liquid Cash",
              classification: "asset",
              balance: 0,
            },
          ])
          .select()
          .single();

        if (!cashErr && newCash) {
          fetchedAccounts.unshift({
            id: newCash.id,
            name: newCash.name,
            type: newCash.type,
            balance: Number(newCash.balance) || 0,
            classification: "asset",
            created_at: newCash.created_at,
          });
        }
      }

      setAccounts(fetchedAccounts);
      saveToCache(redisKey, fetchedAccounts);

      // Build Account Transfers History (Account Section data only)
      const accountMap = new Map<string, string>();
      fetchedAccounts.forEach((a) => accountMap.set(a.id, a.name));

      const unifiedActivity: AccountActivity[] = [];

      // Transfers
      if (transfersRes.data) {
        transfersRes.data.forEach((t) => {
          const fromName = accountMap.get(t.from_account_id) || "Source Account";
          const toName = accountMap.get(t.to_account_id) || "Destination Account";
          unifiedActivity.push({
            id: t.id,
            sourceType: "transfer",
            type: "TRANSFER",
            title: `Transfer: ${fromName} → ${toName}`,
            amount: Number(t.amount) || 0,
            date: t.transfer_date,
            notes: t.notes,
            category: "Internal Transfer",
            fromAccountId: t.from_account_id,
            fromAccountName: fromName,
            toAccountId: t.to_account_id,
            toAccountName: toName,
            created_at: t.created_at,
          });
        });
      }

      // Chronological sort: newest first
      unifiedActivity.sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (
          new Date(b.created_at || b.date).getTime() -
          new Date(a.created_at || a.date).getTime()
        );
      });

      setActivityHistory(unifiedActivity);
      saveToCache(redisTransfersKey, unifiedActivity);
    } catch (err) {
      console.warn("Accounts fetch warning:", err);
      setErrorMsg("Failed to synchronize accounts.");
    } finally {
      setLoading(false);
      setHistoryLoading(false);
      inFlightRef.current = false;
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        fetchAccounts(true);
      }
    }
  }, [user, redisKey, redisTransfersKey]);

  useEffect(() => {
    fetchAccounts();

    if (!user) return;
    const supabase = createClient();

    // Cross-device Realtime synchronization
    const channel = supabase
      .channel(`realtime-accounts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` },
        () => fetchAccounts(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfers", filter: `user_id=eq.${user.id}` },
        () => fetchAccounts(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAccounts]);

  // Synchronize accounts whenever another section modifies financial data
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchAccounts(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("arthax:financial_data_updated", handleDataUpdated);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("arthax:financial_data_updated", handleDataUpdated);
      }
    };
  }, [fetchAccounts]);

  const handleDeleteTransfer = async (transferId: string) => {
    if (!user || deletingTransferId) return;

    setDeletingTransferId(transferId);
    try {
      const supabase = createClient();
      const { data: res, error } = await supabase.rpc("fn_delete_transfer_atomic", {
        p_user_id: user.id,
        p_transfer_id: transferId,
      });

      if (error) {
        showToast("Rollback Failed", error.message || "Failed to reverse transfer.", "error");
      } else {
        showToast(
          "Transfer Reversed",
          `Restored balances for ${res?.from_account || "source"} and ${res?.to_account || "destination"}.`,
          "success"
        );
        if (user?.id) {
        await invalidateAllFinancialCache(user.id);
      }
        await fetchAccounts(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reverse transfer.";
      showToast("Rollback Failed", msg, "error");
    } finally {
      setDeletingTransferId(null);
    }
  };

  const formatHistoryDate = (raw: string) => {
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return raw;
    }
  };

  const filteredHistory = useMemo(() => {
    return activityHistory.filter((item) => {
      // 1. Account filter
      if (selectedAccountId) {
        const matchesAccount =
          item.fromAccountId === selectedAccountId ||
          item.toAccountId === selectedAccountId;
        if (!matchesAccount) return false;

        // Inflow / Outflow filter for selected account
        if (historyTypeFilter === "inflow" && item.toAccountId !== selectedAccountId) return false;
        if (historyTypeFilter === "outflow" && item.fromAccountId !== selectedAccountId) return false;
      }

      // 2. Search query
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          item.fromAccountName.toLowerCase().includes(q) ||
          item.toAccountName.toLowerCase().includes(q) ||
          String(item.amount).includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [activityHistory, selectedAccountId, historyTypeFilter, historySearch]);

  const historyStats = useMemo(() => {
    let totalVolume = 0;
    let accountInflow = 0;
    let accountOutflow = 0;

    for (const item of filteredHistory) {
      totalVolume += item.amount;
      if (selectedAccountId) {
        if (item.toAccountId === selectedAccountId) {
          accountInflow += item.amount;
        } else if (item.fromAccountId === selectedAccountId) {
          accountOutflow += item.amount;
        }
      }
    }

    return {
      totalVolume,
      accountInflow,
      accountOutflow,
      netFlow: accountInflow - accountOutflow,
      totalCount: filteredHistory.length,
    };
  }, [filteredHistory, selectedAccountId]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      showToast("Account Name Required", "Please enter a descriptive name for your bank or account.", "warning");
      return;
    }

    const parsedInitialBalance = parseFloat(balance);
    if (!balance || isNaN(parsedInitialBalance)) {
      showToast("Initial Balance Required", "Please enter a valid starting balance.", "warning");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.from("accounts").insert([
      {
        user_id: user.id,
        name: name.trim(),
        type,
        classification,
        balance: parsedInitialBalance || 0,
        last_four: lastFour.trim() || null,
      },
    ]);

    if (error) {
      setErrorMsg("Failed to add account. Please try again.");
      showToast("Account Link Failed", error.message || "Please check your inputs.", "error");
    } else {
      const addedName = name.trim();
      setName("");
      setBalance("");
      setLastFour("");
      setClassification("asset");
      setIsModalOpen(false);
      showToast("Account Linked", `"${addedName}" has been successfully added to your portfolio.`, "success");

      if (user?.id) {
        await invalidateAllFinancialCache(user.id);
      }
      await fetchAccounts(true);
    }
    setSubmitting(false);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsedAmount = parseFloat(transferAmount);
    if (!transferFromId || !transferToId || isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast("Invalid Transfer", "Please select source and destination accounts and enter an amount greater than ₹0.", "warning");
      return;
    }
    if (transferFromId === transferToId) {
      showToast("Invalid Transfer", "Source and destination accounts must be distinct.", "warning");
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
        if (user?.id) {
        await invalidateAllFinancialCache(user.id);
      }
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
    if (target && (isCashAccount(target) || isZerodhaAccount(target))) {
      showToast(
        "Protected Account",
        isCashAccount(target)
          ? "Cash in Hand is a permanent built-in card and cannot be deleted."
          : "Zerodha Trading & Demat is an integrated account and cannot be deleted here.",
        "warning"
      );
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
      if (user?.id) {
        await invalidateAllFinancialCache(user.id);
      }
      await fetchAccounts(true);
    }
  };

  const handleOpenAdjust = (acc: Account, mode: "deposit" | "withdraw" | "adjust" = "deposit") => {
    setAdjustAccount(acc);
    setAdjustInitialMode(mode);
    setAdjustModalOpen(true);
  };

  const handleAdjustSuccess = async () => {
    await invalidateAllFinancialCache(user?.id);
    await fetchAccounts(true);
  };

  const handleOpenEditCash = (cashAcc: Account) => {
    handleOpenAdjust(cashAcc, "adjust");
  };

  const handleSaveCashBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = parseFloat(cashBalanceInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast("Invalid Amount", "Please enter a valid positive number for cash in hand.", "warning");
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
      showToast("Cash Update Failed", error.message || "Could not update cash balance.", "error");
    } else {
      showToast("Cash Balance Updated", `Cash in Hand updated to ${formatINR(parsed)}.`, "success");
      setIsEditingCash(false);
      if (user?.id) {
        await invalidateAllFinancialCache(user.id);
      }
      await fetchAccounts(true);
    }
    setSavingCash(false);
  };

  const handleSyncZerodha = async () => {
    setSyncingZerodha(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/v1/integrations/zerodha/sync", {
        method: "POST",
        headers,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const errorMsg =
          json.error?.message ||
          (typeof json.error === "string" ? json.error : null) ||
          "Sync failed";
        throw new Error(errorMsg);
      }

      const d = json.data;
      showToast(
        "Zerodha Wallet & Portfolio Synced!",
        `Trading cash margin: ${formatINR(d.walletBalance ?? 0)}. Synced ${d.stocksSynced ?? 0} Stocks, ${d.fnoSynced ?? 0} F&O Positions.`,
        "success"
      );
      if (user?.id) {
        await invalidateAllFinancialCache(user.id);
      }
      await fetchAccounts(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync Zerodha wallet";
      showToast("Sync Error", msg, "error");
    } finally {
      setSyncingZerodha(false);
    }
  };

  const totalAssets = accounts
    .filter((a) => a.classification !== "liability")
    .reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);

  const totalLiabilities = accounts
    .filter((a) => a.classification === "liability")
    .reduce((acc, curr) => acc + Math.abs(Number(curr.balance) || 0), 0);

  const netWorth = totalAssets - totalLiabilities;
  const totalBalance = totalAssets;

  // Formatted Net Worth (omitting trailing .00 for whole numbers to ensure clean elegance & prevent truncation)
  const formattedNetWorth = useMemo(() => {
    const formatted = formatINR(netWorth);
    return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
  }, [netWorth]);

  // Dynamic Net Worth font sizing based on string length to guarantee zero overflow
  const netWorthFontSize = useMemo(() => {
    const len = formattedNetWorth.length;
    if (len > 16) {
      return "text-2xl sm:text-3xl lg:text-3xl xl:text-4xl 2xl:text-5xl";
    }
    if (len > 12) {
      return "text-3xl sm:text-4xl lg:text-4xl xl:text-5xl 2xl:text-6xl";
    }
    return "text-3xl sm:text-5xl xl:text-6xl";
  }, [formattedNetWorth]);

  const typeMap = accounts.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + curr.balance;
    return acc;
  }, {} as Record<string, number>);

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
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Universal Page Header */}
      <PageHeader
        title="Accounts & Holdings"
        description="Bank accounts, credit cards, brokerage balances, and physical cash reserves."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={13} className={syncingZerodha ? "animate-spin" : ""} />}
              disabled={syncingZerodha}
              onClick={handleSyncZerodha}
              title="Sync Zerodha wallet margin and holdings"
            >
              {syncingZerodha ? "Syncing Zerodha..." : "Sync Zerodha"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowRightLeft size={14} className="text-sky-400" />}
              onClick={() => {
                if (accounts.length < 2) {
                  showToast("Need 2 Accounts", "Please create at least 2 accounts to transfer funds.", "info");
                  return;
                }
                setTransferFromId(accounts[0]?.id || "");
                setTransferToId(accounts[1]?.id || "");
                setIsTransferModalOpen(true);
              }}
            >
              Transfer Funds
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => setIsModalOpen(true)}
            >
              Add Account
            </Button>
          </>
        }
      />

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl text-xs border border-rose-500/30 bg-rose-500/10 text-rose-400 flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* COMBINED HERO CARD: Total Portfolio Value + Asset Allocation Chart */}
      <div
        className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[var(--app-border)] transition-colors shadow-sm mb-6 sm:mb-8"
        style={{ backgroundColor: "var(--app-card)" }}
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-center">
          {/* Left Column: Total Portfolio Summary */}
          <div className="xl:col-span-5 space-y-4 min-w-0">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                {totalLiabilities > 0 ? "Net Portfolio Value" : "Total Portfolio Value"}
              </span>
              <div
                className={`${netWorthFontSize} font-extrabold font-mono tracking-tight mt-1.5 tabular-nums truncate`}
                title={formatINR(netWorth)}
              >
                {loading ? <Skeleton className="h-12 w-56 rounded-xl" /> : formattedNetWorth}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {totalLiabilities > 0 ? (
                <>
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] min-w-0">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                      Total Assets
                    </div>
                    <div
                      className="text-sm font-bold font-mono text-emerald-400 mt-0.5 tabular-nums truncate"
                      title={formatINR(totalAssets)}
                    >
                      {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatINR(totalAssets)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] min-w-0">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                      Total Liabilities
                    </div>
                    <div
                      className="text-sm font-bold font-mono text-rose-400 mt-0.5 tabular-nums truncate"
                      title={formatINR(totalLiabilities)}
                    >
                      {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatINR(totalLiabilities)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] min-w-0">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                      Active Accounts
                    </div>
                    <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5 tabular-nums truncate">
                      {loading ? (
                        <Skeleton className="h-5 w-16 rounded-md" />
                      ) : (
                        `${accounts.length} ${accounts.length === 1 ? "Account" : "Accounts"}`
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] min-w-0">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                      Cash in Hand
                    </div>
                    <div
                      className="text-sm font-bold font-mono text-sky-400 mt-0.5 tabular-nums truncate"
                      title={formatINR(accounts.find(isCashAccount)?.balance || 0)}
                    >
                      {loading ? (
                        <Skeleton className="h-5 w-20 rounded-md" />
                      ) : (
                        formatINR(accounts.find(isCashAccount)?.balance || 0)
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Asset Allocation Donut Chart & Color Legend */}
          <div className="xl:col-span-7 min-w-0 flex items-center justify-center xl:justify-end border-t xl:border-t-0 xl:border-l pt-6 xl:pt-0 xl:pl-8 border-[var(--app-border-subtle)]">
            {loading ? (
              <div className="flex items-center justify-center h-44 w-full">
                <Skeleton className="w-36 h-36 rounded-full" />
              </div>
            ) : (
              <InteractiveDonutChart
                title="Asset Allocation"
                totalLabel="Total Assets"
                totalValue={totalBalance}
                segments={donutSegments}
                formatter={formatINR}
                align="end"
                emptyMessage="No allocation data available."
                emptySubMessage="Update Cash in Hand or link an account to view your breakdown."
                icon={<PieChartIcon size={24} className="opacity-50 text-[var(--app-accent)]" />}
              />
            )}
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR SEGMENTED CONTROL ON TOP OF ACCOUNTS CARDS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <SegmentedControl
          value={viewMode}
          onChange={(val) => setViewMode(val)}
          options={[
            {
              value: "holdings",
              label: `Cards & Holdings (${accounts.length})`,
              icon: <Wallet size={13} />,
            },
            {
              value: "history",
              label: `Account Transfers (${filteredHistory.length})`,
              icon: <ArrowRightLeft size={13} />,
            },
          ]}
        />
      </div>

      {/* HOLDINGS & ACCOUNTS GRID VIEW */}
      {viewMode === "holdings" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={<Landmark size={28} />}
              title="No accounts linked"
              description="Add bank accounts, debit/credit cards, or your cash holding to start tracking your financial assets."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setIsModalOpen(true)}
                >
                  Add First Account
                </Button>
              }
            />
          ) : (
            /* Apple Wallet Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {accounts.map((acc) => (
                <AppleWalletCard
                  key={acc.id}
                  account={acc}
                  isCash={isCashAccount(acc)}
                  isDemat={isDematAccount(acc)}
                  isZerodha={isZerodhaAccount(acc)}
                  onEditCash={handleOpenEditCash}
                  onAdjust={handleOpenAdjust}
                  onSyncZerodha={handleSyncZerodha}
                  isSyncing={syncingZerodha}
                  onDelete={handleDeleteAccount}
                  formatCurrency={formatINR}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACCOUNT HISTORY & TRANSFERS SECTION (Account Section data only) */}
      {viewMode === "history" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => setViewMode("holdings")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:underline cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Back to Accounts</span>
            </button>
            <span className="text-xs text-[var(--app-muted)] font-mono">
              Account Transfer History
            </span>
          </div>

          {/* Controls Bar: Filter Pills + Account Filter + Search */}
          <div
            className="p-3.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs"
          >
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {selectedAccountId ? (
                [
                  { id: "all", label: "All Transfers" },
                  { id: "inflow", label: "Inflow (Received)" },
                  { id: "outflow", label: "Outflow (Sent)" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setHistoryTypeFilter(tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                      historyTypeFilter === tab.id
                        ? "border-sky-500/50 bg-sky-500/10 text-sky-400 font-bold shadow-xs"
                        : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setHistoryTypeFilter("all")}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-sky-500/50 bg-sky-500/10 text-sky-400 font-bold shadow-xs cursor-pointer"
                >
                  All Transfers ({activityHistory.length})
                </button>
              )}
            </div>

            {/* Right: Search & Account Selector */}
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedAccountId || ""}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value || null);
                  setHistoryTypeFilter("all");
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] focus:outline-none transition-colors cursor-pointer font-medium"
              >
                <option value="">All Accounts ({accounts.length})</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatINR(a.balance)})
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" />
                <input
                  type="text"
                  placeholder="Search transfers..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 pr-7 py-1.5 text-xs rounded-xl border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] focus:outline-none w-36 sm:w-48 font-medium"
                />
                {historySearch && (
                  <button
                    onClick={() => setHistorySearch("")}
                    className="absolute right-2 top-2 text-[var(--app-muted)] hover:text-[var(--app-fg)] cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div
            className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] flex items-center justify-between text-xs font-mono"
          >
            {selectedAccountId ? (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase text-[var(--app-muted)] font-medium">Inflow:</span>
                  <span className="text-emerald-400 font-bold">+{formatINR(historyStats.accountInflow)}</span>
                </div>
                <span className="opacity-20">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase text-[var(--app-muted)] font-medium">Outflow:</span>
                  <span className="text-rose-400 font-bold">-{formatINR(historyStats.accountOutflow)}</span>
                </div>
                <span className="opacity-20">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase text-[var(--app-muted)] font-medium">Net Transfer:</span>
                  <span
                    className={`font-bold ${
                      historyStats.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {historyStats.netFlow >= 0 ? "+" : ""}
                    {formatINR(historyStats.netFlow)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase text-[var(--app-muted)] font-medium">Total Transferred:</span>
                  <span className="text-sky-400 font-bold">{formatINR(historyStats.totalVolume)}</span>
                </div>
                <span className="opacity-20">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase text-[var(--app-muted)] font-medium">Flow:</span>
                  <span className="text-emerald-400 font-bold">Internal Reconciled</span>
                </div>
              </div>
            )}

            <span className="text-[11px] text-[var(--app-muted)]">
              {filteredHistory.length} {filteredHistory.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {/* History Records Table / Cards */}
          {historyLoading ? (
            <CardSkeleton rows={6} />
          ) : filteredHistory.length === 0 ? (
            <EmptyState
              icon={<ArrowRightLeft size={32} className="text-sky-400" />}
              title="No Account Transfers Found"
              description={
                selectedAccountId || historySearch
                  ? "No internal transfers match your current filter settings."
                  : "Internal transfers between bank accounts, credit cards, and cash reserves will appear here."
              }
              action={
                selectedAccountId || historySearch ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedAccountId(null);
                      setHistoryTypeFilter("all");
                      setHistorySearch("");
                    }}
                  >
                    Clear All Filters
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<ArrowRightLeft size={14} />}
                    onClick={() => {
                      if (accounts.length < 2) {
                        showToast("Need 2 Accounts", "Please create at least 2 accounts to transfer funds.", "info");
                        return;
                      }
                      setTransferFromId(accounts[0]?.id || "");
                      setTransferToId(accounts[1]?.id || "");
                      setIsTransferModalOpen(true);
                    }}
                  >
                    Transfer Funds
                  </Button>
                )
              }
            />
          ) : (
            <div
              className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] overflow-hidden shadow-xs transition-colors"
            >
              {/* Desktop Table Header */}
              <div
                className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--app-muted)] border-b border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] font-semibold select-none"
              >
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-3">Account Flow</div>
                <div className="col-span-2 text-right">Amount & Action</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[var(--app-border-subtle)]">
                {filteredHistory.slice(0, visibleCount).map((item) => {
                  let isTransferOutgoing = false;
                  let isTransferIncoming = false;
                  if (selectedAccountId) {
                    if (item.fromAccountId === selectedAccountId) isTransferOutgoing = true;
                    if (item.toAccountId === selectedAccountId) isTransferIncoming = true;
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:px-5 sm:py-3.5 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 items-start md:items-center hover:bg-[var(--app-card-hover)] transition-colors"
                    >
                      {/* Date */}
                      <div className="col-span-2 flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--app-muted)]">
                          {formatHistoryDate(item.date)}
                        </span>
                      </div>

                      {/* Type Badge */}
                      <div className="col-span-2">
                        <Badge variant="info">Transfer</Badge>
                      </div>

                      {/* Description & Category */}
                      <div className="col-span-3 min-w-0">
                        <div className="text-xs font-semibold truncate capitalize text-[var(--app-fg)]" title={item.title}>
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-[var(--app-muted)] truncate">
                            {item.category || "Internal Transfer"}
                          </span>
                          {item.notes && (
                            <span className="text-[10px] text-[var(--app-muted)] opacity-70 truncate" title={item.notes}>
                              • {item.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Account Flow */}
                      <div className="col-span-3 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span className="truncate text-[var(--app-muted)] font-mono text-[11px]" title={item.fromAccountName || ""}>
                            {item.fromAccountName}
                          </span>
                          <span className="text-sky-400 flex-shrink-0">➔</span>
                          <span className="truncate text-[var(--app-muted)] font-mono text-[11px]" title={item.toAccountName || ""}>
                            {item.toAccountName}
                          </span>
                        </div>
                      </div>

                      {/* Amount & Actions */}
                      <div className="col-span-2 w-full md:w-auto flex items-center justify-between md:justify-end gap-3 self-end md:self-auto">
                        <div
                          className={`font-mono text-xs sm:text-sm font-bold tracking-tight tabular-nums whitespace-nowrap ${
                            isTransferIncoming
                              ? "text-emerald-400"
                              : isTransferOutgoing
                              ? "text-rose-400"
                              : "text-sky-400"
                          }`}
                        >
                          {isTransferIncoming
                            ? `+${formatINR(item.amount)}`
                            : isTransferOutgoing
                            ? `-${formatINR(item.amount)}`
                            : formatINR(item.amount)}
                        </div>

                        {/* Transfer Delete / Rollback Action */}
                        <button
                          type="button"
                          onClick={() => handleDeleteTransfer(item.id)}
                          disabled={deletingTransferId === item.id}
                          title="Reverse transfer and restore balances"
                          className="w-7 h-7 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] flex items-center justify-center text-[var(--app-muted)] hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-30"
                        >
                          {deletingTransferId === item.id ? (
                            <Loader2 size={12} className="animate-spin text-rose-400" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredHistory.length > visibleCount && (
                <div className="p-3 text-center border-t border-[var(--app-border-subtle)]">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setVisibleCount((prev) => prev + 25)}
                  >
                    Load More ({filteredHistory.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* POPUP MODAL: Add New Account */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Account"
        size="md"
      >
        <form onSubmit={handleAddAccount} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Bank / Institution Name *"
              placeholder="e.g. HDFC Bank, SBI, Zerodha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              leftIcon={<Landmark size={13} />}
            />

            <Select
              label="Account Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: "Savings Account", label: "Savings Account" },
                { value: "Checking / Current", label: "Checking / Current" },
                { value: "Salary Account", label: "Salary Account" },
                { value: "Trading / Demat", label: "Trading / Demat" },
                { value: "Fixed Deposit", label: "Fixed Deposit" },
                { value: "Mutual Funds", label: "Mutual Funds" },
                { value: "Credit Card", label: "Credit Card" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
            <Input
              label="Initial Balance (₹ INR) *"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
              leftIcon={<span className="font-mono text-xs font-bold">₹</span>}
            />

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold tracking-tight text-[var(--app-fg)] mb-1">
                Classification
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setClassification("asset")}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    classification === "asset"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold shadow-xs"
                      : "border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
                  }`}
                >
                  Asset
                </button>
                <button
                  type="button"
                  onClick={() => setClassification("liability")}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    classification === "liability"
                      ? "border-rose-500 bg-rose-500/10 text-rose-400 font-bold shadow-xs"
                      : "border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[var(--app-card-hover)]"
                  }`}
                >
                  Liability
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
            >
              Save Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* POPUP MODAL: Account Adjust & Quick Deposit / Withdraw (+ / - / Calibrate) */}
      <AccountAdjustModal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        account={adjustAccount}
        initialMode={adjustInitialMode}
        accounts={accounts}
        onSuccess={handleAdjustSuccess}
        formatINR={formatINR}
      />

      {/* POPUP MODAL: Edit Cash in Hand Balance */}
      <Modal
        isOpen={isEditingCash}
        onClose={() => setIsEditingCash(false)}
        title="Update Cash in Hand"
        size="sm"
      >
        <form onSubmit={handleSaveCashBalance} className="space-y-2.5">
          <Input
            label="Cash Balance (₹ INR) *"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={cashBalanceInput}
            onChange={(e) => setCashBalanceInput(e.target.value)}
            required
            autoFocus
            leftIcon={<span className="font-mono text-xs font-bold">₹</span>}
          />

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingCash(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingCash}
            >
              Save Cash
            </Button>
          </div>
        </form>
      </Modal>

      {/* POPUP MODAL: Account-to-Account Internal Transfer */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Internal Account Transfer"
        size="md"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Select
              label="From Account"
              value={transferFromId}
              onChange={(e) => setTransferFromId(e.target.value)}
              required
            >
              <option value="" disabled>Select source account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === transferToId}>
                  {a.name} ({formatINR(a.balance)})
                </option>
              ))}
            </Select>

            <Select
              label="To Account"
              value={transferToId}
              onChange={(e) => setTransferToId(e.target.value)}
              required
            >
              <option value="" disabled>Select destination account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === transferFromId}>
                  {a.name} ({formatINR(a.balance)})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Transfer Amount (₹ INR) *"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              required
              leftIcon={<span className="font-mono text-xs font-bold">₹</span>}
            />

            <Input
              label="Transfer Date"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsTransferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={transferSubmitting}
            >
              Execute Transfer
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
