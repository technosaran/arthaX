"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BookOpen,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import BankLogo from "@/components/BankLogo";
import EntityLogo from "@/components/EntityLogo";
import { CACHE_KEYS, getUserCacheKey } from "@/utils/cacheKeys";
import { saveToCache, invalidateCacheKeys, getFromLocalCache, invalidateAllFinancialCache } from "@/utils/cacheClient";
import {
  getCurrentMonthYear,
  formatMonthDisplay,
  getEarliestDataMonth,
  computeNextMonth,
  computePrevMonth,
} from "@/utils/monthUtils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";

const DEFAULT_CASH_ID = "00000000-0000-0000-0000-000000000001";

interface RawIncomeItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  frequency: string;
  account_id?: string | null;
  received_date: string;
  notes?: string | null;
  created_at?: string;
}

interface RawExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  account_id?: string | null;
  expense_date: string;
  notes?: string | null;
  created_at?: string;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
  created_at?: string;
  classification?: "asset" | "liability";
}

export interface LedgerEntry {
  id: string;
  sourceType: "income" | "expense";
  type: "CREDIT" | "DEBIT";
  title: string;
  amount: number;
  category: string;
  account_id?: string | null;
  date: string; // YYYY-MM-DD
  notes?: string | null;
  frequency?: string;
  created_at?: string;
  account?: AccountItem | null;
  runningBalance?: number;
}

export default function LedgerSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const redisLedgerKey = getUserCacheKey(user?.id, CACHE_KEYS.LEDGER);
  const redisIncomeKey = getUserCacheKey(user?.id, CACHE_KEYS.INCOME);
  const redisExpensesKey = getUserCacheKey(user?.id, CACHE_KEYS.EXPENSES);
  const redisAccountsKey = getUserCacheKey(user?.id, CACHE_KEYS.ACCOUNTS);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency)
  const initialCache = useMemo(() => {
    return getFromLocalCache<{
      incomes: RawIncomeItem[];
      expenses: RawExpenseItem[];
      accounts: AccountItem[];
    }>(redisLedgerKey);
  }, [redisLedgerKey]);

  // Raw Data State
  const [incomes, setIncomes] = useState<RawIncomeItem[]>(initialCache?.incomes || []);
  const [expenses, setExpenses] = useState<RawExpenseItem[]>(initialCache?.expenses || []);
  const [accounts, setAccounts] = useState<AccountItem[]>(initialCache?.accounts || []);
  const [loading, setLoading] = useState<boolean>(!initialCache);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const pendingRefetchRef = useRef<boolean>(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "CREDIT" | "DEBIT">("all");
  const [accountFilter, setAccountFilter] = useState("all");

  // Active month in YYYY-MM format with strict boundary constraints
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => getCurrentMonthYear());
  const [isAllTime, setIsAllTime] = useState<boolean>(false);

  // Compute earliest month that actually has ledger records
  const earliestMonthYear = useMemo(() => {
    const dates = [
      ...incomes.map((i) => i.received_date),
      ...expenses.map((e) => e.expense_date),
    ];
    return getEarliestDataMonth(dates, currentMonthYear);
  }, [incomes, expenses, currentMonthYear]);

  // Clamp selectedMonthYear so it cannot be in the future or before earliest data
  useEffect(() => {
    if (selectedMonthYear > currentMonthYear) {
      setSelectedMonthYear(currentMonthYear);
    } else if (earliestMonthYear && selectedMonthYear < earliestMonthYear) {
      setSelectedMonthYear(earliestMonthYear);
    }
  }, [selectedMonthYear, currentMonthYear, earliestMonthYear]);

  const canGoPrev = selectedMonthYear > earliestMonthYear;
  const canGoNext = selectedMonthYear < currentMonthYear;
  const isCurrentMonth = selectedMonthYear === currentMonthYear;

  const monthDisplayTitle = useMemo(() => {
    return formatMonthDisplay(selectedMonthYear);
  }, [selectedMonthYear]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setIsAllTime(false);
    setSelectedMonthYear((prev) => computePrevMonth(prev, earliestMonthYear));
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setIsAllTime(false);
    setSelectedMonthYear((prev) => computeNextMonth(prev, currentMonthYear));
  };

  const handleResetToCurrentMonth = () => {
    setIsAllTime(false);
    setSelectedMonthYear(currentMonthYear);
  };

  // Modals
  const [selectedVoucher, setSelectedVoucher] = useState<LedgerEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Format currency into Indian Numbering System
  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Format Date cleanly
  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const { todayStr, yesterdayStr } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const y = new Date(now.getTime() - 86400000);
    const yesterday = y.toISOString().split("T")[0];
    return { todayStr: today, yesterdayStr: yesterday };
  }, []);

  // Get relative date tag
  const getRelativeDateTag = (dateStr: string) => {
    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    return null;
  };

  // Invalidate Redis caches across all related keys
  const invalidateAllCaches = async () => {
    if (user?.id) {
      await invalidateAllFinancialCache(user.id);
    }
    await invalidateCacheKeys([
      redisLedgerKey,
      redisIncomeKey,
      redisExpensesKey,
      redisAccountsKey,
      "arthax:cache:ledger",
      "arthax:cache:income",
      "arthax:cache:expenses",
      "arthax:cache:accounts",
      "ledger",
    ]);
  };

  // Fetch All Ledger Telemetry
  const fetchAllData = useCallback(async (skipCache = false) => {
    if (!user) return;
    if (inFlightRef.current) {
      pendingRefetchRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setErrorMsg(null);

    if (!skipCache) {
      const cached = getFromLocalCache<{
        incomes: RawIncomeItem[];
        expenses: RawExpenseItem[];
        accounts: AccountItem[];
      }>(redisLedgerKey);
      if (cached) {
        if (Array.isArray(cached.incomes)) setIncomes(cached.incomes);
        if (Array.isArray(cached.expenses)) setExpenses(cached.expenses);
        if (Array.isArray(cached.accounts)) setAccounts(cached.accounts);
        setLoading(false);
      }
    }

    try {
      const supabase = createClient();

      const [accountsRes, incomeRes, expensesRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", user.id).order("name", { ascending: true }),
        supabase.from("income").select("*").eq("user_id", user.id).order("received_date", { ascending: false }),
        supabase.from("expenses").select("*").eq("user_id", user.id).order("expense_date", { ascending: false }),
      ]);

      if (accountsRes.error || incomeRes.error || expensesRes.error) {
        setErrorMsg("Unable to synchronize complete ledger. Check network connectivity.");
      } else {
        const mappedAccounts: AccountItem[] = (accountsRes.data || []).map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: Number(a.balance) || 0,
          classification:
            a.classification ||
            (a.type?.toLowerCase().includes("credit") ||
            a.name?.toLowerCase().includes("credit") ||
            a.type?.toLowerCase().includes("loan")
              ? "liability"
              : "asset"),
          last_four: a.last_four,
          created_at: a.created_at,
        }));

        mappedAccounts.sort((a, b) => {
          if (a.id === DEFAULT_CASH_ID || a.type === "Liquid Cash") return -1;
          if (b.id === DEFAULT_CASH_ID || b.type === "Liquid Cash") return 1;
          return a.name.localeCompare(b.name);
        });

        const mappedIncome: RawIncomeItem[] = (incomeRes.data || []).map((item) => ({
          id: item.id,
          title: item.title,
          amount: Number(item.amount) || 0,
          category: item.category,
          frequency: item.frequency || "Monthly",
          account_id: item.account_id,
          received_date: item.received_date,
          notes: item.notes,
          created_at: item.created_at,
        }));

        const mappedExpenses: RawExpenseItem[] = (expensesRes.data || []).map((item) => ({
          id: item.id,
          title: item.title,
          amount: Number(item.amount) || 0,
          category: item.category,
          account_id: item.account_id,
          expense_date: item.expense_date,
          notes: item.notes,
          created_at: item.created_at,
        }));

        setAccounts(mappedAccounts);
        setIncomes(mappedIncome);
        setExpenses(mappedExpenses);

        saveToCache(
          redisLedgerKey,
          {
            incomes: mappedIncome,
            expenses: mappedExpenses,
            accounts: mappedAccounts,
          },
          3600
        );
      }
    } catch {
      setErrorMsg("Unable to load ledger entries. Please try again.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        fetchAllData(true);
      }
    }
  }, [user, redisLedgerKey]);

  useEffect(() => {
    if (!user) return;
    fetchAllData();

    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-ledger-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "income", filter: `user_id=eq.${user.id}` }, () => {
        fetchAllData(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${user.id}` }, () => {
        fetchAllData(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` }, () => {
        fetchAllData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAllData]);

  // Synchronize ledger whenever another section modifies financial data
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchAllData(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("arthax:financial_data_updated", handleDataUpdated);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("arthax:financial_data_updated", handleDataUpdated);
      }
    };
  }, [fetchAllData]);

  const accountsMap = useMemo(() => {
    const map = new Map<string, AccountItem>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const totalPortfolioBalance = useMemo(() => {
    const assets = accounts
      .filter((a) => a.classification !== "liability")
      .reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
    const liabilities = accounts
      .filter((a) => a.classification === "liability")
      .reduce((acc, curr) => acc + Math.abs(Number(curr.balance) || 0), 0);
    return assets - liabilities;
  }, [accounts]);

  // Master Chronological Ledger & Running Balance Calculation
  const fullUnifiedLedger = useMemo(() => {
    const incomeEntries: LedgerEntry[] = incomes.map((inc) => ({
      id: inc.id,
      sourceType: "income",
      type: "CREDIT",
      title: inc.title,
      amount: inc.amount,
      category: inc.category,
      account_id: inc.account_id,
      date: inc.received_date,
      notes: inc.notes,
      frequency: inc.frequency,
      created_at: inc.created_at,
      account: inc.account_id ? accountsMap.get(inc.account_id) || null : null,
    }));

    const expenseEntries: LedgerEntry[] = expenses.map((exp) => ({
      id: exp.id,
      sourceType: "expense",
      type: "DEBIT",
      title: exp.title,
      amount: exp.amount,
      category: exp.category,
      account_id: exp.account_id,
      date: exp.expense_date,
      notes: exp.notes,
      created_at: exp.created_at,
      account: exp.account_id ? accountsMap.get(exp.account_id) || null : null,
    }));

    const combined = [...incomeEntries, ...expenseEntries];
    combined.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdA - createdB;
    });

    const totalCredits = combined
      .filter((e) => e.type === "CREDIT")
      .reduce((sum, e) => sum + e.amount, 0);
    const totalDebits = combined
      .filter((e) => e.type === "DEBIT")
      .reduce((sum, e) => sum + e.amount, 0);

    const baselinePortfolio = totalPortfolioBalance - (totalCredits - totalDebits);

    let running = baselinePortfolio;
    combined.forEach((entry) => {
      if (entry.type === "CREDIT") {
        running += entry.amount;
      } else {
        running -= entry.amount;
      }
      entry.runningBalance = running;
    });

    return combined;
  }, [incomes, expenses, accountsMap, totalPortfolioBalance]);

  // Filtered ledger entries
  const ledgerEntries = useMemo(() => {
    let list = fullUnifiedLedger;
    if (!isAllTime) {
      list = list.filter((e) => e.date.startsWith(selectedMonthYear));
    }
    if (typeFilter !== "all") {
      list = list.filter((e) => e.type === typeFilter);
    }
    if (accountFilter !== "all") {
      list = list.filter((e) => (e.account_id || "unallocated") === accountFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          (e.account?.name && e.account.name.toLowerCase().includes(q)) ||
          String(e.amount).includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (diff !== 0) return diff;
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdB - createdA;
    });
  }, [fullUnifiedLedger, isAllTime, selectedMonthYear, typeFilter, accountFilter, searchQuery]);

  // Financial KPI Calculations
  const kpiMetrics = useMemo(() => {
    let creditsTotal = 0;
    let creditsCount = 0;
    let debitsTotal = 0;
    let debitsCount = 0;

    const sourceEntries = isAllTime
      ? fullUnifiedLedger
      : fullUnifiedLedger.filter((e) => e.date.startsWith(selectedMonthYear));

    sourceEntries.forEach((entry) => {
      if (entry.type === "CREDIT") {
        creditsTotal += entry.amount;
        creditsCount += 1;
      } else {
        debitsTotal += entry.amount;
        debitsCount += 1;
      }
    });

    const netFlow = creditsTotal - debitsTotal;
    const totalVolume = creditsTotal + debitsTotal;

    return {
      creditsTotal,
      creditsCount,
      debitsTotal,
      debitsCount,
      netFlow,
      totalVolume,
    };
  }, [fullUnifiedLedger, isAllTime, selectedMonthYear]);

  // Prompt Delete Entry
  const promptDeleteEntry = (entry: LedgerEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEntryToDelete(entry);
    setIsDeleteModalOpen(true);
  };

  // Atomic Delete & Reverse Transaction
  const confirmDeleteAndReverse = async () => {
    if (!entryToDelete || !user) return;

    setDeleting(true);
    const supabase = createClient();

    try {
      if (entryToDelete.sourceType === "expense") {
        const { error: rpcError } = await supabase.rpc("fn_delete_expense_atomic", {
          p_expense_id: entryToDelete.id,
          p_user_id: user.id,
        });

        if (rpcError) {
          showToast("Deletion Failed", rpcError.message || "Could not delete ledger entry.", "error");
        } else {
          showToast("Transaction Reversed", `"${entryToDelete.title}" deleted and balance restored to account.`, "info");
          setIsDeleteModalOpen(false);
          if (selectedVoucher?.id === entryToDelete.id) {
            setSelectedVoucher(null);
          }
          setEntryToDelete(null);
          await invalidateAllCaches();
          await fetchAllData(true);
        }
      } else {
        const { error: rpcError } = await supabase.rpc("fn_delete_income_atomic", {
          p_income_id: entryToDelete.id,
          p_user_id: user.id,
        });

        if (rpcError) {
          showToast("Deletion Failed", rpcError.message || "Could not delete ledger entry.", "error");
        } else {
          showToast("Transaction Reversed", `"${entryToDelete.title}" deleted and credited balance reversed.`, "info");
          setIsDeleteModalOpen(false);
          if (selectedVoucher?.id === entryToDelete.id) {
            setSelectedVoucher(null);
          }
          setEntryToDelete(null);
          await invalidateAllCaches();
          await fetchAllData(true);
        }
      }
    } catch {
      showToast("Reversal Failed", "Failed to reverse transaction and restore balance.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main
      className="flex-1 h-full p-3.5 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* SECTION HEADER */}
      <PageHeader
        title="General Ledger"
        description="Double-entry statements, passbooks, and chronologically reconciled running balances."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Stepper */}
            <div
              className="flex items-center rounded-xl border p-0.5 text-xs font-mono"
              style={{
                borderColor: "var(--app-border)",
                backgroundColor: "var(--app-card)",
              }}
            >
              <button
                onClick={handlePrevMonth}
                disabled={!canGoPrev}
                title={!canGoPrev ? "No earlier ledger records" : "Previous Month"}
                className={`p-1.5 rounded-lg transition-all ${
                  !canGoPrev
                    ? "opacity-25 cursor-not-allowed"
                    : "opacity-70 hover:opacity-100 cursor-pointer"
                }`}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 font-semibold min-w-[110px] text-center">
                {monthDisplayTitle}
              </span>
              <button
                onClick={handleNextMonth}
                disabled={!canGoNext}
                title={!canGoNext ? "Future months are not yet available" : "Next Month"}
                className={`p-1.5 rounded-lg transition-all ${
                  !canGoNext
                    ? "opacity-25 cursor-not-allowed"
                    : "opacity-70 hover:opacity-100 cursor-pointer"
                }`}
              >
                <ChevronRight size={14} />
              </button>
              {!isCurrentMonth && !isAllTime && (
                <button
                  onClick={handleResetToCurrentMonth}
                  className="ml-1 px-2 py-1 text-[10px] uppercase font-bold rounded-md border cursor-pointer opacity-70 hover:opacity-100"
                  style={{ borderColor: "var(--app-border-subtle)" }}
                >
                  Today
                </button>
              )}
            </div>

            {/* All Time Toggle */}
            <Button
              variant={isAllTime ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIsAllTime(!isAllTime)}
            >
              All Time
            </Button>
          </div>
        }
      />

      {errorMsg && (
        <div
          className="mb-6 p-4 rounded-xl text-xs border flex items-center gap-3 text-rose-400"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card)",
          }}
        >
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI OVERVIEW SUMMARY METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Credits (Inflow)"
          value={
            <span className="text-emerald-400 font-mono font-extrabold">
              +{formatINR(kpiMetrics.creditsTotal)}
            </span>
          }
          subtitle={`${kpiMetrics.creditsCount} transactions • deposits & salaries`}
          icon={<TrendingUp size={16} />}
          iconColor="emerald"
        />

        <StatCard
          title="Debits (Outflow)"
          value={
            <span className="text-rose-400 font-mono font-extrabold">
              -{formatINR(kpiMetrics.debitsTotal)}
            </span>
          }
          subtitle={`${kpiMetrics.debitsCount} transactions • expenses & bills`}
          icon={<TrendingDown size={16} />}
          iconColor="rose"
        />

        <StatCard
          title="Net Movement"
          value={
            <span
              className={`font-mono font-extrabold ${
                kpiMetrics.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {kpiMetrics.netFlow >= 0 ? "+" : ""}
              {formatINR(kpiMetrics.netFlow)}
            </span>
          }
          subtitle={
            kpiMetrics.netFlow >= 0
              ? "Surplus net flow for period"
              : "Deficit net flow for period"
          }
          icon={<ArrowUpDown size={16} />}
          iconColor={kpiMetrics.netFlow >= 0 ? "emerald" : "rose"}
        />

        <StatCard
          title="Total Portfolio Net"
          value={<span className="font-mono font-extrabold">{formatINR(totalPortfolioBalance)}</span>}
          subtitle={`Turnover Volume: ${formatINR(kpiMetrics.totalVolume)}`}
          icon={<Wallet size={16} />}
          iconColor="sky"
        />
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search title, category, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={14} />}
            />
          </div>

          {/* Type Segmented Pill */}
          <SegmentedControl
            options={[
              { value: "all", label: "All Types" },
              { value: "CREDIT", label: "Credits (+)" },
              { value: "DEBIT", label: "Debits (-)" },
            ]}
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as "all" | "CREDIT" | "DEBIT")}
            size="sm"
          />

          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border font-sans cursor-pointer focus:outline-none"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-card)",
              color: "var(--app-fg)",
            }}
          >
            <option value="all">All Accounts</option>
            <option value="unallocated">Unallocated / Cash</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        <Badge variant="outline" className="font-mono self-end sm:self-auto">
          {ledgerEntries.length} Entries • {isAllTime ? "All Time" : monthDisplayTitle}
        </Badge>
      </div>

      {/* LEDGER DATA VIEW: JOURNAL TABLE */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : ledgerEntries.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} className="text-muted-foreground" />}
          title="No Ledger Entries Found"
          description={
            searchQuery || typeFilter !== "all" || accountFilter !== "all"
              ? "No transactions match your current search and filter criteria."
              : `No entries recorded for ${isAllTime ? "all time" : monthDisplayTitle}. Logged income and expenses will appear here automatically.`
          }
        />
      ) : (
        /* JOURNAL TABULAR VIEW */
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr
                  className="border-b text-[11px] font-bold uppercase tracking-wider select-none font-mono opacity-60"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-bg)",
                    color: "var(--app-fg)",
                  }}
                >
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Description & Details</th>
                  <th className="py-3 px-4 font-semibold">Account</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-right">Debit (-)</th>
                  <th className="py-3 px-4 font-semibold text-right">Credit (+)</th>
                  <th className="py-3 px-4 font-semibold text-right">Running Balance</th>
                  <th className="py-3 px-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--app-border-subtle)" }}>
                {ledgerEntries.map((entry) => {
                  const relTag = getRelativeDateTag(entry.date);
                  const isCredit = entry.type === "CREDIT";

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedVoucher(entry)}
                      className="group transition-colors cursor-pointer hover:bg-[var(--app-card-hover)]"
                      style={{ borderColor: "var(--app-border-subtle)" }}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs">{formatDateDisplay(entry.date)}</div>
                        {relTag && (
                          <span
                            className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded border"
                            style={{
                              borderColor: "var(--app-border-subtle)",
                              backgroundColor: "var(--app-bg)",
                            }}
                          >
                            {relTag}
                          </span>
                        )}
                      </td>

                      {/* Description & Details */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <EntityLogo
                            name={entry.title}
                            category={entry.category}
                            size={36}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm tracking-tight truncate" title={entry.title}>
                              {entry.title}
                            </div>
                            {entry.notes && (
                              <div className="text-[11px] opacity-60 truncate mt-0.5" title={entry.notes}>
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Account */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {entry.account ? (
                          <div className="flex items-center gap-2.5">
                            <BankLogo name={entry.account.name} size={24} />
                            <span className="font-medium text-xs">{entry.account.name}</span>
                            {entry.account.last_four &&
                              entry.account.last_four.toUpperCase() !== "CASH" &&
                              /^\d+$/.test(entry.account.last_four.trim()) && (
                                <span className="text-[10px] opacity-60 font-mono">
                                  ••{entry.account.last_four.slice(-4)}
                                </span>
                              )}
                          </div>
                        ) : (
                          <span className="text-xs opacity-50 italic">Unallocated</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant="outline">{entry.category}</Badge>
                      </td>

                      {/* Debit */}
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap font-medium text-rose-400">
                        {!isCredit ? `-${formatINR(entry.amount)}` : <span className="opacity-20">—</span>}
                      </td>

                      {/* Credit */}
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap font-medium text-emerald-400">
                        {isCredit ? `+${formatINR(entry.amount)}` : <span className="opacity-20">—</span>}
                      </td>

                      {/* Running Balance */}
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap font-bold">
                        {entry.runningBalance !== undefined ? formatINR(entry.runningBalance) : "—"}
                      </td>

                      {/* Actions: Delete & Reverse */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete and reverse balance"
                            className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10"
                            icon={<Trash2 size={13} />}
                            onClick={(e) => promptDeleteEntry(entry, e)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: TRANSACTION VOUCHER DETAIL MODAL */}
      <Modal
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
        title="Transaction Details"
        size="sm"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="xs"
              className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10"
              icon={<Trash2 size={12} />}
              onClick={() => selectedVoucher && promptDeleteEntry(selectedVoucher)}
            >
              Delete & Reverse
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={() => setSelectedVoucher(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedVoucher && (
          <div className="space-y-2.5">
            {/* Voucher Amount Badge */}
            <div
              className="p-2.5 rounded-xl border text-center space-y-0.5"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">
                {selectedVoucher.type === "CREDIT" ? "Credit Inflow" : "Debit Outflow"}
              </div>
              <div
                className={`text-xl sm:text-2xl font-extrabold font-mono tabular-nums ${
                  selectedVoucher.type === "CREDIT" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {selectedVoucher.type === "CREDIT" ? "+" : "-"}
                {formatINR(selectedVoucher.amount)}
              </div>
              <div className="flex items-center justify-center gap-1.5 pt-0.5">
                <EntityLogo name={selectedVoucher.title} category={selectedVoucher.category} size={18} />
                <span className="text-xs opacity-80 font-semibold">{selectedVoucher.title}</span>
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-0.5 border-b border-[var(--app-border-subtle)]">
                <span className="opacity-60 text-[11px]">Date</span>
                <span className="font-mono font-medium text-[11px]">{formatDateDisplay(selectedVoucher.date)}</span>
              </div>

              <div className="flex items-center justify-between py-0.5 border-b border-[var(--app-border-subtle)]">
                <span className="opacity-60 text-[11px]">Category</span>
                <Badge variant="outline">{selectedVoucher.category}</Badge>
              </div>

              <div className="flex items-center justify-between py-0.5 border-b border-[var(--app-border-subtle)]">
                <span className="opacity-60 text-[11px]">Account</span>
                {selectedVoucher.account ? (
                  <div className="flex items-center gap-1.5 font-medium text-[11px]">
                    <BankLogo name={selectedVoucher.account.name} size={16} />
                    <span>{selectedVoucher.account.name}</span>
                    {selectedVoucher.account.last_four &&
                      selectedVoucher.account.last_four.toUpperCase() !== "CASH" &&
                      /^\d+$/.test(selectedVoucher.account.last_four.trim()) && (
                        <span className="font-mono opacity-60">•••{selectedVoucher.account.last_four}</span>
                      )}
                  </div>
                ) : (
                  <span className="opacity-50 italic text-[11px]">None / Unallocated</span>
                )}
              </div>

              {selectedVoucher.frequency && (
                <div className="flex items-center justify-between py-0.5 border-b border-[var(--app-border-subtle)]">
                  <span className="opacity-60 text-[11px]">Frequency</span>
                  <span className="font-medium text-[11px]">{selectedVoucher.frequency}</span>
                </div>
              )}

              {selectedVoucher.runningBalance !== undefined && (
                <div className="flex items-center justify-between py-0.5 border-b border-[var(--app-border-subtle)]">
                  <span className="opacity-60 text-[11px]">Running Balance</span>
                  <span className="font-mono font-bold text-[11px]">{formatINR(selectedVoucher.runningBalance)}</span>
                </div>
              )}

              {selectedVoucher.notes && (
                <div className="py-0.5 space-y-0.5">
                  <span className="opacity-60 block text-[10px]">Notes:</span>
                  <div
                    className="p-1.5 rounded-lg border font-mono text-[10px] whitespace-pre-wrap max-h-16 overflow-y-auto leading-relaxed"
                    style={{
                      borderColor: "var(--app-border-subtle)",
                      backgroundColor: "var(--app-bg)",
                    }}
                  >
                    {selectedVoucher.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: DELETE & AUTOMATIC REVERSAL CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen && !!entryToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setEntryToDelete(null);
        }}
        title="Delete & Reverse Entry"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => {
                setIsDeleteModalOpen(false);
                setEntryToDelete(null);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={deleting}
              icon={<Trash2 size={12} />}
              onClick={confirmDeleteAndReverse}
            >
              Delete & Reverse
            </Button>
          </div>
        }
      >
        {entryToDelete && (
          <div className="space-y-2.5">
            <p className="text-xs opacity-75 leading-relaxed">
              Delete <strong>&ldquo;{entryToDelete.title}&rdquo;</strong> (
              <span className="font-mono font-bold">{formatINR(entryToDelete.amount)}</span>) from the ledger?
            </p>

            {/* Reversal Notice */}
            {entryToDelete.account && (
              <div
                className="p-2.5 rounded-xl border space-y-1 text-xs"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <div className="flex items-center gap-1.5 font-bold text-[11px]">
                  <RotateCcw size={12} className={entryToDelete.type === "DEBIT" ? "text-emerald-400" : "text-amber-400"} />
                  <span>Automatic Balance Reversal</span>
                </div>
                {entryToDelete.type === "DEBIT" ? (
                  <p className="opacity-80 text-[10px] leading-relaxed">
                    Will <span className="text-emerald-400 font-semibold">refund +{formatINR(entryToDelete.amount)}</span> back into{" "}
                    <span className="font-bold">{entryToDelete.account.name}</span>.
                  </p>
                ) : (
                  <p className="opacity-80 text-[10px] leading-relaxed">
                    Will <span className="text-rose-400 font-semibold">deduct -{formatINR(entryToDelete.amount)}</span> from{" "}
                    <span className="font-bold">{entryToDelete.account.name}</span>.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}
