"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen,
  Loader2,
  Trash2,
  Wallet,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import BankLogo from "@/components/BankLogo";
import EntityLogo from "@/components/EntityLogo";
import { CACHE_KEYS, getUserCacheKey } from "@/utils/redis";
import { saveToCache, invalidateCacheKeys, getFromLocalCache } from "@/utils/cacheClient";
import {
  getCurrentMonthYear,
  formatMonthDisplay,
  getEarliestDataMonth,
  computeNextMonth,
  computePrevMonth,
} from "@/utils/monthUtils";

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

  // Get relative date tag (Today, Yesterday)
  const getRelativeDateTag = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return null;
  };

  // Invalidate Redis caches across all related keys
  const invalidateAllCaches = async () => {
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

  // 1. Fetch All Ledger Telemetry
  const fetchAllData = useCallback(async (skipCache = false) => {
    if (!user) return;
    setErrorMsg(null);

    // Instant local cache check
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

      // Parallel query scoped to current user
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
          last_four: a.last_four,
          created_at: a.created_at,
        }));

        // Sort accounts so Cash in Hand is first
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

        // Cache combined snapshot
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
    }
  }, [user, redisLedgerKey]);

  // Initial load & Supabase Realtime synchronization
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

  // Helper map for quick account lookup
  const accountsMap = useMemo(() => {
    const map = new Map<string, AccountItem>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  // Total Portfolio Net Balance across all accounts
  const totalPortfolioBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accounts]);

  // 2. Synthesize Master Chronological Ledger & Compute Precise Running Balances
  const fullUnifiedLedger = useMemo(() => {
    // A. Map income items to CREDIT ledger entries
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

    // B. Map expense items to DEBIT ledger entries
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

    // C. Combine and sort chronologically (oldest to newest) to calculate forward running balance
    const combined = [...incomeEntries, ...expenseEntries];
    combined.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdA - createdB;
    });

    // D. Compute Running Balance (Consolidated Master Portfolio)
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

  // Sort entries newest first for display in the journal table, filtered by selected month or all time
  const ledgerEntries = useMemo(() => {
    let list = fullUnifiedLedger;
    if (!isAllTime) {
      list = list.filter((e) => e.date.startsWith(selectedMonthYear));
    }
    return [...list].sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (diff !== 0) return diff;
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdB - createdA;
    });
  }, [fullUnifiedLedger, isAllTime, selectedMonthYear]);

  // 3. Financial KPI Calculations
  const kpiMetrics = useMemo(() => {
    let creditsTotal = 0;
    let creditsCount = 0;
    let debitsTotal = 0;
    let debitsCount = 0;

    ledgerEntries.forEach((entry) => {
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
  }, [ledgerEntries]);

  // 4. Prompt Delete Entry
  const promptDeleteEntry = (entry: LedgerEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEntryToDelete(entry);
    setIsDeleteModalOpen(true);
  };

  // 6. Atomic Delete & Reverse Transaction
  // When an entry is deleted from the ledger, its impact on the account balance is ALWAYS reversed atomically
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
          showToast("Delete Failed", rpcError.message || "Could not delete entry.", "error");
        } else {
          showToast("Reversed & Deleted", `${entryToDelete.title} deleted and balance restored to account.`, "info");
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
          showToast("Delete Failed", rpcError.message || "Could not delete entry.", "error");
        } else {
          showToast("Reversed & Deleted", `${entryToDelete.title} deleted and balance reversed.`, "info");
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
      showToast("Error", "Failed to reverse and delete entry.", "error");
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
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen size={24} className="text-amber-400 flex-shrink-0" />
            <span>General Ledger</span>
          </h1>
          <p className="text-xs opacity-70 mt-1">
            Double-entry statements, account passbooks, and running balances.
          </p>
        </div>

        {/* Top Action Toolbar: Month with Year Stepper */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Stepper */}
          <div
            className="flex items-center rounded-xl border p-0.5 text-xs font-mono"
            style={{
              borderColor: "var(--app-border-subtle)",
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
          <button
            onClick={() => setIsAllTime(!isAllTime)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
              isAllTime ? "shadow-sm font-bold" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: isAllTime ? "var(--app-fg)" : "var(--app-card)",
              color: isAllTime ? "var(--app-bg)" : "var(--app-fg)",
              borderColor: isAllTime ? "var(--app-fg)" : "var(--app-border-subtle)",
            }}
          >
            All Time
          </button>
        </div>
      </div>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Credits */}
        <div
          className="rounded-2xl p-5 border space-y-2 transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-60 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-400" />
              <span>Credits (Inflow)</span>
            </span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              {kpiMetrics.creditsCount} Txns
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight font-mono text-emerald-400">
            +{formatINR(kpiMetrics.creditsTotal)}
          </div>
          <p className="text-[11px] opacity-60">Deposits, salaries, and income</p>
        </div>

        {/* Total Debits */}
        <div
          className="rounded-2xl p-5 border space-y-2 transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-60 flex items-center gap-1.5">
              <TrendingDown size={14} className="text-rose-400" />
              <span>Debits (Outflow)</span>
            </span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              {kpiMetrics.debitsCount} Txns
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight font-mono text-rose-400">
            -{formatINR(kpiMetrics.debitsTotal)}
          </div>
          <p className="text-[11px] opacity-60">Expenses, bills, and withdrawals</p>
        </div>

        {/* Net Cashflow Position */}
        <div
          className="rounded-2xl p-5 border space-y-2 transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-60 flex items-center gap-1.5">
              <ArrowUpDown size={14} />
              <span>Net Movement</span>
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                kpiMetrics.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              {kpiMetrics.netFlow >= 0 ? "SURPLUS" : "DEFICIT"}
            </span>
          </div>
          <div
            className={`text-2xl font-extrabold tracking-tight font-mono ${
              kpiMetrics.netFlow >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {kpiMetrics.netFlow >= 0 ? "+" : ""}
            {formatINR(kpiMetrics.netFlow)}
          </div>
          <p className="text-[11px] opacity-60">Inflow minus outflow in period</p>
        </div>

        {/* Ledger Balance / Turnover */}
        <div
          className="rounded-2xl p-5 border space-y-2 transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-60 flex items-center gap-1.5">
              <Wallet size={14} />
              <span>Total Portfolio Net</span>
            </span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded border"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              INR (₹)
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight font-mono">
            {formatINR(totalPortfolioBalance)}
          </div>
          <p className="text-[11px] opacity-60">
            Total Turnover: {formatINR(kpiMetrics.totalVolume)}
          </p>
        </div>
      </div>

      {/* TABLE HEADER / ENTRY COUNTER */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">
          Journal Transactions
        </h2>
        <span
          className="text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-medium"
          style={{
            borderColor: "var(--app-border-subtle)",
            backgroundColor: "var(--app-card)",
          }}
        >
          {ledgerEntries.length} Entries • {isAllTime ? "All Time" : monthDisplayTitle}
        </span>
      </div>

      {/* LEDGER DATA VIEW: JOURNAL TABLE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 size={24} className="animate-spin opacity-50" />
          <span className="text-xs opacity-60 font-mono">Synchronizing financial ledger...</span>
        </div>
      ) : ledgerEntries.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center border transition-colors shadow-sm space-y-4"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div
            className="w-12 h-12 mx-auto rounded-full flex items-center justify-center border"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-bg)",
            }}
          >
            <BookOpen size={20} className="opacity-40" />
          </div>
          <div>
            <h3 className="text-base font-bold">No Ledger Entries Found</h3>
            <p className="text-xs opacity-60 mt-1 max-w-sm mx-auto">
              Transactions logged under Income and Expenses will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        /* JOURNAL TABULAR VIEW (Zerodha Kite Style) */
        <div
          className="rounded-2xl border overflow-hidden shadow-sm transition-colors"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr
                  className="border-b text-[11px] font-bold uppercase tracking-wider select-none"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-bg)",
                    color: "var(--app-fg)",
                  }}
                >
                  <th className="py-3 px-4 font-semibold opacity-70">Date</th>
                  <th className="py-3 px-4 font-semibold opacity-70">Description & Details</th>
                  <th className="py-3 px-4 font-semibold opacity-70">Account</th>
                  <th className="py-3 px-4 font-semibold opacity-70">Category</th>
                  <th className="py-3 px-4 font-semibold opacity-70 text-right">Debit (-)</th>
                  <th className="py-3 px-4 font-semibold opacity-70 text-right">Credit (+)</th>
                  <th className="py-3 px-4 font-semibold opacity-70 text-right">Running Balance</th>
                  <th className="py-3 px-4 font-semibold opacity-70 text-center">Actions</th>
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
                            {entry.account.last_four && (
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
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full border inline-block"
                          style={{
                            borderColor: "var(--app-border-subtle)",
                            backgroundColor: "var(--app-bg)",
                          }}
                        >
                          {entry.category}
                        </span>
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
                          <button
                            onClick={(e) => promptDeleteEntry(entry, e)}
                            title="Delete and reverse balance"
                            className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: TRANSACTION VOUCHER DETAIL MODAL */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-5 sm:p-6 space-y-5 shadow-2xl transition-all select-text"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-amber-400" />
                <h3 className="font-bold text-base">Transaction Voucher</h3>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="p-1 rounded hover:bg-[var(--app-card-hover)] opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Voucher Amount Badge */}
            <div
              className="p-4 rounded-xl border text-center space-y-1"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                {selectedVoucher.type === "CREDIT" ? "Credit Inflow" : "Debit Outflow"}
              </div>
              <div
                className={`text-3xl font-extrabold font-mono tabular-nums ${
                  selectedVoucher.type === "CREDIT" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {selectedVoucher.type === "CREDIT" ? "+" : "-"}
                {formatINR(selectedVoucher.amount)}
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <EntityLogo name={selectedVoucher.title} category={selectedVoucher.category} size={24} />
                <span className="text-xs opacity-80 font-semibold">{selectedVoucher.title}</span>
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                <span className="opacity-60">Date of Transaction</span>
                <span className="font-mono font-medium">{formatDateDisplay(selectedVoucher.date)}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                <span className="opacity-60">Category</span>
                <span className="font-medium px-2 py-0.5 rounded border" style={{ borderColor: "var(--app-border-subtle)" }}>
                  {selectedVoucher.category}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                <span className="opacity-60">Account Linked</span>
                {selectedVoucher.account ? (
                  <div className="flex items-center gap-2 font-medium">
                    <BankLogo name={selectedVoucher.account.name} size={22} />
                    <span>{selectedVoucher.account.name}</span>
                    {selectedVoucher.account.last_four && (
                      <span className="font-mono opacity-60">•••{selectedVoucher.account.last_four}</span>
                    )}
                  </div>
                ) : (
                  <span className="opacity-50 italic">None / Unallocated</span>
                )}
              </div>

              {selectedVoucher.frequency && (
                <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                  <span className="opacity-60">Frequency</span>
                  <span className="font-medium">{selectedVoucher.frequency}</span>
                </div>
              )}

              {selectedVoucher.runningBalance !== undefined && (
                <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                  <span className="opacity-60">Balance Post-Transaction</span>
                  <span className="font-mono font-bold">{formatINR(selectedVoucher.runningBalance)}</span>
                </div>
              )}

              {selectedVoucher.notes && (
                <div className="py-2 space-y-1">
                  <span className="opacity-60 block">Notes & Narration:</span>
                  <div
                    className="p-3 rounded-lg border font-mono text-[11px] whitespace-pre-wrap"
                    style={{
                      borderColor: "var(--app-border-subtle)",
                      backgroundColor: "var(--app-bg)",
                    }}
                  >
                    {selectedVoucher.notes}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-1 opacity-50 text-[10px] font-mono">
                <span>Voucher ID: {selectedVoucher.id}</span>
                <span>Source: {selectedVoucher.sourceType.toUpperCase()}</span>
              </div>
            </div>

            {/* Actions: Delete & Close */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  promptDeleteEntry(selectedVoucher);
                }}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:underline cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete & Reverse Entry</span>
              </button>

              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer opacity-80 hover:opacity-100"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE & AUTOMATIC REVERSAL CONFIRMATION MODAL */}
      {isDeleteModalOpen && entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl transition-all"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle size={22} className="flex-shrink-0" />
              <h3 className="font-bold text-base">Delete & Reverse Transaction</h3>
            </div>

            <p className="text-xs opacity-75">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold" style={{ color: "var(--app-fg)" }}>"{entryToDelete.title}"</span> (
              {formatINR(entryToDelete.amount)}) from the ledger?
            </p>

            {/* Explicit Automatic Reversal Notice */}
            {entryToDelete.account ? (
              <div
                className="p-3.5 rounded-xl border space-y-1.5 text-xs"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <div className="flex items-center gap-2 font-bold">
                  <RotateCcw size={14} className={entryToDelete.type === "DEBIT" ? "text-emerald-400" : "text-amber-400"} />
                  <span>Automatic Balance Reversal</span>
                </div>
                {entryToDelete.type === "DEBIT" ? (
                  <p className="opacity-80 text-[11px] leading-relaxed">
                    This was an outflow debit of <span className="font-mono font-bold text-emerald-400">+{formatINR(entryToDelete.amount)}</span>.
                    Deleting it will <span className="text-emerald-400 font-semibold">refund the money back</span> into{" "}
                    <span className="font-bold">{entryToDelete.account.name}</span>.
                  </p>
                ) : (
                  <p className="opacity-80 text-[11px] leading-relaxed">
                    This was an inflow credit of <span className="font-mono font-bold text-rose-400">-{formatINR(entryToDelete.amount)}</span>.
                    Deleting it will <span className="text-rose-400 font-semibold">deduct the money back</span> from{" "}
                    <span className="font-bold">{entryToDelete.account.name}</span>.
                  </p>
                )}
              </div>
            ) : (
              <div
                className="p-3 rounded-xl border text-[11px] opacity-70"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                This entry has no linked account. It will be removed from the ledger without affecting account balances.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setEntryToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer opacity-70 hover:opacity-100"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteAndReverse}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span>{deleting ? "Reversing..." : "Delete & Reverse Balance"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
