"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Check,
  CheckCircle2,
  Loader2,
  Download,
  FolderDown,
  TrendingDown,
  TrendingUp,
  Target,
  Landmark,
  Receipt,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  User,
  Shield,
  ShieldCheck,
  RotateCcw,
  LogOut,
  Lock,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import {
  exportLedgerPDF,
  exportExpensesPDF,
  exportIncomePDF,
  exportBudgetsPDF,
  exportAccountsPDF,
  exportMasterPortfolioPDF,
} from "@/utils/pdfExport";
import { invalidateCacheKeys, getFromLocalCache, saveToLocalCache } from "@/utils/cacheClient";
import { CACHE_KEYS, getUserCacheKey } from "@/utils/redis";

// Utility function to escape CSV values according to RFC 4180
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Utility to trigger client-side file downloads with UTF-8 BOM support
function triggerFileDownload(content: string, fileName: string, mimeType: string = "text/csv;charset=utf-8;") {
  const isCSV = fileName.endsWith(".csv");
  // Prepend UTF-8 Byte Order Mark (BOM) so Excel on Windows/Mac renders accents & currency cleanly
  const payload = isCSV && !content.startsWith("\uFEFF") ? "\uFEFF" + content : content;
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

interface DataCounts {
  accounts: number;
  income: number;
  expenses: number;
  budgets: number;
  ledger: number;
  total: number;
}

export default function SettingsSection() {
  const { user, profile, refreshProfile, signOut, updateProfileLocally } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [greetingName, setGreetingName] = useState(profile?.name || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [cacheSyncing, setCacheSyncing] = useState(false);

  const [counts, setCounts] = useState<DataCounts>({
    accounts: 0,
    income: 0,
    expenses: 0,
    budgets: 0,
    ledger: 0,
    total: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [exportingTarget, setExportingTarget] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string>("ledger");
  const [showAllDatasets, setShowAllDatasets] = useState<boolean>(true);

  // Keep a ref to current name for Realtime conflict avoidance
  const nameInputRef = useRef(greetingName);
  nameInputRef.current = greetingName;
  const isDirtyRef = useRef(false);

  const userId = user?.id || "default_user";

  const googleAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const isGoogleUser = !!googleAvatarUrl || user?.app_metadata?.provider === "google" || user?.identities?.some((i) => i.provider === "google");

  const initials = useMemo(() => {
    const source = greetingName || profile?.name || user?.user_metadata?.full_name || user?.email || "";
    if (!source) return "U";
    const parts = source.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.substring(0, 2).toUpperCase();
  }, [greetingName, profile?.name, user]);

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17) return "Good evening";
    return "Good morning";
  }, []);

  // Keep greetingName in sync with profile arriving or updating from AuthContext
  useEffect(() => {
    if (profile?.name && !isDirtyRef.current) {
      setGreetingName(profile.name);
    }
  }, [profile?.name]);

  // Fetch telemetry counts from Supabase
  const refreshCounts = useCallback(async () => {
    try {
      const supabase = createClient();
      let accQuery = supabase.from("accounts").select("id", { count: "exact", head: true });
      let incQuery = supabase.from("income").select("id", { count: "exact", head: true });
      let expQuery = supabase.from("expenses").select("id", { count: "exact", head: true });
      let budQuery = supabase.from("budgets").select("id", { count: "exact", head: true });

      if (user?.id) {
        accQuery = accQuery.eq("user_id", user.id);
        incQuery = incQuery.eq("user_id", user.id);
        expQuery = expQuery.eq("user_id", user.id);
        budQuery = budQuery.eq("user_id", user.id);
      }

      const [accRes, incRes, expRes, budRes] = await Promise.all([
        accQuery,
        incQuery,
        expQuery,
        budQuery,
      ]);

      const accountsCount = accRes.count || 0;
      const incomeCount = incRes.count || 0;
      const expensesCount = expRes.count || 0;
      const budgetsCount = budRes.count || 0;
      const ledgerCount = incomeCount + expensesCount;
      const totalCount = accountsCount + incomeCount + expensesCount + budgetsCount;

      setCounts({
        accounts: accountsCount,
        income: incomeCount,
        expenses: expensesCount,
        budgets: budgetsCount,
        ledger: ledgerCount,
        total: totalCount,
      });
    } catch (err) {
      console.error("Error fetching record counts:", err);
    } finally {
      setLoadingCounts(false);
    }
  }, [user]);

  // Initial load & Supabase Realtime synchronization
  useEffect(() => {
    if (!user?.id) return;

    const fetchCurrentName = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("user_settings")
          .select("name")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.name && !isDirtyRef.current) {
          setGreetingName(data.name);
          updateProfileLocally?.({ name: data.name });
        } else if (profile?.name && !isDirtyRef.current) {
          setGreetingName(profile.name);
        }
      } catch (err) {
        console.error("Error reading settings:", err);
      }
    };

    fetchCurrentName();
    refreshCounts();

    // Cross-device Realtime synchronization
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-settings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          // Only sync if user is not actively typing a different name
          if (payload.new?.name && !isDirtyRef.current && payload.new.name !== nameInputRef.current) {
            setGreetingName(payload.new.name);
            updateProfileLocally?.({ name: payload.new.name });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
          filter: `user_id=eq.${userId}`,
        },
        () => refreshCounts()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "income",
          filter: `user_id=eq.${userId}`,
        },
        () => refreshCounts()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `user_id=eq.${userId}`,
        },
        () => refreshCounts()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budgets",
          filter: `user_id=eq.${userId}`,
        },
        () => refreshCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshCounts]);

  // Save Greeting Name Function (Explicit Manual & Blur)
  const handleSaveName = async (customName?: string) => {
    if (!user?.id) {
      showToast("Session Error", "User session is still connecting. Please try again.", "error");
      return;
    }

    const nameToSave = (customName !== undefined ? customName : greetingName).trim();
    if (!nameToSave) {
      showToast("Validation Error", "Greeting name cannot be empty.", "error");
      return;
    }

    setSaveStatus("saving");

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          id: user.id,
          name: nameToSave,
          theme: theme || "ultra",
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        setSaveStatus("saved");
        isDirtyRef.current = false;

        // 1. Immediately update AuthContext in-memory and local cache
        if (updateProfileLocally) {
          updateProfileLocally({ name: nameToSave });
        }

        // 2. Synchronize Portfolio cache so Dashboard sees it instantly & on refresh
        const portfolioKey = getUserCacheKey(user.id, CACHE_KEYS.PORTFOLIO);
        const cachedPortfolio = getFromLocalCache<any>(portfolioKey);
        if (cachedPortfolio) {
          saveToLocalCache(portfolioKey, { ...cachedPortfolio, name: nameToSave });
        }

        showToast("Greeting Saved", `Welcome name set to "${nameToSave}".`, "success");
        if (refreshProfile) refreshProfile();
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("idle");
        showToast("Save Failed", error.message || "Could not save name.", "error");
      }
    } catch {
      setSaveStatus("idle");
      showToast("Connection Error", "Please check your network connection.", "error");
    }
  };

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirtyRef.current = true;
    setGreetingName(e.target.value);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    }
  };

  const handleNameBlur = () => {
    const trimmed = greetingName.trim();
    if (isDirtyRef.current && trimmed && trimmed !== (profile?.name || "")) {
      handleSaveName();
    }
  };

  const handlePurgeCacheAndSync = async () => {
    setCacheSyncing(true);
    try {
      const keysToPurge = [
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.SETTINGS),
      ];

      await invalidateCacheKeys(keysToPurge);
      await refreshCounts();
      if (refreshProfile) await refreshProfile();

      showToast("Refreshed", "All balances and statements updated.", "success");
    } catch (err) {
      console.error("Refresh failed:", err);
      showToast("Error", "Could not refresh data.", "error");
    } finally {
      setCacheSyncing(false);
    }
  };

  // Helper to query all database records freshly for exports
  const fetchAllData = async () => {
    const supabase = createClient();
    let accQuery = supabase.from("accounts").select("*").order("name");
    let incQuery = supabase.from("income").select("*").order("received_date", { ascending: false });
    let expQuery = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    let budQuery = supabase.from("budgets").select("*").order("created_at", { ascending: false });
    const setQuery = supabase.from("user_settings").select("*").eq("id", userId).maybeSingle();

    if (user?.id) {
      accQuery = accQuery.eq("user_id", user.id);
      incQuery = incQuery.eq("user_id", user.id);
      expQuery = expQuery.eq("user_id", user.id);
      budQuery = budQuery.eq("user_id", user.id);
    }

    const [accRes, incRes, expRes, budRes, setRes] = await Promise.all([
      accQuery,
      incQuery,
      expQuery,
      budQuery,
      setQuery,
    ]);

    return {
      accounts: accRes.data || [],
      income: incRes.data || [],
      expenses: expRes.data || [],
      budgets: budRes.data || [],
      settings: setRes.data || null,
    };
  };

  // 1. Export All Data (JSON)
  const handleExportAllJSON = async () => {
    try {
      setExportingTarget("all_json");
      const { accounts, income, expenses, budgets, settings } = await fetchAllData();
      const totalItems = accounts.length + income.length + expenses.length + budgets.length;

      if (totalItems === 0) {
        showToast("No Data", "No records found in database to export.", "info");
        return;
      }

      const backupObject = {
        app: "arthaX",
        version: "1.0",
        export_timestamp: new Date().toISOString(),
        summary: {
          accounts_count: accounts.length,
          income_count: income.length,
          expenses_count: expenses.length,
          budgets_count: budgets.length,
          total_transactions: income.length + expenses.length,
          total_records: totalItems,
        },
        user_settings: settings,
        accounts,
        income,
        expenses,
        budgets,
      };

      const dateStr = new Date().toISOString().split("T")[0];
      const jsonContent = JSON.stringify(backupObject, null, 2);
      triggerFileDownload(jsonContent, `arthaX_backup_${dateStr}.json`, "application/json");

      showToast("Export Ready", `Full JSON backup (${totalItems} items) downloaded.`, "success");
      refreshCounts();
    } catch (err) {
      console.error("JSON Export failed:", err);
      showToast("Export Failed", "Could not export database backup.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // CSV Generator: Expenses (Clean RFC 4180 without URI prefix)
  const getExpensesCSV = (expenses: any[], accounts: any[]) => {
    const headers = ["Expense Title", "Amount (INR)", "Category", "Expense Date", "Paid From Account", "Notes", "Voucher ID"];
    const rows = expenses.map((item) => {
      const acc = accounts.find((a) => a.id === item.account_id);
      return [
        escapeCSV(item.title),
        Number(item.amount).toFixed(2),
        escapeCSV(item.category),
        item.expense_date,
        escapeCSV(acc ? acc.name : "Unlinked"),
        escapeCSV(item.notes || ""),
        escapeCSV(item.id),
      ];
    });
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  };

  // 2. Export Expenses CSV
  const handleExportExpensesCSV = async () => {
    try {
      setExportingTarget("expenses");
      const { expenses, accounts } = await fetchAllData();
      if (expenses.length === 0) {
        showToast("No Data", "There are no expenses to export.", "info");
        return;
      }

      const csvData = getExpensesCSV(expenses, accounts);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerFileDownload(csvData, `arthaX_expenses_${dateStr}.csv`);
      showToast("Export Ready", `${expenses.length} expenses exported to CSV.`, "success");
    } catch (err) {
      console.error("Expenses export failed:", err);
      showToast("Export Failed", "Could not export expenses.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // CSV Generator: Income
  const getIncomeCSV = (income: any[], accounts: any[]) => {
    const headers = ["Income Stream / Source", "Amount (INR)", "Category", "Frequency", "Received Date", "Deposited Into Account", "Notes", "Voucher ID"];
    const rows = income.map((item) => {
      const acc = accounts.find((a) => a.id === item.account_id);
      return [
        escapeCSV(item.title),
        Number(item.amount).toFixed(2),
        escapeCSV(item.category),
        escapeCSV(item.frequency),
        item.received_date,
        escapeCSV(acc ? acc.name : "Unlinked"),
        escapeCSV(item.notes || ""),
        escapeCSV(item.id),
      ];
    });
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  };

  // 3. Export Income CSV
  const handleExportIncomeCSV = async () => {
    try {
      setExportingTarget("income");
      const { income, accounts } = await fetchAllData();
      if (income.length === 0) {
        showToast("No Data", "There are no income records to export.", "info");
        return;
      }

      const csvData = getIncomeCSV(income, accounts);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerFileDownload(csvData, `arthaX_income_${dateStr}.csv`);
      showToast("Export Ready", `${income.length} income records exported to CSV.`, "success");
    } catch (err) {
      console.error("Income export failed:", err);
      showToast("Export Failed", "Could not export income.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // CSV Generator: Consolidated Financial Ledger
  const getLedgerCSV = (income: any[], expenses: any[], accounts: any[]) => {
    const headers = [
      "Voucher ID",
      "Date",
      "Type",
      "Title",
      "Category",
      "Account Name",
      "Account Type",
      "Debit (INR)",
      "Credit (INR)",
      "Notes",
      "Created At",
    ];

    interface UnifiedTx {
      id: string;
      date: string;
      type: "DEBIT" | "CREDIT";
      title: string;
      category: string;
      account_id: string | null;
      amount: number;
      notes: string | null;
      created_at: string;
    }

    const entries: UnifiedTx[] = [
      ...expenses.map((e) => ({
        id: e.id,
        date: e.expense_date,
        type: "DEBIT" as const,
        title: e.title,
        category: e.category,
        account_id: e.account_id,
        amount: Number(e.amount) || 0,
        notes: e.notes,
        created_at: e.created_at,
      })),
      ...income.map((i) => ({
        id: i.id,
        date: i.received_date,
        type: "CREDIT" as const,
        title: i.title,
        category: i.category,
        account_id: i.account_id,
        amount: Number(i.amount) || 0,
        notes: i.notes,
        created_at: i.created_at,
      })),
    ];

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const rows = entries.map((item) => {
      const acc = accounts.find((a) => a.id === item.account_id);
      const debitVal = item.type === "DEBIT" ? item.amount.toFixed(2) : "";
      const creditVal = item.type === "CREDIT" ? item.amount.toFixed(2) : "";

      return [
        escapeCSV(item.id),
        item.date,
        item.type,
        escapeCSV(item.title),
        escapeCSV(item.category),
        escapeCSV(acc ? acc.name : "Unlinked"),
        escapeCSV(acc ? acc.type : "—"),
        debitVal,
        creditVal,
        escapeCSV(item.notes || ""),
        item.created_at,
      ];
    });

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  };

  // 4. Export Consolidated Financial Ledger CSV
  const handleExportLedgerCSV = async () => {
    try {
      setExportingTarget("ledger");
      const { income, expenses, accounts } = await fetchAllData();
      const totalTx = income.length + expenses.length;

      if (totalTx === 0) {
        showToast("No Data", "There are no transactions in ledger to export.", "info");
        return;
      }

      const csvData = getLedgerCSV(income, expenses, accounts);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerFileDownload(csvData, `arthaX_Consolidated_Ledger_${dateStr}.csv`);
      showToast("Export Ready", `${totalTx} transactions exported to CSV.`, "success");
    } catch (err) {
      console.error("Ledger export failed:", err);
      showToast("Export Failed", "Could not export ledger statement.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // CSV Generator: Budgets
  const getBudgetsCSV = (budgets: any[]) => {
    const headers = ["Category", "Month / Year", "Budget Limit (INR)", "Period", "Alert Threshold (%)", "Notes", "Budget ID"];
    const rows = budgets.map((b) => [
      escapeCSV(b.category),
      escapeCSV(b.month_year),
      Number(b.amount).toFixed(2),
      escapeCSV(b.period || "monthly"),
      (b.alert_threshold ?? 80).toString(),
      escapeCSV(b.notes || ""),
      escapeCSV(b.id),
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  };

  // 5. Export Budgets CSV
  const handleExportBudgetsCSV = async () => {
    try {
      setExportingTarget("budgets");
      const { budgets } = await fetchAllData();
      if (budgets.length === 0) {
        showToast("No Data", "There are no budget targets to export.", "info");
        return;
      }

      const csvData = getBudgetsCSV(budgets);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerFileDownload(csvData, `arthaX_budgets_${dateStr}.csv`);
      showToast("Export Ready", `${budgets.length} budget limits exported to CSV.`, "success");
    } catch (err) {
      console.error("Budgets export failed:", err);
      showToast("Export Failed", "Could not export budgets.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // CSV Generator: Accounts
  const getAccountsCSV = (accounts: any[]) => {
    const headers = ["Account Name", "Account Type", "Current Balance (INR)", "Last 4 Digits / Ref", "Created At", "Account ID"];
    const rows = accounts.map((a) => [
      escapeCSV(a.name),
      escapeCSV(a.type),
      Number(a.balance).toFixed(2),
      escapeCSV(a.last_four || ""),
      a.created_at,
      escapeCSV(a.id),
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  };

  // 6. Export Accounts CSV
  const handleExportAccountsCSV = async () => {
    try {
      setExportingTarget("accounts");
      const { accounts } = await fetchAllData();
      if (accounts.length === 0) {
        showToast("No Data", "There are no accounts to export.", "info");
        return;
      }

      const csvData = getAccountsCSV(accounts);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerFileDownload(csvData, `arthaX_accounts_${dateStr}.csv`);
      showToast("Export Ready", `${accounts.length} accounts exported to CSV.`, "success");
    } catch (err) {
      console.error("Accounts export failed:", err);
      showToast("Export Failed", "Could not export accounts.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // 7. Bulk Export: Download All Datasets as CSVs
  const handleExportAllCSVs = async () => {
    try {
      setExportingTarget("all_csv");
      const { accounts, income, expenses, budgets } = await fetchAllData();
      const dateStr = new Date().toISOString().split("T")[0];

      let exportedCount = 0;

      if (income.length > 0 || expenses.length > 0) {
        triggerFileDownload(getLedgerCSV(income, expenses, accounts), `arthaX_Consolidated_Ledger_${dateStr}.csv`);
        exportedCount++;
      }

      if (expenses.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getExpensesCSV(expenses, accounts), `arthaX_expenses_${dateStr}.csv`);
        }, 300);
        exportedCount++;
      }

      if (income.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getIncomeCSV(income, accounts), `arthaX_income_${dateStr}.csv`);
        }, 600);
        exportedCount++;
      }

      if (budgets.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getBudgetsCSV(budgets), `arthaX_budgets_${dateStr}.csv`);
        }, 900);
        exportedCount++;
      }

      if (accounts.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getAccountsCSV(accounts), `arthaX_accounts_${dateStr}.csv`);
        }, 1200);
        exportedCount++;
      }

      if (exportedCount === 0) {
        showToast("No Data", "No records found in database to export.", "info");
      } else {
        showToast("Bulk Export Complete", `${exportedCount} CSV files downloaded.`, "success");
      }
    } catch (err) {
      console.error("Bulk CSV export failed:", err);
      showToast("Export Failed", "Could not complete bulk CSV export.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // 8. PDF Exports
  const handleExportLedgerPDF = async () => {
    try {
      setExportingTarget("ledger_pdf");
      const { income, expenses, accounts } = await fetchAllData();
      if (income.length === 0 && expenses.length === 0) {
        showToast("No Data", "There are no transactions to export.", "info");
        return;
      }
      await exportLedgerPDF(income, expenses, accounts);
      showToast("PDF Generated", "Consolidated Ledger Statement downloaded.", "success");
    } catch (err) {
      console.error("Ledger PDF export failed:", err);
      showToast("Export Failed", "Could not generate Ledger PDF.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  const handleExportExpensesPDF = async () => {
    try {
      setExportingTarget("expenses_pdf");
      const { expenses, accounts } = await fetchAllData();
      if (expenses.length === 0) {
        showToast("No Data", "There are no expenses to export.", "info");
        return;
      }
      await exportExpensesPDF(expenses, accounts);
      showToast("PDF Generated", "Expenses Statement downloaded.", "success");
    } catch (err) {
      console.error("Expenses PDF export failed:", err);
      showToast("Export Failed", "Could not generate Expenses PDF.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  const handleExportIncomePDF = async () => {
    try {
      setExportingTarget("income_pdf");
      const { income, accounts } = await fetchAllData();
      if (income.length === 0) {
        showToast("No Data", "There are no income records to export.", "info");
        return;
      }
      await exportIncomePDF(income, accounts);
      showToast("PDF Generated", "Income Streams Statement downloaded.", "success");
    } catch (err) {
      console.error("Income PDF export failed:", err);
      showToast("Export Failed", "Could not generate Income PDF.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  const handleExportBudgetsPDF = async () => {
    try {
      setExportingTarget("budgets_pdf");
      const { budgets, expenses } = await fetchAllData();
      if (budgets.length === 0) {
        showToast("No Data", "There are no budgets configured to export.", "info");
        return;
      }
      await exportBudgetsPDF(budgets, expenses);
      showToast("PDF Generated", "Category Budgets Statement downloaded.", "success");
    } catch (err) {
      console.error("Budgets PDF export failed:", err);
      showToast("Export Failed", "Could not generate Budgets PDF.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  const handleExportAccountsPDF = async () => {
    try {
      setExportingTarget("accounts_pdf");
      const { accounts } = await fetchAllData();
      if (accounts.length === 0) {
        showToast("No Data", "There are no accounts to export.", "info");
        return;
      }
      await exportAccountsPDF(accounts);
      showToast("PDF Generated", "Bank & Liquid Accounts Statement downloaded.", "success");
    } catch (err) {
      console.error("Accounts PDF export failed:", err);
      showToast("Export Failed", "Could not generate Accounts PDF.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  const handleExportMasterPDF = async () => {
    try {
      setExportingTarget("master_pdf");
      const { accounts, income, expenses, budgets } = await fetchAllData();
      const total = accounts.length + income.length + expenses.length + budgets.length;
      if (total === 0) {
        showToast("No Data", "No records found in database to export.", "info");
        return;
      }
      await exportMasterPortfolioPDF(accounts, income, expenses, budgets);
      showToast("PDF Generated", "Comprehensive Portfolio Statement downloaded.", "success");
    } catch (err) {
      console.error("Master PDF export failed:", err);
      showToast("Export Failed", "Could not generate Master Portfolio PDF.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  const handleDropdownExportPDF = () => {
    switch (selectedDataset) {
      case "ledger":
        return handleExportLedgerPDF();
      case "expenses":
        return handleExportExpensesPDF();
      case "income":
        return handleExportIncomePDF();
      case "budgets":
        return handleExportBudgetsPDF();
      case "accounts":
        return handleExportAccountsPDF();
      case "master":
        return handleExportMasterPDF();
      default:
        return handleExportLedgerPDF();
    }
  };

  const handleDropdownExportCSV = () => {
    switch (selectedDataset) {
      case "ledger":
        return handleExportLedgerCSV();
      case "expenses":
        return handleExportExpensesCSV();
      case "income":
        return handleExportIncomeCSV();
      case "budgets":
        return handleExportBudgetsCSV();
      case "accounts":
        return handleExportAccountsCSV();
      case "master":
        return handleExportAllCSVs();
      default:
        return handleExportLedgerCSV();
    }
  };

  return (
    <main
      className="flex-1 h-full px-4 sm:px-8 py-6 sm:py-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-16">
        {/* Settings Header */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b"
          style={{ borderColor: "var(--app-border-subtle)" }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Settings</h1>
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                }}
              >
                Preferences & Vault
              </span>
            </div>
            <p className="text-xs opacity-70 mt-1">
              Personalize your workspace, generate statements & reports, and manage account security.
            </p>
          </div>

          {/* Quick Sync Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePurgeCacheAndSync}
              disabled={cacheSyncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-sm hover:opacity-100 opacity-80 active:scale-95 disabled:opacity-40"
              style={{
                borderColor: "var(--app-border)",
                backgroundColor: "var(--app-card)",
                color: "var(--app-fg)",
              }}
              title="Synchronize all account balances and transaction data"
            >
              <RotateCcw size={13} className={cacheSyncing ? "animate-spin text-emerald-400" : ""} />
              <span>{cacheSyncing ? "Syncing..." : "Sync Workspace"}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 1. PROFILE & GREETING NAME (PRIMARY USER SETTING)              */}
        {/* ============================================================== */}
        <div
          className="rounded-2xl border p-6 sm:p-7 space-y-6 shadow-sm transition-all"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <User size={15} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">Profile & Greeting</h2>
                <p className="text-[11px] opacity-60">Personal identity and workspace header</p>
              </div>
            </div>

            {isGoogleUser && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-semibold rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400">
                Google Account
              </span>
            )}
          </div>

          {/* Visual Profile Identity Badge */}
          <div
            className="p-4 rounded-xl border flex items-center gap-4"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-bg)",
            }}
          >
            {googleAvatarUrl ? (
              <img
                src={googleAvatarUrl}
                alt={greetingName || "User"}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-emerald-500/20 flex-shrink-0"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl border flex items-center justify-center font-extrabold text-lg flex-shrink-0"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                  color: "#4bb473",
                }}
              >
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight truncate">
                  {greetingName.trim() || profile?.name || "User"}
                </span>
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
              </div>
              <p className="text-xs font-mono opacity-60 truncate">
                {user?.email || "Personal Workspace"}
              </p>
            </div>
          </div>

          {/* Display Name Input Form */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider block opacity-75">
              Display Name
            </label>
            <p className="text-xs opacity-60">
              Sets the personal name greeting on your dashboard and generates your official reports signature.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={greetingName}
                  onChange={handleNameInputChange}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameBlur}
                  placeholder="Enter display name (e.g. Saran)"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border focus:outline-none transition-colors font-medium shadow-inner"
                  style={{
                    backgroundColor: "var(--app-bg)",
                    color: "var(--app-fg)",
                    borderColor: "var(--app-border)",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => handleSaveName()}
                disabled={saveStatus === "saving" || !greetingName.trim()}
                className="px-5 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 min-w-[110px]"
                style={{
                  backgroundColor: "var(--app-fg)",
                  color: "var(--app-bg)",
                }}
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <Check size={13} className="text-emerald-500" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save Name</span>
                )}
              </button>
            </div>

            {/* Live Greeting Preview */}
            <div
              className="mt-3 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-bg)",
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                <span className="opacity-60 text-[10px] font-mono uppercase tracking-wider">Dashboard Greeting:</span>
                <span className="font-semibold truncate text-xs text-emerald-400">
                  {timeGreeting}{greetingName.trim() ? `, ${greetingName.trim()}` : ""}
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-50 hidden sm:inline">Active</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. STATEMENTS & DATA REPORTS HUB (PDF / CSV / BACKUP)          */}
        {/* ============================================================== */}
        <div
          className="rounded-2xl border p-6 sm:p-7 space-y-6 shadow-sm transition-all"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          {/* Card Header & Bulk Actions */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold tracking-tight">Statements & Data Reports</h2>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                    style={{
                      borderColor: "var(--app-border-subtle)",
                      backgroundColor: "var(--app-bg)",
                    }}
                  >
                    {loadingCounts ? "Loading..." : `${counts.total} items recorded`}
                  </span>
                </div>
                <p className="text-xs opacity-60 mt-0.5">
                  Generate formal PDF financial statements or export raw datasets as CSV spreadsheets.
                </p>
              </div>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportMasterPDF}
                disabled={exportingTarget !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40"
                title="Download complete portfolio financial report in PDF"
              >
                {exportingTarget === "master_pdf" ? (
                  <Loader2 size={12} className="animate-spin text-rose-400" />
                ) : (
                  <FileText size={12} className="text-rose-400" />
                )}
                <span>Master PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllJSON}
                disabled={exportingTarget !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-40"
                style={{
                  backgroundColor: "var(--app-fg)",
                  color: "var(--app-bg)",
                }}
                title="Download full portfolio backup in JSON format"
              >
                {exportingTarget === "all_json" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                <span>Backup JSON</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllCSVs}
                disabled={exportingTarget !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer hover:opacity-100 opacity-80 active:scale-95 disabled:opacity-40"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor: "var(--app-bg)",
                  color: "var(--app-fg)",
                }}
                title="Download all datasets as individual CSV spreadsheets"
              >
                {exportingTarget === "all_csv" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FolderDown size={12} />
                )}
                <span>All CSVs</span>
              </button>
            </div>
          </div>

          {/* Clean Financial Metrics Summary Bar */}
          <div
            className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl border text-xs"
            style={{
              backgroundColor: "var(--app-bg)",
              borderColor: "var(--app-border-subtle)",
            }}
          >
            <div className="flex items-center gap-2 p-1.5">
              <Landmark size={14} className="opacity-60 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider opacity-60">Accounts</div>
                <div className="font-bold font-mono text-xs">{loadingCounts ? "..." : counts.accounts}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5">
              <TrendingUp size={14} className="text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 opacity-80">Income</div>
                <div className="font-bold font-mono text-xs text-emerald-400">{loadingCounts ? "..." : counts.income}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5">
              <TrendingDown size={14} className="text-rose-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-rose-400 opacity-80">Expenses</div>
                <div className="font-bold font-mono text-xs text-rose-400">{loadingCounts ? "..." : counts.expenses}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5">
              <Target size={14} className="text-amber-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 opacity-80">Budgets</div>
                <div className="font-bold font-mono text-xs text-amber-400">{loadingCounts ? "..." : counts.budgets}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5 col-span-2 sm:col-span-1">
              <Receipt size={14} className="text-sky-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 opacity-80">Ledger</div>
                <div className="font-bold font-mono text-xs text-sky-400">{loadingCounts ? "..." : counts.ledger}</div>
              </div>
            </div>
          </div>

          {/* Primary Statement Selector with Dual PDF / CSV Buttons */}
          <div
            className="p-4 sm:p-5 rounded-xl border space-y-3.5 shadow-sm"
            style={{
              backgroundColor: "var(--app-bg)",
              borderColor: "var(--app-border-subtle)",
            }}
          >
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider opacity-60">
              <span>Select Statement or Financial Scope</span>
              <span className="text-[10px] hidden sm:inline">Dual Format: PDF / CSV</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  className="w-full text-xs font-medium rounded-xl pl-3.5 pr-8 py-2.5 border appearance-none cursor-pointer focus:outline-none transition-colors shadow-inner"
                  style={{
                    backgroundColor: "var(--app-card)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                >
                  <option value="ledger">Consolidated Ledger Statement ({counts.ledger} entries)</option>
                  <option value="expenses">Expenses & Outflows Statement ({counts.expenses} entries)</option>
                  <option value="income">Income Streams Statement ({counts.income} entries)</option>
                  <option value="budgets">Category Budgets Matrix ({counts.budgets} entries)</option>
                  <option value="accounts">Bank & Liquid Accounts Inventory ({counts.accounts} entries)</option>
                  <option value="master">Comprehensive Portfolio Statement (Complete Audit)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleDropdownExportPDF}
                  disabled={exportingTarget !== null}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 min-w-[110px]"
                  title="Download formatted printable PDF statement"
                >
                  {exportingTarget?.includes("pdf") ? (
                    <Loader2 size={13} className="animate-spin text-rose-400" />
                  ) : (
                    <FileText size={13} className="text-rose-400" />
                  )}
                  <span>Export PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleDropdownExportCSV}
                  disabled={exportingTarget !== null}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 min-w-[110px]"
                  title="Download spreadsheet CSV file"
                >
                  {exportingTarget?.includes("csv") || exportingTarget === "all_csv" ? (
                    <Loader2 size={13} className="animate-spin text-emerald-400" />
                  ) : (
                    <FileSpreadsheet size={13} className="text-emerald-400" />
                  )}
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Detailed Breakdown */}
          <div className="pt-1 space-y-2">
            <button
              type="button"
              onClick={() => setShowAllDatasets(!showAllDatasets)}
              className="flex items-center justify-between w-full py-2 px-1 text-xs font-semibold opacity-75 hover:opacity-100 transition-opacity cursor-pointer select-none"
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                <span>Individual Dataset Breakdown</span>
                <span className="text-[10px] font-mono opacity-50 px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--app-border-subtle)" }}>
                  {counts.total} items
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs opacity-60">
                <span>{showAllDatasets ? "Hide" : "Show Breakdown"}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${showAllDatasets ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {showAllDatasets && (
              <div
                className="divide-y rounded-xl border overflow-hidden shadow-sm"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                {/* 1. Master Consolidated Ledger */}
                <div className="flex items-center justify-between px-4 py-3 text-xs hover:bg-[var(--app-card-hover)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Receipt size={14} className="opacity-70 flex-shrink-0" />
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold truncate">Consolidated Ledger</span>
                      <span className="text-[10px] opacity-40 hidden sm:inline">• Debits & Credits Statement</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono opacity-60 mr-1">
                      {counts.ledger} rows
                    </span>
                    <button
                      type="button"
                      onClick={handleExportLedgerPDF}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                      }}
                      title="Download Consolidated Ledger PDF statement"
                    >
                      {exportingTarget === "ledger_pdf" ? (
                        <Loader2 size={11} className="animate-spin text-rose-400" />
                      ) : (
                        <FileText size={11} className="text-rose-400" />
                      )}
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportLedgerCSV}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                        color: "var(--app-fg)",
                      }}
                      title="Export complete ledger statement to CSV"
                    >
                      {exportingTarget === "ledger" ? (
                        <Loader2 size={11} className="animate-spin text-emerald-400" />
                      ) : (
                        <Download size={11} />
                      )}
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* 2. Expenses Records */}
                <div className="flex items-center justify-between px-4 py-3 text-xs hover:bg-[var(--app-card-hover)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <TrendingDown size={14} className="text-rose-400 flex-shrink-0" />
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold truncate">Expenses</span>
                      <span className="text-[10px] opacity-40 hidden sm:inline">• Bills & Outflows</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono opacity-60 mr-1">
                      {counts.expenses} rows
                    </span>
                    <button
                      type="button"
                      onClick={handleExportExpensesPDF}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                      }}
                      title="Download Expenses PDF statement"
                    >
                      {exportingTarget === "expenses_pdf" ? (
                        <Loader2 size={11} className="animate-spin text-rose-400" />
                      ) : (
                        <FileText size={11} className="text-rose-400" />
                      )}
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportExpensesCSV}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                        color: "var(--app-fg)",
                      }}
                      title="Export expenses to CSV"
                    >
                      {exportingTarget === "expenses" ? (
                        <Loader2 size={11} className="animate-spin text-emerald-400" />
                      ) : (
                        <Download size={11} />
                      )}
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* 3. Income Records */}
                <div className="flex items-center justify-between px-4 py-3 text-xs hover:bg-[var(--app-card-hover)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <TrendingUp size={14} className="text-emerald-400 flex-shrink-0" />
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold truncate">Income Streams</span>
                      <span className="text-[10px] opacity-40 hidden sm:inline">• Salaries & Dividends</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono opacity-60 mr-1">
                      {counts.income} rows
                    </span>
                    <button
                      type="button"
                      onClick={handleExportIncomePDF}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                      }}
                      title="Download Income Streams PDF statement"
                    >
                      {exportingTarget === "income_pdf" ? (
                        <Loader2 size={11} className="animate-spin text-rose-400" />
                      ) : (
                        <FileText size={11} className="text-rose-400" />
                      )}
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportIncomeCSV}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                        color: "var(--app-fg)",
                      }}
                      title="Export income streams to CSV"
                    >
                      {exportingTarget === "income" ? (
                        <Loader2 size={11} className="animate-spin text-emerald-400" />
                      ) : (
                        <Download size={11} />
                      )}
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* 4. Budgets Matrix */}
                <div className="flex items-center justify-between px-4 py-3 text-xs hover:bg-[var(--app-card-hover)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Target size={14} className="text-amber-400 flex-shrink-0" />
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold truncate">Category Budgets</span>
                      <span className="text-[10px] opacity-40 hidden sm:inline">• Monthly Limits</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono opacity-60 mr-1">
                      {counts.budgets} rows
                    </span>
                    <button
                      type="button"
                      onClick={handleExportBudgetsPDF}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                      }}
                      title="Download Category Budgets PDF statement"
                    >
                      {exportingTarget === "budgets_pdf" ? (
                        <Loader2 size={11} className="animate-spin text-rose-400" />
                      ) : (
                        <FileText size={11} className="text-rose-400" />
                      )}
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportBudgetsCSV}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                        color: "var(--app-fg)",
                      }}
                      title="Export budgets matrix to CSV"
                    >
                      {exportingTarget === "budgets" ? (
                        <Loader2 size={11} className="animate-spin text-emerald-400" />
                      ) : (
                        <Download size={11} />
                      )}
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* 5. Accounts Inventory */}
                <div className="flex items-center justify-between px-4 py-3 text-xs hover:bg-[var(--app-card-hover)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Landmark size={14} className="opacity-70 flex-shrink-0" />
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold truncate">Bank & Liquid Accounts</span>
                      <span className="text-[10px] opacity-40 hidden sm:inline">• Balances & Cards</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-mono opacity-60 mr-1">
                      {counts.accounts} rows
                    </span>
                    <button
                      type="button"
                      onClick={handleExportAccountsPDF}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                      }}
                      title="Download Accounts PDF statement"
                    >
                      {exportingTarget === "accounts_pdf" ? (
                        <Loader2 size={11} className="animate-spin text-rose-400" />
                      ) : (
                        <FileText size={11} className="text-rose-400" />
                      )}
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportAccountsCSV}
                      disabled={exportingTarget !== null}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 cursor-pointer disabled:opacity-40"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card)",
                        color: "var(--app-fg)",
                      }}
                      title="Export bank accounts to CSV"
                    >
                      {exportingTarget === "accounts" ? (
                        <Loader2 size={11} className="animate-spin text-emerald-400" />
                      ) : (
                        <Download size={11} />
                      )}
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. SECURITY & SESSION (ACCOUNT IDENTITY & VAULT)               */}
        {/* ============================================================== */}
        <div
          className="rounded-2xl border p-6 sm:p-7 space-y-6 shadow-sm transition-all"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div
            className="flex items-center justify-between pb-4 border-b"
            style={{ borderColor: "var(--app-border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">Security & Vault Session</h2>
                <p className="text-xs opacity-60 mt-0.5">
                  Multi-tenant encrypted financial data protected with client-side isolation.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full border text-emerald-400 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Protected & Active
            </span>
          </div>

          <div
            className="p-4 rounded-xl border space-y-3 text-xs"
            style={{
              backgroundColor: "var(--app-bg)",
              borderColor: "var(--app-border-subtle)",
            }}
          >
            <div
              className="flex items-center justify-between py-1.5 border-b"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <span className="opacity-60 text-xs">Primary Email</span>
              <div className="flex items-center gap-1.5 font-medium">
                <span>{user?.email || "Guest Session (Local Mode)"}</span>
                {user?.email && <CheckCircle2 size={13} className="text-emerald-400" />}
              </div>
            </div>

            <div
              className="flex items-center justify-between py-1.5 border-b"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <span className="opacity-60 text-xs">Data Encryption</span>
              <span className="font-mono text-[11px] opacity-80">Client-Side Vault Isolation • Multi-Tenant</span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="opacity-60 text-xs">Session Status</span>
              <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Active Secure Session
              </span>
            </div>
          </div>

          {/* Action Row: Refresh & Sign Out */}
          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <button
              type="button"
              onClick={handlePurgeCacheAndSync}
              disabled={cacheSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border hover:bg-[var(--app-bg)] transition-all cursor-pointer opacity-80 hover:opacity-100 disabled:opacity-40 shadow-sm"
              style={{
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
              }}
              title="Refresh all account balances and transaction data"
            >
              <RotateCcw size={13} className={cacheSyncing ? "animate-spin text-amber-400" : ""} />
              <span>{cacheSyncing ? "Refreshing Data..." : "Synchronize Workspace"}</span>
            </button>

            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Securely sign out of your arthaX account"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
