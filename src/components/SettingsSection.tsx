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
  User,
  ShieldCheck,
  RotateCcw,
  LogOut,
  Palette,
  Sun,
  Moon,
  Zap,
  Copy,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
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

type SettingsTab = "profile" | "appearance" | "statements" | "security";

export default function SettingsSection() {
  const { user, profile, refreshProfile, signOut, updateProfileLocally } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [greetingName, setGreetingName] = useState(profile?.name || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [cacheSyncing, setCacheSyncing] = useState(false);
  const [copiedVaultId, setCopiedVaultId] = useState(false);

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

  // Sync greetingName when profile arrives from AuthContext
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

      const accCount = accRes.count || 0;
      const incCount = incRes.count || 0;
      const expCount = expRes.count || 0;
      const budCount = budRes.count || 0;
      const totalCount = accCount + incCount + expCount + budCount;

      setCounts({
        accounts: accCount,
        income: incCount,
        expenses: expCount,
        budgets: budCount,
        ledger: incCount + expCount,
        total: totalCount,
      });
    } catch (err) {
      console.warn("Failed to fetch settings telemetry counts:", err);
    } finally {
      setLoadingCounts(false);
    }
  }, [user]);

  useEffect(() => {
    refreshCounts();

    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-settings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_settings", filter: `id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.name && !isDirtyRef.current && payload.new.name !== nameInputRef.current) {
            setGreetingName(payload.new.name);
            updateProfileLocally?.({ name: payload.new.name });
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${userId}` }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "income", filter: `user_id=eq.${userId}` }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${userId}` }, () => refreshCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "budgets", filter: `user_id=eq.${userId}` }, () => refreshCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, user, refreshCounts, updateProfileLocally]);

  // Save Greeting Name
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
      const { error } = await supabase.from("user_settings").upsert({
        id: user.id,
        name: nameToSave,
        theme: theme || "ultra",
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        setSaveStatus("saved");
        isDirtyRef.current = false;

        if (updateProfileLocally) {
          updateProfileLocally({ name: nameToSave });
        }

        const portfolioKey = getUserCacheKey(user.id, CACHE_KEYS.PORTFOLIO);
        const cachedPortfolio = getFromLocalCache<any>(portfolioKey);
        if (cachedPortfolio) {
          saveToLocalCache(portfolioKey, { ...cachedPortfolio, name: nameToSave });
        }

        showToast("Profile Updated", `Workspace greeting name set to "${nameToSave}".`, "success");
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

  const handleThemeChange = async (newTheme: ThemeMode) => {
    if (newTheme === theme) return;
    try {
      await setTheme(newTheme);
      showToast(
        "Theme Updated",
        `Switched to ${newTheme === "ultra" ? "Ultra Dark (Obsidian)" : newTheme === "dark" ? "Midnight Dark" : "Studio Light"}.`,
        "success"
      );
    } catch {
      showToast("Theme Error", "Failed to switch theme.", "error");
    }
  };

  const handleCopyVaultId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedVaultId(true);
      showToast("Copied", "Vault ID copied to clipboard.", "success");
      setTimeout(() => setCopiedVaultId(false), 2000);
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

      showToast("Refreshed", "All account balances and datasets synchronized.", "success");
    } catch (err) {
      console.error("Refresh failed:", err);
      showToast("Error", "Could not refresh data.", "error");
    } finally {
      setCacheSyncing(false);
    }
  };

  // Helper to fetch full records for exports
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

  // 1. Export All JSON Backup
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

      showToast("Backup Ready", `Complete JSON backup (${totalItems} items) downloaded.`, "success");
      refreshCounts();
    } catch (err) {
      console.error("JSON Export failed:", err);
      showToast("Export Failed", "Could not export database backup.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // CSV Generators
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

  const getIncomeCSV = (income: any[], accounts: any[]) => {
    const headers = ["Income Stream", "Amount (INR)", "Category", "Frequency", "Received Date", "Deposited Into Account", "Notes", "Voucher ID"];
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

  const getLedgerCSV = (income: any[], expenses: any[], accounts: any[]) => {
    const headers = ["Voucher ID", "Date", "Type", "Title", "Category", "Account Name", "Account Type", "Debit (INR)", "Credit (INR)", "Notes", "Created At"];
    const entries: any[] = [
      ...expenses.map((e) => ({
        id: e.id,
        date: e.expense_date,
        type: "DEBIT",
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
        type: "CREDIT",
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

  // CSV Individual Handlers
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
    } catch {
      showToast("Export Failed", "Could not export expenses.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

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
    } catch {
      showToast("Export Failed", "Could not export income.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

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
    } catch {
      showToast("Export Failed", "Could not export ledger statement.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

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
    } catch {
      showToast("Export Failed", "Could not export budgets.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

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
    } catch {
      showToast("Export Failed", "Could not export accounts.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // Bulk CSV Export
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
        setTimeout(() => triggerFileDownload(getExpensesCSV(expenses, accounts), `arthaX_expenses_${dateStr}.csv`), 300);
        exportedCount++;
      }
      if (income.length > 0) {
        setTimeout(() => triggerFileDownload(getIncomeCSV(income, accounts), `arthaX_income_${dateStr}.csv`), 600);
        exportedCount++;
      }
      if (budgets.length > 0) {
        setTimeout(() => triggerFileDownload(getBudgetsCSV(budgets), `arthaX_budgets_${dateStr}.csv`), 900);
        exportedCount++;
      }
      if (accounts.length > 0) {
        setTimeout(() => triggerFileDownload(getAccountsCSV(accounts), `arthaX_accounts_${dateStr}.csv`), 1200);
        exportedCount++;
      }

      if (exportedCount === 0) {
        showToast("No Data", "No records found in database to export.", "info");
      } else {
        showToast("Bulk Export Complete", `${exportedCount} CSV files downloaded.`, "success");
      }
    } catch {
      showToast("Export Failed", "Could not complete bulk CSV export.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // PDF Handlers
  const handleExportLedgerPDF = async () => {
    try {
      setExportingTarget("ledger_pdf");
      const { income, expenses, accounts } = await fetchAllData();
      if (income.length === 0 && expenses.length === 0) {
        showToast("No Data", "There are no transactions to export.", "info");
        return;
      }
      await exportLedgerPDF(income, expenses, accounts);
      showToast("PDF Ready", "Consolidated Ledger Statement downloaded.", "success");
    } catch {
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
      showToast("PDF Ready", "Expenses Statement downloaded.", "success");
    } catch {
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
      showToast("PDF Ready", "Income Streams Statement downloaded.", "success");
    } catch {
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
      showToast("PDF Ready", "Category Budgets Statement downloaded.", "success");
    } catch {
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
      showToast("PDF Ready", "Bank & Liquid Accounts Statement downloaded.", "success");
    } catch {
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
      showToast("PDF Ready", "Comprehensive Portfolio Statement downloaded.", "success");
    } catch {
      showToast("Export Failed", "Could not generate Master Portfolio PDF.", "error");
    } finally {
      setExportingTarget(null);
    }
  };

  // Clean datasets matrix specification
  const DATASET_ROWS = [
    {
      id: "ledger",
      name: "Consolidated General Ledger",
      desc: "Complete double-entry statement of all credits and debits",
      count: counts.ledger,
      icon: Receipt,
      iconColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      pdfFn: handleExportLedgerPDF,
      csvFn: handleExportLedgerCSV,
      pdfTarget: "ledger_pdf",
      csvTarget: "ledger",
    },
    {
      id: "expenses",
      name: "Expenses & Outflows",
      desc: "Detailed record of category expenditures and paid accounts",
      count: counts.expenses,
      icon: TrendingDown,
      iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      pdfFn: handleExportExpensesPDF,
      csvFn: handleExportExpensesCSV,
      pdfTarget: "expenses_pdf",
      csvTarget: "expenses",
    },
    {
      id: "income",
      name: "Income Streams & Inflows",
      desc: "Salaries, consulting, dividends, and interest deposits",
      count: counts.income,
      icon: TrendingUp,
      iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      pdfFn: handleExportIncomePDF,
      csvFn: handleExportIncomeCSV,
      pdfTarget: "income_pdf",
      csvTarget: "income",
    },
    {
      id: "budgets",
      name: "Category Budgets Matrix",
      desc: "Configured monthly limits, pace alerts, and allocations",
      count: counts.budgets,
      icon: Target,
      iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      pdfFn: handleExportBudgetsPDF,
      csvFn: handleExportBudgetsCSV,
      pdfTarget: "budgets_pdf",
      csvTarget: "budgets",
    },
    {
      id: "accounts",
      name: "Bank Accounts & Liquid Vault",
      desc: "Connected holdings, physical cash, and running balances",
      count: counts.accounts,
      icon: Landmark,
      iconColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      pdfFn: handleExportAccountsPDF,
      csvFn: handleExportAccountsCSV,
      pdfTarget: "accounts_pdf",
      csvTarget: "accounts",
    },
  ];

  return (
    <main
      className="flex-1 h-full px-3.5 sm:px-6 md:px-8 py-5 sm:py-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-16">
        {/* ============================================================== */}
        {/* TOP HEADER                                                     */}
        {/* ============================================================== */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Settings</h1>
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                }}
              >
                Workspace & Vault
              </span>
            </div>
            <p className="text-xs opacity-70 mt-1">
              Personalize your workspace identity, customize theme aesthetics, export statements, and manage account security.
            </p>
          </div>

          {/* Quick Synchronize Workspace Button */}
          <button
            type="button"
            onClick={handlePurgeCacheAndSync}
            disabled={cacheSyncing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-sm hover:opacity-100 opacity-80 active:scale-95 disabled:opacity-40 self-start sm:self-auto"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-card)",
              color: "var(--app-fg)",
            }}
            title="Synchronize all account balances and cache"
          >
            <RotateCcw size={13} className={cacheSyncing ? "animate-spin text-emerald-400" : ""} />
            <span>{cacheSyncing ? "Syncing..." : "Sync Workspace"}</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* CLEAN SEGMENTED SUB-NAV TABS                                   */}
        {/* ============================================================== */}
        <div
          className="flex items-center gap-1.5 p-1.5 rounded-2xl border overflow-x-auto shadow-xs"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "profile"
                ? "shadow-sm text-emerald-400"
                : "opacity-60 hover:opacity-100 hover:text-[var(--app-fg)]"
            }`}
            style={{
              backgroundColor: activeTab === "profile" ? "var(--app-bg)" : "transparent",
            }}
          >
            <User size={14} className={activeTab === "profile" ? "text-emerald-400" : ""} />
            <span>Profile & Identity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "appearance"
                ? "shadow-sm text-emerald-400"
                : "opacity-60 hover:opacity-100 hover:text-[var(--app-fg)]"
            }`}
            style={{
              backgroundColor: activeTab === "appearance" ? "var(--app-bg)" : "transparent",
            }}
          >
            <Palette size={14} className={activeTab === "appearance" ? "text-emerald-400" : ""} />
            <span>Appearance & Theme</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("statements")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "statements"
                ? "shadow-sm text-emerald-400"
                : "opacity-60 hover:opacity-100 hover:text-[var(--app-fg)]"
            }`}
            style={{
              backgroundColor: activeTab === "statements" ? "var(--app-bg)" : "transparent",
            }}
          >
            <FileText size={14} className={activeTab === "statements" ? "text-emerald-400" : ""} />
            <span>Statements & Data</span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.2 rounded-full border opacity-75"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              {counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "security"
                ? "shadow-sm text-emerald-400"
                : "opacity-60 hover:opacity-100 hover:text-[var(--app-fg)]"
            }`}
            style={{
              backgroundColor: activeTab === "security" ? "var(--app-bg)" : "transparent",
            }}
          >
            <ShieldCheck size={14} className={activeTab === "security" ? "text-emerald-400" : ""} />
            <span>Vault Security</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: PROFILE & IDENTITY                                      */}
        {/* ============================================================== */}
        {activeTab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Identity Showcase Card */}
            <div
              className="rounded-2xl border p-6 sm:p-7 space-y-6 shadow-sm transition-all"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <User size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Profile & Greeting Identity</h2>
                    <p className="text-xs opacity-60">Personal name header and report signature</p>
                  </div>
                </div>

                {isGoogleUser && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-semibold rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400">
                    <CheckCircle2 size={12} />
                    Google Account
                  </span>
                )}
              </div>

              {/* Visual Identity Row */}
              <div
                className="p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <div className="flex items-center gap-4">
                  {googleAvatarUrl ? (
                    <img
                      src={googleAvatarUrl}
                      alt={greetingName || "User"}
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-emerald-500/30 flex-shrink-0 shadow-sm"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-2xl border flex items-center justify-center font-extrabold text-lg flex-shrink-0 bg-emerald-500/10 text-emerald-400"
                      style={{ borderColor: "var(--app-border)" }}
                    >
                      {initials}
                    </div>
                  )}

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm tracking-tight truncate">
                        {greetingName.trim() || profile?.name || "arthaX User"}
                      </span>
                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    </div>
                    <p className="text-xs font-mono opacity-60 truncate">
                      {user?.email || "Personal Workspace"}
                    </p>
                  </div>
                </div>

                {/* Vault ID with Copy Button */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[10px] font-mono opacity-50 uppercase tracking-wider">Vault ID:</span>
                  <button
                    type="button"
                    onClick={handleCopyVaultId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-lg border hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    style={{
                      borderColor: "var(--app-border)",
                      backgroundColor: "var(--app-card)",
                      color: "var(--app-fg)",
                    }}
                    title="Click to copy Vault ID"
                  >
                    <span>{user?.id ? `${user.id.substring(0, 8)}...` : "local_vault"}</span>
                    {copiedVaultId ? (
                      <Check size={11} className="text-emerald-400" />
                    ) : (
                      <Copy size={11} className="opacity-60" />
                    )}
                  </button>
                </div>
              </div>

              {/* Display Name Input Form */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block opacity-75">
                    Greeting Name
                  </label>
                  <p className="text-xs opacity-60 mt-0.5">
                    Controls your personalized dashboard greeting and report signatory name.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={greetingName}
                      onChange={handleNameInputChange}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleNameBlur}
                      placeholder="Enter display name (e.g. Saran)"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium"
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
                    className="px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 min-w-[120px]"
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

                {/* Live Greeting Preview Banner */}
                <div
                  className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                    <span className="opacity-60 text-[10px] font-mono uppercase tracking-wider">Dashboard Greeting Preview:</span>
                    <span className="font-semibold truncate text-xs text-emerald-400">
                      {timeGreeting}{greetingName.trim() ? `, ${greetingName.trim()}` : ""}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-50 hidden sm:inline">Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: APPEARANCE & THEME                                      */}
        {/* ============================================================== */}
        {activeTab === "appearance" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div
              className="rounded-2xl border p-6 sm:p-7 space-y-6 shadow-sm transition-all"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Palette size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Appearance & Theme Palette</h2>
                    <p className="text-xs opacity-60">
                      Choose your visual experience. Charts, cards, and reports adapt instantly.
                    </p>
                  </div>
                </div>

                {/* Segmented Switcher Control */}
                <div
                  className="flex items-center p-1 rounded-xl border self-start sm:self-auto"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-bg)",
                  }}
                  title="Switch theme"
                >
                  <button
                    type="button"
                    onClick={() => handleThemeChange("ultra")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      theme === "ultra"
                        ? "shadow-sm text-emerald-400 bg-[var(--app-card)] border border-[var(--app-border)] font-bold"
                        : "opacity-50 hover:opacity-100"
                    }`}
                    title="Ultra Dark (Obsidian)"
                  >
                    <Zap size={13} className={theme === "ultra" ? "text-emerald-400" : ""} />
                    <span className="text-[11px] font-mono">Ultra</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange("dark")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      theme === "dark"
                        ? "shadow-sm text-sky-400 bg-[var(--app-card)] border border-[var(--app-border)] font-bold"
                        : "opacity-50 hover:opacity-100"
                    }`}
                    title="Midnight Slate"
                  >
                    <Moon size={13} className={theme === "dark" ? "text-sky-400" : ""} />
                    <span className="text-[11px] font-mono">Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange("light")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      theme === "light"
                        ? "shadow-sm text-amber-500 bg-[var(--app-card)] border border-[var(--app-border)] font-bold"
                        : "opacity-50 hover:opacity-100"
                    }`}
                    title="Studio Light"
                  >
                    <Sun size={13} className={theme === "light" ? "text-amber-500" : ""} />
                    <span className="text-[11px] font-mono">Light</span>
                  </button>
                </div>
              </div>

              {/* Interactive Theme Cards with Miniature Mock UI Previews */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Ultra Dark Card */}
                <div
                  onClick={() => handleThemeChange("ultra")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 group ${
                    theme === "ultra"
                      ? "ring-2 ring-emerald-500/50 border-emerald-500/50 shadow-md"
                      : "hover:border-[var(--app-border)] opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: theme === "ultra" ? undefined : "var(--app-border-subtle)",
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                          <Zap size={14} />
                        </span>
                        <span className="font-bold text-xs tracking-tight">Obsidian Ultra</span>
                      </div>
                      {theme === "ultra" ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-zinc-700 group-hover:border-zinc-500" />
                      )}
                    </div>
                    <p className="text-[11px] opacity-60 leading-relaxed">
                      Deep space pitch canvas (#090a0f) with luminous emerald neon highlights.
                    </p>

                    {/* Miniature Mock Dashboard Preview */}
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10 space-y-1.5 pointer-events-none select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-white">arthaX</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                      <div className="p-1.5 rounded-lg bg-[#10131c] border border-white/5 flex items-center justify-between">
                        <span className="text-[8px] opacity-60 text-zinc-400">Total Net Worth</span>
                        <span className="text-[9px] font-mono font-bold text-emerald-400">₹1,48,920</span>
                      </div>
                    </div>
                  </div>

                  {/* Swatches */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--app-border-subtle)]">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#090a0f] border border-white/20" title="Canvas" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#10131c] border border-white/20" title="Card" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#10b981]" title="Emerald Accent" />
                    <span className="text-[10px] font-mono opacity-40 ml-auto">OLED Pitch</span>
                  </div>
                </div>

                {/* 2. Midnight Dark Card */}
                <div
                  onClick={() => handleThemeChange("dark")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 group ${
                    theme === "dark"
                      ? "ring-2 ring-sky-500/50 border-sky-500/50 shadow-md"
                      : "hover:border-[var(--app-border)] opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: theme === "dark" ? undefined : "var(--app-border-subtle)",
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                          <Moon size={14} />
                        </span>
                        <span className="font-bold text-xs tracking-tight">Midnight Slate</span>
                      </div>
                      {theme === "dark" ? (
                        <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-zinc-700 group-hover:border-zinc-500" />
                      )}
                    </div>
                    <p className="text-[11px] opacity-60 leading-relaxed">
                      Sophisticated titanium slate (#0e1219) with cool sky blue and emerald tones.
                    </p>

                    {/* Miniature Mock Dashboard Preview */}
                    <div className="p-2.5 rounded-xl bg-[#0e1219] border border-white/10 space-y-1.5 pointer-events-none select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-white">arthaX</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      </div>
                      <div className="p-1.5 rounded-lg bg-[#151a24] border border-white/5 flex items-center justify-between">
                        <span className="text-[8px] opacity-60 text-zinc-400">Total Net Worth</span>
                        <span className="text-[9px] font-mono font-bold text-sky-400">₹1,48,920</span>
                      </div>
                    </div>
                  </div>

                  {/* Swatches */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--app-border-subtle)]">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#0e1219] border border-white/20" title="Canvas" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#151a24] border border-white/20" title="Card" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#38bdf8]" title="Sky Accent" />
                    <span className="text-[10px] font-mono opacity-40 ml-auto">Slate</span>
                  </div>
                </div>

                {/* 3. Studio Light Card */}
                <div
                  onClick={() => handleThemeChange("light")}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 group ${
                    theme === "light"
                      ? "ring-2 ring-emerald-600/50 border-emerald-600/50 shadow-md"
                      : "hover:border-[var(--app-border)] opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: "var(--app-bg)",
                    borderColor: theme === "light" ? undefined : "var(--app-border-subtle)",
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                          <Sun size={14} />
                        </span>
                        <span className="font-bold text-xs tracking-tight">Studio Light</span>
                      </div>
                      {theme === "light" ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-zinc-400 group-hover:border-zinc-600" />
                      )}
                    </div>
                    <p className="text-[11px] opacity-60 leading-relaxed">
                      Clean snow white cards (#ffffff) on soft slate canvas (#f8fafc) with crisp contrast.
                    </p>

                    {/* Miniature Mock Dashboard Preview */}
                    <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-zinc-200 space-y-1.5 pointer-events-none select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-slate-900">arthaX</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <div className="p-1.5 rounded-lg bg-[#ffffff] border border-zinc-200 flex items-center justify-between shadow-2xs">
                        <span className="text-[8px] opacity-60 text-slate-600">Total Net Worth</span>
                        <span className="text-[9px] font-mono font-bold text-emerald-600">₹1,48,920</span>
                      </div>
                    </div>
                  </div>

                  {/* Swatches */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--app-border-subtle)]">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#f8fafc] border border-zinc-300" title="Canvas" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#ffffff] border border-zinc-300" title="Card" />
                    <span className="w-3.5 h-3.5 rounded-full bg-[#059669]" title="Emerald Accent" />
                    <span className="text-[10px] font-mono opacity-40 ml-auto">Clean Studio</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: STATEMENTS & DATA REPORTS                               */}
        {/* ============================================================== */}
        {activeTab === "statements" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Master Bulk Actions Bar */}
            <div
              className="rounded-2xl border p-6 sm:p-7 space-y-5 shadow-sm transition-all"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Statements & Data Reports</h2>
                    <p className="text-xs opacity-60">Generate formal PDF statements or download CSV datasets</p>
                  </div>
                </div>

                <span
                  className="text-[10px] font-mono px-2.5 py-1 rounded-full border self-start sm:self-auto"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  {loadingCounts ? "Loading..." : `${counts.total} items recorded`}
                </span>
              </div>

              {/* 1-Click Master Export Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handleExportMasterPDF}
                  disabled={exportingTarget !== null}
                  className="flex items-center justify-center gap-2 p-3 text-xs font-bold rounded-xl border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer shadow-sm active:scale-98 disabled:opacity-40"
                  title="Download complete portfolio financial report in PDF"
                >
                  {exportingTarget === "master_pdf" ? (
                    <Loader2 size={14} className="animate-spin text-rose-400" />
                  ) : (
                    <FileText size={14} />
                  )}
                  <span>Master Portfolio PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAllJSON}
                  disabled={exportingTarget !== null}
                  className="flex items-center justify-center gap-2 p-3 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm hover:opacity-90 active:scale-98 disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--app-fg)",
                    color: "var(--app-bg)",
                  }}
                  title="Download full portfolio backup in JSON format"
                >
                  {exportingTarget === "all_json" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>Backup All JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAllCSVs}
                  disabled={exportingTarget !== null}
                  className="flex items-center justify-center gap-2 p-3 text-xs font-bold rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all cursor-pointer shadow-sm active:scale-98 disabled:opacity-40"
                  title="Download all datasets as individual CSV spreadsheets"
                >
                  {exportingTarget === "all_csv" ? (
                    <Loader2 size={14} className="animate-spin text-emerald-400" />
                  ) : (
                    <FolderDown size={14} />
                  )}
                  <span>All CSV Spreadsheets</span>
                </button>
              </div>

              {/* Metrics Summary Strip */}
              <div
                className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl border text-xs"
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

              {/* Dedicated Dataset Export Matrix Table */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-mono uppercase tracking-wider opacity-60">
                  Individual Dataset Statements
                </div>

                <div
                  className="divide-y rounded-2xl border overflow-hidden shadow-xs"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                  }}
                >
                  {DATASET_ROWS.map((ds) => {
                    const Icon = ds.icon;
                    return (
                      <div
                        key={ds.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-4 sm:py-3.5 gap-3 hover:bg-[var(--app-card-hover)] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${ds.iconColor}`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs tracking-tight truncate">{ds.name}</span>
                              <span className="text-[10px] font-mono opacity-50 px-1.5 py-0.2 rounded-full border border-[var(--app-border-subtle)]">
                                {ds.count} {ds.count === 1 ? "row" : "rows"}
                              </span>
                            </div>
                            <p className="text-[11px] opacity-60 truncate mt-0.5">{ds.desc}</p>
                          </div>
                        </div>

                        {/* Dual Action Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                          <button
                            type="button"
                            onClick={ds.pdfFn}
                            disabled={exportingTarget !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-40"
                            title={`Download ${ds.name} PDF statement`}
                          >
                            {exportingTarget === ds.pdfTarget ? (
                              <Loader2 size={12} className="animate-spin text-rose-400" />
                            ) : (
                              <FileText size={12} />
                            )}
                            <span>PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={ds.csvFn}
                            disabled={exportingTarget !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-40"
                            title={`Export ${ds.name} to CSV`}
                          >
                            {exportingTarget === ds.csvTarget ? (
                              <Loader2 size={12} className="animate-spin text-emerald-400" />
                            ) : (
                              <FileSpreadsheet size={12} />
                            )}
                            <span>CSV</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: VAULT SECURITY & CACHE SYNC                             */}
        {/* ============================================================== */}
        {activeTab === "security" && (
          <div className="space-y-6 animate-in fade-in duration-200">
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
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Security & Vault Session</h2>
                    <p className="text-xs opacity-60">Multi-tenant encrypted personal finance vault</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full border text-emerald-400 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Protected & Active
                </span>
              </div>

              {/* Status Rows */}
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

              {/* Action Buttons: Refresh & Sign Out */}
              <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePurgeCacheAndSync}
                  disabled={cacheSyncing}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border hover:bg-[var(--app-bg)] transition-all cursor-pointer opacity-80 hover:opacity-100 disabled:opacity-40 shadow-xs active:scale-95"
                  style={{
                    borderColor: "var(--app-border)",
                    color: "var(--app-fg)",
                  }}
                  title="Refresh all account balances and transaction data"
                >
                  <RotateCcw size={13} className={cacheSyncing ? "animate-spin text-emerald-400" : ""} />
                  <span>{cacheSyncing ? "Refreshing Data..." : "Synchronize Workspace Cache"}</span>
                </button>

                <button
                  type="button"
                  onClick={signOut}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Securely sign out of your arthaX account"
                >
                  <LogOut size={13} />
                  <span>Sign Out of arthaX</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
