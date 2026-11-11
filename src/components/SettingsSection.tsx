"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sun,
  Moon,
  Zap,
  Check,
  Loader2,
  Download,
  Database,
  FolderDown,
  TrendingDown,
  TrendingUp,
  Target,
  Landmark,
  Receipt,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";

// Utility function to escape CSV values according to RFC 4180
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Utility to trigger client-side file downloads
function triggerFileDownload(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
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
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [greetingName, setGreetingName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [themeStatus, setThemeStatus] = useState<string | null>(null);

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

  const isInitialLoad = useRef(true);
  const userId = user?.id || "default_user";

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

  // Fetch current name directly from Supabase on mount
  useEffect(() => {
    const fetchCurrentName = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("user_settings")
          .select("name")
          .eq("id", userId)
          .maybeSingle();

        if (data?.name) {
          setGreetingName(data.name);
        } else if (profile?.name) {
          setGreetingName(profile.name);
        }
      } catch (err) {
        console.error("Error reading settings:", err);
      } finally {
        setTimeout(() => {
          isInitialLoad.current = false;
        }, 100);
      }
    };

    fetchCurrentName();
    refreshCounts();

    // Cross-device Realtime synchronization for user settings and database records
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-settings-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
          filter: `id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.new?.name && payload.new.name !== greetingName) {
            isInitialLoad.current = true;
            setGreetingName(payload.new.name);
            setTimeout(() => {
              isInitialLoad.current = false;
            }, 200);
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
  }, [userId, profile, refreshCounts, greetingName]);

  // Debounced Auto-Save as user types
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (!user?.id || !greetingName.trim()) return;

    setSaveStatus("saving");

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("user_settings")
          .upsert({
            id: userId,
            name: greetingName.trim(),
            updated_at: new Date().toISOString(),
          });

        if (!error) {
          setSaveStatus("saved");
          showToast("Name Saved", `Greeting updated to "${greetingName.trim()}".`, "success");
          if (refreshProfile) refreshProfile();
          setTimeout(() => setSaveStatus("idle"), 2500);
        } else {
          setSaveStatus("idle");
          showToast("Save Failed", "Could not sync with database.", "error");
        }
      } catch {
        setSaveStatus("idle");
        showToast("Network Error", "Please check connection.", "error");
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [greetingName, userId, showToast, refreshProfile]);

  const handleThemeChange = async (mode: ThemeMode, label: string) => {
    setThemeStatus("Saving...");
    await setTheme(mode);
    setThemeStatus(`${label}`);
    showToast("Theme Updated", `Switched to ${label}.`, "info");
    setTimeout(() => setThemeStatus(null), 2000);
  };

  // Helper to query all database records freshly for exports
  const fetchAllData = async () => {
    const supabase = createClient();
    let accQuery = supabase.from("accounts").select("*").order("name");
    let incQuery = supabase.from("income").select("*").order("received_date", { ascending: false });
    let expQuery = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    let budQuery = supabase.from("budgets").select("*").order("month_year", { ascending: false });
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

  // CSV Generator: Expenses
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
    return "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
      triggerFileDownload(csvData, `arthaX_expenses_${dateStr}.csv`, "text/csv;charset=utf-8;");
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
    return "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
      triggerFileDownload(csvData, `arthaX_income_${dateStr}.csv`, "text/csv;charset=utf-8;");
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

    return "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  };

  // 4. Export Consolidated Financial Ledger CSV
  const handleExportLedgerCSV = async () => {
    try {
      setExportingTarget("ledger");
      const { income, expenses, accounts } = await fetchAllData();
      const totalTx = income.length + expenses.length;
      if (totalTx === 0) {
        showToast("No Records", "There are no ledger transactions to export.", "info");
        return;
      }

      const csvData = getLedgerCSV(income, expenses, accounts);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerFileDownload(csvData, `arthaX_Consolidated_Ledger_${dateStr}.csv`, "text/csv;charset=utf-8;");
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
    return "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
      triggerFileDownload(csvData, `arthaX_budgets_${dateStr}.csv`, "text/csv;charset=utf-8;");
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
    return "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
      triggerFileDownload(csvData, `arthaX_accounts_${dateStr}.csv`, "text/csv;charset=utf-8;");
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
        triggerFileDownload(getLedgerCSV(income, expenses, accounts), `arthaX_Consolidated_Ledger_${dateStr}.csv`, "text/csv;charset=utf-8;");
        exportedCount++;
      }

      if (expenses.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getExpensesCSV(expenses, accounts), `arthaX_expenses_${dateStr}.csv`, "text/csv;charset=utf-8;");
        }, 200);
        exportedCount++;
      }

      if (income.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getIncomeCSV(income, accounts), `arthaX_income_${dateStr}.csv`, "text/csv;charset=utf-8;");
        }, 400);
        exportedCount++;
      }

      if (budgets.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getBudgetsCSV(budgets), `arthaX_budgets_${dateStr}.csv`, "text/csv;charset=utf-8;");
        }, 600);
        exportedCount++;
      }

      if (accounts.length > 0) {
        setTimeout(() => {
          triggerFileDownload(getAccountsCSV(accounts), `arthaX_accounts_${dateStr}.csv`, "text/csv;charset=utf-8;");
        }, 800);
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

  const themeOptions: { id: ThemeMode; label: string; icon: any }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "ultra", label: "Ultra", icon: Zap },
  ];

  return (
    <main
      className="flex-1 h-screen p-4 sm:p-6 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        {/* Compact Settings Header */}
        <div
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: "1px solid var(--app-border)" }}
        >
          <div>
            <h1 className="text-lg font-bold tracking-tight">Settings</h1>
            <p className="text-[11px] opacity-60">Personalization, preferences, and data exports</p>
          </div>
          <div
            className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Synced</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* DATA EXPORTS (COMPACT, HIGH-DENSITY CARD)                      */}
        {/* ============================================================== */}
        <div
          className="rounded-xl p-3.5 sm:p-4 space-y-3 transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            border: "1px solid var(--app-border)",
          }}
        >
          {/* Card Top Title & Quick Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Database size={14} className="opacity-70" />
              <h2 className="text-xs font-bold uppercase tracking-wider">Data Exports</h2>
              <span
                className="text-[10px] font-mono px-1.5 py-0.2 rounded border"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                {loadingCounts ? "..." : `${counts.total} items`}
              </span>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportAllJSON}
                disabled={exportingTarget !== null}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-40"
                style={{
                  backgroundColor: "var(--app-fg)",
                  color: "var(--app-bg)",
                }}
                title="Download entire database state as JSON backup"
              >
                {exportingTarget === "all_json" ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Download size={11} />
                )}
                <span>Backup JSON</span>
              </button>

              <button
                onClick={handleExportAllCSVs}
                disabled={exportingTarget !== null}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all cursor-pointer hover:opacity-100 opacity-80 active:scale-95 disabled:opacity-40"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor: "var(--app-bg)",
                  color: "var(--app-fg)",
                }}
                title="Download all datasets as individual CSV spreadsheets"
              >
                {exportingTarget === "all_csv" ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <FolderDown size={11} />
                )}
                <span>All CSVs</span>
              </button>
            </div>
          </div>

          {/* Compact Mini Telemetry Bar */}
          <div
            className="grid grid-cols-4 gap-1 py-1 px-2 rounded-lg border text-[11px]"
            style={{
              backgroundColor: "var(--app-bg)",
              borderColor: "var(--app-border-subtle)",
            }}
          >
            <div className="flex items-center justify-between px-1.5">
              <span className="opacity-60 text-[10px] font-mono">Accounts</span>
              <span className="font-bold font-mono text-[11px]">{loadingCounts ? "—" : counts.accounts}</span>
            </div>
            <div
              className="flex items-center justify-between px-1.5 border-l"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <span className="opacity-60 text-[10px] font-mono text-emerald-400">Income</span>
              <span className="font-bold font-mono text-[11px] text-emerald-400">
                {loadingCounts ? "—" : counts.income}
              </span>
            </div>
            <div
              className="flex items-center justify-between px-1.5 border-l"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <span className="opacity-60 text-[10px] font-mono text-rose-400">Expenses</span>
              <span className="font-bold font-mono text-[11px] text-rose-400">
                {loadingCounts ? "—" : counts.expenses}
              </span>
            </div>
            <div
              className="flex items-center justify-between px-1.5 border-l"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <span className="opacity-60 text-[10px] font-mono text-amber-400">Budgets</span>
              <span className="font-bold font-mono text-[11px] text-amber-400">
                {loadingCounts ? "—" : counts.budgets}
              </span>
            </div>
          </div>

          {/* Compact Dataset List (Clean rows) */}
          <div
            className="divide-y rounded-lg border overflow-hidden"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-bg)",
            }}
          >
            {/* 1. Master Consolidated Ledger */}
            <div className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <Receipt size={13} className="opacity-70 flex-shrink-0" />
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium truncate">Consolidated Ledger</span>
                  <span className="text-[10px] opacity-40 hidden sm:inline">• Debits & Credits Statement</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-[10px] font-mono opacity-60">
                  {counts.ledger} rows
                </span>
                <button
                  onClick={handleExportLedgerCSV}
                  disabled={exportingTarget !== null}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-all hover:opacity-100 opacity-80 cursor-pointer disabled:opacity-40"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-card)",
                    color: "var(--app-fg)",
                  }}
                  title="Export complete ledger statement to CSV"
                >
                  {exportingTarget === "ledger" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Download size={11} />
                  )}
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* 2. Expenses Records */}
            <div className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingDown size={13} className="text-rose-400 flex-shrink-0" />
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium truncate">Expenses</span>
                  <span className="text-[10px] opacity-40 hidden sm:inline">• Bills & Outflows</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-[10px] font-mono opacity-60">
                  {counts.expenses} rows
                </span>
                <button
                  onClick={handleExportExpensesCSV}
                  disabled={exportingTarget !== null}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-all hover:opacity-100 opacity-80 cursor-pointer disabled:opacity-40"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-card)",
                    color: "var(--app-fg)",
                  }}
                  title="Export expenses to CSV"
                >
                  {exportingTarget === "expenses" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Download size={11} />
                  )}
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* 3. Income Records */}
            <div className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingUp size={13} className="text-emerald-400 flex-shrink-0" />
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium truncate">Income Streams</span>
                  <span className="text-[10px] opacity-40 hidden sm:inline">• Salaries & Dividends</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-[10px] font-mono opacity-60">
                  {counts.income} rows
                </span>
                <button
                  onClick={handleExportIncomeCSV}
                  disabled={exportingTarget !== null}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-all hover:opacity-100 opacity-80 cursor-pointer disabled:opacity-40"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-card)",
                    color: "var(--app-fg)",
                  }}
                  title="Export income streams to CSV"
                >
                  {exportingTarget === "income" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Download size={11} />
                  )}
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* 4. Budgets Matrix */}
            <div className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <Target size={13} className="text-amber-400 flex-shrink-0" />
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium truncate">Category Budgets</span>
                  <span className="text-[10px] opacity-40 hidden sm:inline">• Monthly Limits</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-[10px] font-mono opacity-60">
                  {counts.budgets} rows
                </span>
                <button
                  onClick={handleExportBudgetsCSV}
                  disabled={exportingTarget !== null}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-all hover:opacity-100 opacity-80 cursor-pointer disabled:opacity-40"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-card)",
                    color: "var(--app-fg)",
                  }}
                  title="Export budgets matrix to CSV"
                >
                  {exportingTarget === "budgets" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Download size={11} />
                  )}
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* 5. Accounts Inventory */}
            <div className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <Landmark size={13} className="opacity-70 flex-shrink-0" />
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium truncate">Bank & Liquid Accounts</span>
                  <span className="text-[10px] opacity-40 hidden sm:inline">• Balances & Cards</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-[10px] font-mono opacity-60">
                  {counts.accounts} rows
                </span>
                <button
                  onClick={handleExportAccountsCSV}
                  disabled={exportingTarget !== null}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-all hover:opacity-100 opacity-80 cursor-pointer disabled:opacity-40"
                  style={{
                    borderColor: "var(--app-border)",
                    backgroundColor: "var(--app-card)",
                    color: "var(--app-fg)",
                  }}
                  title="Export bank accounts to CSV"
                >
                  {exportingTarget === "accounts" ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Download size={11} />
                  )}
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* APPEARANCE / THEME TOGGLE (COMPACT SEGMENTED CONTROL)           */}
        {/* ============================================================== */}
        <div
          className="rounded-xl p-3.5 sm:p-4 space-y-2.5 transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            border: "1px solid var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">Appearance</span>
            {themeStatus && (
              <span className="text-[10px] font-mono opacity-70">{themeStatus}</span>
            )}
          </div>

          <div
            className="grid grid-cols-3 gap-1.5 p-1 rounded-lg border"
            style={{
              backgroundColor: "var(--app-bg)",
              borderColor: "var(--app-border-subtle)",
            }}
          >
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleThemeChange(opt.id, opt.label)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "shadow-sm border font-semibold"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: isSelected ? "var(--app-card)" : "transparent",
                    borderColor: isSelected ? "var(--app-border)" : "transparent",
                    color: "var(--app-fg)",
                  }}
                >
                  <Icon size={13} />
                  <span>{opt.label}</span>
                  {isSelected && <Check size={11} className="opacity-80 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* GREETING NAME (COMPACT INLINE SETTING ROW)                      */}
        {/* ============================================================== */}
        <div
          className="rounded-xl p-3.5 sm:p-4 transition-colors shadow-sm"
          style={{
            backgroundColor: "var(--app-card)",
            border: "1px solid var(--app-border)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">Greeting Name</span>
              <p className="text-[11px] opacity-60">Personalizes the greeting displayed on your dashboard.</p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <input
                type="text"
                value={greetingName}
                onChange={(e) => setGreetingName(e.target.value)}
                placeholder="Enter your name"
                className="w-48 sm:w-56 px-2.5 py-1 text-xs rounded-lg border focus:outline-none transition-colors"
                style={{
                  backgroundColor: "var(--app-bg)",
                  color: "var(--app-fg)",
                  borderColor: "var(--app-border)",
                }}
              />

              <div className="w-14 text-[10px] font-mono flex items-center">
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Loader2 size={10} className="animate-spin" />
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <Check size={11} /> Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
