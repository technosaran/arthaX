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
  Copy,
  AlertTriangle,
  Trash2,
  Send,
  Bot,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Smartphone,
  Mic,
  MessageSquare,
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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

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

type SettingsTab = "profile" | "statements" | "integrations" | "security" | "danger";

export default function SettingsSection() {
  const { user, profile, refreshProfile, signOut, updateProfileLocally } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [greetingName, setGreetingName] = useState(profile?.name || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [cacheSyncing, setCacheSyncing] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState(false);

  // Telegram Integration State
  const [telegramData, setTelegramData] = useState<{
    is_linked: boolean;
    telegram_username: string | null;
    telegram_chat_id: string | null;
    link_token: string | null;
    bot_username: string;
    loading: boolean;
  }>({
    is_linked: Boolean(profile?.telegram_chat_id),
    telegram_username: profile?.telegram_username || null,
    telegram_chat_id: profile?.telegram_chat_id || null,
    link_token: profile?.telegram_link_token || null,
    bot_username: "Artha_X_bot",
    loading: false,
  });
  const [copiedLinkToken, setCopiedLinkToken] = useState(false);
  const [refreshingTelegram, setRefreshingTelegram] = useState(false);

  // Master Data Wipe State
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeConfirmationInput, setWipeConfirmationInput] = useState("");
  const [isWiping, setIsWiping] = useState(false);

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

  // Fetch Telegram Integration Status
  const fetchTelegramStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/integrations/telegram/link");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTelegramData({
            is_linked: data.is_linked,
            telegram_username: data.telegram_username,
            telegram_chat_id: data.telegram_chat_id,
            link_token: data.link_token,
            bot_username: data.bot_username || "Artha_X_bot",
            loading: false,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch Telegram link status:", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "integrations") {
      fetchTelegramStatus();
    }
  }, [activeTab, fetchTelegramStatus]);

  const handleRegenerateToken = async () => {
    setRefreshingTelegram(true);
    try {
      const res = await fetch("/api/v1/integrations/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_token" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.link_token) {
          setTelegramData((prev) => ({ ...prev, link_token: data.link_token }));
          showToast("New Code Generated", "Use this code with /link in Telegram", "success");
        }
      }
    } catch {
      showToast("Error", "Failed to generate new Telegram code", "error");
    } finally {
      setRefreshingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    setRefreshingTelegram(true);
    try {
      const res = await fetch("/api/v1/integrations/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink" }),
      });
      if (res.ok) {
        await fetchTelegramStatus();
        showToast("Telegram Disconnected", "Your Telegram chat is no longer linked to arthaX.", "success");
      }
    } catch {
      showToast("Error", "Failed to disconnect Telegram", "error");
    } finally {
      setRefreshingTelegram(false);
    }
  };

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
        theme: theme || "dark",
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

  const handleCopyAccountId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedAccountId(true);
      showToast("Copied", "Account ID copied to clipboard.", "success");
      setTimeout(() => setCopiedAccountId(false), 2000);
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

  // Master Wipe Entire Workspace Data Handler
  const handleMasterWipe = async () => {
    if (wipeConfirmationInput.trim().toUpperCase() !== "DELETE") {
      showToast("Confirmation Required", 'Please type "DELETE" to confirm data wipe.', "error");
      return;
    }

    setIsWiping(true);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/v1/workspace/wipe", {
        method: "POST",
        headers,
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.success) {
        if (user?.id) {
          await supabase.from("transfers").delete().eq("user_id", user.id);
          await supabase.from("recurring_rules").delete().eq("user_id", user.id);
          await supabase.from("expenses").delete().eq("user_id", user.id);
          await supabase.from("income").delete().eq("user_id", user.id);
          await supabase.from("budgets").delete().eq("user_id", user.id);
          await supabase.from("family_responsibilities").delete().eq("user_id", user.id);
          await supabase.from("family_goals").delete().eq("user_id", user.id);
          await supabase.from("family_emergency_vault").delete().eq("user_id", user.id);
          await supabase.from("family_members").delete().eq("user_id", user.id);

          const { data: accs } = await supabase.from("accounts").select("id, name, last_four").eq("user_id", user.id);
          const cashAcc = accs?.find((a) => a.last_four === "CASH" || a.name.toLowerCase() === "cash in hand");
          if (accs && accs.length > 0) {
            const others = accs.filter((a) => a.id !== cashAcc?.id);
            if (others.length > 0) {
              await supabase.from("accounts").delete().in("id", others.map((a) => a.id));
            }
          }
          if (cashAcc) {
            await supabase.from("accounts").update({ balance: 0.0 }).eq("id", cashAcc.id);
          } else {
            await supabase.from("accounts").insert({
              user_id: user.id,
              name: "Cash in Hand",
              type: "Liquid Cash",
              balance: 0.0,
              last_four: "CASH",
            });
          }
        } else {
          throw new Error(result.error || "Failed to wipe workspace data");
        }
      }

      const keysToPurge = [
        getUserCacheKey(userId, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(userId, CACHE_KEYS.INCOME),
        getUserCacheKey(userId, CACHE_KEYS.EXPENSES),
        getUserCacheKey(userId, CACHE_KEYS.TRANSFERS),
        getUserCacheKey(userId, CACHE_KEYS.BUDGETS),
        getUserCacheKey(userId, CACHE_KEYS.LEDGER),
        getUserCacheKey(userId, CACHE_KEYS.PORTFOLIO),
        getUserCacheKey(userId, CACHE_KEYS.FAMILY_MEMBERS),
        getUserCacheKey(userId, CACHE_KEYS.FAMILY_RESPONSIBILITIES),
        getUserCacheKey(userId, CACHE_KEYS.SETTINGS),
        "arthax:cache:accounts",
        "arthax:cache:ledger",
        "arthax:cache:portfolio",
      ];
      await invalidateCacheKeys(keysToPurge);

      try {
        if (typeof window !== "undefined") {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && (k.startsWith("arthax_c_") || k === "arthax_cached_profile")) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => window.localStorage.removeItem(k));
        }
      } catch {}

      setCounts({
        accounts: 1,
        income: 0,
        expenses: 0,
        budgets: 0,
        ledger: 0,
        total: 1,
      });

      setWipeModalOpen(false);
      setWipeConfirmationInput("");

      showToast("Workspace Wiped", "All financial records and accounts have been permanently erased.", "success");

      await refreshCounts();
      if (refreshProfile) await refreshProfile();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("arthax:workspace_wiped"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not complete master wipe.";
      console.error("Master wipe failed:", err);
      showToast("Wipe Failed", msg, "error");
    } finally {
      setIsWiping(false);
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

  // Export All JSON Backup
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
      name: "Category Budgets",
      desc: "Configured monthly limits and spending progress",
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
      name: "Bank & Cash Accounts",
      desc: "Connected accounts, cash balance, and statements",
      count: counts.accounts,
      icon: Landmark,
      iconColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      pdfFn: handleExportAccountsPDF,
      csvFn: handleExportAccountsCSV,
      pdfTarget: "accounts_pdf",
      csvTarget: "accounts",
    },
  ];

  const renderDangerZoneCard = () => (
    <Card
      className="p-6 sm:p-7 space-y-5 shadow-sm transition-all border-rose-500/30"
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-500/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-rose-400">Danger Zone: Delete All Data</h2>
              <Badge variant="rose">Irreversible</Badge>
            </div>
            <p className="text-xs opacity-60 mt-0.5">
              Permanently delete all transactions, accounts, budgets, and family data.
            </p>
          </div>
        </div>

        <Badge variant="rose" className="self-start sm:self-auto font-mono">
          {counts.total} Total Records
        </Badge>
      </div>

      <div
        className="p-4 sm:p-5 rounded-xl border border-rose-500/20 bg-[var(--app-bg)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1.5 max-w-xl">
          <div className="font-bold text-xs text-rose-300">
            Delete All Data & Reset Account
          </div>
          <p className="text-xs opacity-70 leading-relaxed">
            Deletes all expenses, income records, transfers, category budgets, family records, and custom accounts. Cash balance will reset to ₹0.00. This action cannot be undone.
          </p>

          <div className="flex items-center gap-3 pt-1 text-[11px] font-mono opacity-60 flex-wrap">
            <span>• {counts.ledger} Transactions</span>
            <span>• {counts.accounts} Accounts</span>
            <span>• {counts.budgets} Budgets</span>
          </div>
        </div>

        <Button
          variant="danger"
          size="md"
          icon={<Trash2 size={14} />}
          onClick={() => {
            setWipeConfirmationInput("");
            setWipeModalOpen(true);
          }}
        >
          Wipe Entire Data
        </Button>
      </div>
    </Card>
  );

  return (
    <main
      className="flex-1 h-full px-3.5 sm:px-6 md:px-8 py-5 sm:py-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-16">
        {/* TOP HEADER */}
        <PageHeader
          title="Settings"
          description="Personalize your workspace identity, export statements, and manage account security."
          badge={
            <Badge variant="violet" dot>
              Preferences & Vault
            </Badge>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw size={13} className={cacheSyncing ? "animate-spin text-emerald-400" : ""} />}
              loading={cacheSyncing}
              onClick={handlePurgeCacheAndSync}
            >
              Sync Workspace
            </Button>
          }
        />

        {/* SUB-NAV TABS */}
        <SegmentedControl
          options={[
            {
              value: "profile",
              label: (
                <span className="flex items-center gap-2">
                  <User size={14} />
                  <span>Profile & Identity</span>
                </span>
              ),
            },
            {
              value: "statements",
              label: (
                <span className="flex items-center gap-2">
                  <FileText size={14} />
                  <span>Statements & Data</span>
                  <Badge variant="neutral" className="ml-1">
                    {counts.total}
                  </Badge>
                </span>
              ),
            },
            {
              value: "integrations",
              label: (
                <span className="flex items-center gap-2">
                  <Bot size={14} />
                  <span>Integrations & Bots</span>
                </span>
              ),
            },
            {
              value: "security",
              label: (
                <span className="flex items-center gap-2">
                  <ShieldCheck size={14} />
                  <span>Security & Privacy</span>
                </span>
              ),
            },
            {
              value: "danger",
              label: (
                <span className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle size={14} />
                  <span>Danger Zone</span>
                </span>
              ),
            },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as SettingsTab)}
        />

        {/* TAB 1: PROFILE & IDENTITY */}
        {activeTab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <Card className="p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--app-border-subtle)]">
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
                  <Badge variant="sky" dot>
                    Google Account
                  </Badge>
                )}
              </div>

              {/* Visual Identity Row */}
              <div
                className="p-4 sm:p-5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                      className="w-14 h-14 rounded-2xl border border-[var(--app-border)] flex items-center justify-center font-extrabold text-lg flex-shrink-0 bg-emerald-500/10 text-emerald-400"
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

                {/* Account ID with Copy Button */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[10px] font-mono opacity-50 uppercase tracking-wider">Account ID:</span>
                  <button
                    type="button"
                    onClick={handleCopyAccountId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-lg border hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    style={{
                      borderColor: "var(--app-border)",
                      backgroundColor: "var(--app-card)",
                      color: "var(--app-fg)",
                    }}
                    title="Click to copy Account ID"
                  >
                    <span>{user?.id ? `${user.id.substring(0, 8)}...` : "local_account"}</span>
                    {copiedAccountId ? (
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
                  <label className="text-xs font-bold uppercase tracking-wider block opacity-75 font-mono">
                    Greeting Name
                  </label>
                  <p className="text-xs opacity-60 mt-0.5">
                    Controls your personalized dashboard greeting and report signatory name.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={greetingName}
                      onChange={handleNameInputChange}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleNameBlur}
                      placeholder="Enter display name (e.g. Saran)"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    loading={saveStatus === "saving"}
                    disabled={!greetingName.trim()}
                    onClick={() => handleSaveName()}
                    className="min-w-[120px]"
                  >
                    {saveStatus === "saved" ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <span>Save Name</span>
                    )}
                  </Button>
                </div>

                {/* Live Greeting Preview Banner */}
                <div
                  className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="opacity-60 text-[10px] font-mono uppercase tracking-wider">Dashboard Greeting Preview:</span>
                    <span className="font-semibold truncate text-xs text-emerald-400">
                      {timeGreeting}{greetingName.trim() ? `, ${greetingName.trim()}` : ""}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-50 hidden sm:inline">Active</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: STATEMENTS & DATA REPORTS */}
        {activeTab === "statements" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <Card className="p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--app-border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Statements & Data Reports</h2>
                    <p className="text-xs opacity-60">Generate formal PDF statements or download CSV datasets</p>
                  </div>
                </div>

                <Badge variant="outline" className="font-mono self-start sm:self-auto">
                  {loadingCounts ? "Loading..." : `${counts.total} items recorded`}
                </Badge>
              </div>

              {/* 1-Click Master Export Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  size="md"
                  className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                  icon={exportingTarget === "master_pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  disabled={exportingTarget !== null}
                  onClick={handleExportMasterPDF}
                >
                  Master Portfolio PDF
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  icon={exportingTarget === "all_json" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  disabled={exportingTarget !== null}
                  onClick={handleExportAllJSON}
                >
                  Backup All JSON
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  icon={exportingTarget === "all_csv" ? <Loader2 size={14} className="animate-spin" /> : <FolderDown size={14} />}
                  disabled={exportingTarget !== null}
                  onClick={handleExportAllCSVs}
                >
                  All CSV Spreadsheets
                </Button>
              </div>

              {/* Metrics Summary Strip */}
              <div
                className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] text-xs"
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
                  className="divide-y rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] overflow-hidden shadow-xs"
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
                              <Badge variant="neutral">
                                {ds.count} {ds.count === 1 ? "row" : "rows"}
                              </Badge>
                            </div>
                            <p className="text-[11px] opacity-60 truncate mt-0.5">{ds.desc}</p>
                          </div>
                        </div>

                        {/* Dual Action Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            icon={exportingTarget === ds.pdfTarget ? <Loader2 size={12} className="animate-spin text-rose-400" /> : <FileText size={12} />}
                            disabled={exportingTarget !== null}
                            onClick={ds.pdfFn}
                          >
                            PDF
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            icon={exportingTarget === ds.csvTarget ? <Loader2 size={12} className="animate-spin text-emerald-400" /> : <FileSpreadsheet size={12} />}
                            disabled={exportingTarget !== null}
                            onClick={ds.csvFn}
                          >
                            CSV
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Danger Zone Wipe within Statements & Data */}
            {renderDangerZoneCard()}
          </div>
        )}

        {/* TAB 3: INTEGRATIONS & BOTS */}
        {activeTab === "integrations" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* TELEGRAM BOT CARD */}
            <Card className="p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--app-border-subtle)] flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/25 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Send size={18} className="translate-x-[-1px] translate-y-[-1px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold tracking-tight">Telegram Bot Integration</h2>
                      <Badge variant="sky" className="text-[10px]">
                        Official Bot
                      </Badge>
                    </div>
                    <p className="text-xs opacity-60">Log expenses, check balances, and parse bank SMS alerts right from Telegram</p>
                  </div>
                </div>

                <div>
                  {telegramData.is_linked ? (
                    <Badge variant="emerald" dot>
                      Connected: @{telegramData.telegram_username || "Direct Chat"}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Not Linked</Badge>
                  )}
                </div>
              </div>

              {/* Status & Connection Actions */}
              {telegramData.is_linked ? (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        <span>Telegram Chat Active</span>
                      </div>
                      <p className="opacity-70 text-[11px]">
                        Chat ID: <span className="font-mono text-xs">{telegramData.telegram_chat_id}</span>
                        {telegramData.telegram_username && (
                          <span> • Username: <span className="font-mono">@{telegramData.telegram_username}</span></span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://t.me/${telegramData.bot_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#229ED9] hover:bg-[#1e8ec3] text-white text-xs font-medium transition-all shadow-sm"
                      >
                        <Send size={12} />
                        <span>Open Telegram Bot</span>
                        <ExternalLink size={10} className="opacity-70" />
                      </a>

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                        loading={refreshingTelegram}
                        onClick={handleUnlinkTelegram}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] space-y-4">
                  <div className="text-xs space-y-1">
                    <h3 className="font-semibold">Connect Your Telegram Account</h3>
                    <p className="opacity-60">
                      Link your Telegram chat to automatically record expenses from text messages and forwarded bank debit alerts.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Option 1: 1-Click Deep Link */}
                    <div className="p-3.5 rounded-lg border border-[#229ED9]/20 bg-[#229ED9]/5 space-y-2.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#229ED9]">Method 1 • Quick Connect</span>
                        <p className="text-xs opacity-80 mt-1">
                          Click below to launch the bot on Telegram. It will automatically authorize with your unique start token.
                        </p>
                      </div>

                      <a
                        href={`https://t.me/${telegramData.bot_username}?start=${telegramData.link_token || user?.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-[#229ED9] hover:bg-[#1e8ec3] text-white text-xs font-semibold transition-all shadow-sm"
                      >
                        <Send size={13} />
                        <span>Launch @{telegramData.bot_username}</span>
                        <ExternalLink size={12} className="opacity-70" />
                      </a>
                    </div>

                    {/* Option 2: Copy Command */}
                    <div className="p-3.5 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card-bg)] space-y-2.5 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Method 2 • Manual Command</span>
                        <p className="text-xs opacity-80 mt-1">
                          Open <b>@{telegramData.bot_username}</b> in Telegram and paste this link command:
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--app-bg)] border border-[var(--app-border-subtle)]">
                        <code className="text-xs font-mono text-emerald-400 select-all font-semibold">
                          /link {telegramData.link_token || user?.id}
                        </code>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={copiedLinkToken ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            onClick={() => {
                              navigator.clipboard.writeText(`/link ${telegramData.link_token || user?.id}`);
                              setCopiedLinkToken(true);
                              setTimeout(() => setCopiedLinkToken(false), 2000);
                              showToast("Copied to clipboard", "Paste this command into @Artha_X_bot on Telegram", "success");
                            }}
                          >
                            {copiedLinkToken ? "Copied" : "Copy"}
                          </Button>

                          <Button
                            variant="ghost"
                            size="xs"
                            icon={<RefreshCw size={11} className={refreshingTelegram ? "animate-spin text-cyan-400" : ""} />}
                            disabled={refreshingTelegram}
                            onClick={handleRegenerateToken}
                            title="Generate fresh link code"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bot Capabilities Reference Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                {/* Column 1: Natural Messages */}
                <div className="p-4 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <Sparkles size={14} />
                    <span>Natural Expense & SMS Logging</span>
                  </div>
                  <p className="opacity-70 text-[11px] leading-relaxed">
                    Type naturally or paste bank debit notifications. The bot automatically identifies amounts, categories, and matches bank accounts:
                  </p>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)]">
                      <span className="text-emerald-400">Dinner 500 HDFC</span>
                      <p className="text-[10px] opacity-60 font-sans mt-0.5">Logs ₹500 in Food & Dining, debits HDFC</p>
                    </div>
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)]">
                      <span className="text-emerald-400">Petrol 1200 Cash</span>
                      <p className="text-[10px] opacity-60 font-sans mt-0.5">Logs ₹1,200 in Transport, debits Cash</p>
                    </div>
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)]">
                      <span className="text-emerald-400">Swiggy 340</span>
                      <p className="text-[10px] opacity-60 font-sans mt-0.5">Auto-categorized into Food & Dining</p>
                    </div>
                  </div>
                </div>

                {/* Column 2: Commands */}
                <div className="p-4 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-cyan-400">
                    <Bot size={14} />
                    <span>Bot Slash Commands</span>
                  </div>
                  <p className="opacity-70 text-[11px] leading-relaxed">
                    Control and query your personal financial telemetry with instant inline commands:
                  </p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)] flex items-center justify-between">
                      <code className="text-cyan-400 font-mono font-bold">/balance</code>
                      <span className="opacity-70 text-[10px]">Real-time accounts & balances</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)] flex items-center justify-between">
                      <code className="text-cyan-400 font-mono font-bold">/recent</code>
                      <span className="opacity-70 text-[10px]">Last 5 recorded expenses</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)] flex items-center justify-between">
                      <code className="text-cyan-400 font-mono font-bold">/summary</code>
                      <span className="opacity-70 text-[10px]">Today & monthly totals</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)] flex items-center justify-between">
                      <code className="text-cyan-400 font-mono font-bold">/ai &lt;query&gt;</code>
                      <span className="opacity-70 text-[10px]">Google Gemini financial AI</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--app-card-bg)] border border-[var(--app-border-subtle)] flex items-center justify-between">
                      <code className="text-cyan-400 font-mono font-bold">/help</code>
                      <span className="opacity-70 text-[10px]">Full syntax & examples</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* WHATSAPP & SIRI COMPANION CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* WhatsApp Card */}
              <Card className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 font-bold">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                      <MessageSquare size={15} />
                    </div>
                    <div>
                      <div className="font-bold">WhatsApp Cloud API</div>
                      <div className="text-[10px] opacity-60">Meta Graph Webhook</div>
                    </div>
                  </div>
                  <Badge variant="emerald">Live Webhook</Badge>
                </div>

                <p className="opacity-70 leading-relaxed text-[11px]">
                  Send bank SMS alerts or text expenses via WhatsApp. Connects directly to the Meta WhatsApp Cloud API free tier.
                </p>

                <div className="p-2.5 rounded bg-[var(--app-bg)] border border-[var(--app-border-subtle)] space-y-1 font-mono text-[10px]">
                  <div className="opacity-50 uppercase tracking-wider text-[9px]">Webhook Route:</div>
                  <div className="text-emerald-400">/api/webhooks/whatsapp</div>
                </div>
              </Card>

              {/* Apple Siri Card */}
              <Card className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 font-bold">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                      <Mic size={15} />
                    </div>
                    <div>
                      <div className="font-bold">Apple Siri Voice Shortcuts</div>
                      <div className="text-[10px] opacity-60">iOS & macOS Automation</div>
                    </div>
                  </div>
                  <Badge variant="violet">Siri Enabled</Badge>
                </div>

                <p className="opacity-70 leading-relaxed text-[11px]">
                  Say <span className="text-indigo-400 font-semibold">&ldquo;Hey Siri, Log Expense&rdquo;</span> to automatically parse and record expenses with your voice.
                </p>

                <div className="p-2.5 rounded bg-[var(--app-bg)] border border-[var(--app-border-subtle)] space-y-1 font-mono text-[10px]">
                  <div className="opacity-50 uppercase tracking-wider text-[9px]">Shortcut Route:</div>
                  <div className="text-indigo-400">/api/shortcuts/expense</div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 4: VAULT SECURITY & CACHE SYNC */}
        {activeTab === "security" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <Card className="p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--app-border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Account & Security</h2>
                    <p className="text-xs opacity-60">Manage your account security and session</p>
                  </div>
                </div>
              </div>

              {/* Status Rows */}
              <div
                className="p-4 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] space-y-3 text-xs"
              >
                <div
                  className="flex items-center justify-between py-1.5 border-b border-[var(--app-border-subtle)]"
                >
                  <span className="opacity-60 text-xs">Primary Email</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>{user?.email || "Guest Session (Local Mode)"}</span>
                    {user?.email && <CheckCircle2 size={13} className="text-emerald-400" />}
                  </div>
                </div>

                <div
                  className="flex items-center justify-between py-1.5 border-b border-[var(--app-border-subtle)]"
                >
                  <span className="opacity-60 text-xs">Data Protection</span>
                  <span className="text-[11px] opacity-80 font-mono">Encrypted Database (Row-Level Security)</span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="opacity-60 text-xs">Session Status</span>
                  <Badge variant="emerald" dot>
                    Active Session
                  </Badge>
                </div>
              </div>

              {/* Action Buttons: Refresh & Sign Out */}
              <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                <Button
                  variant="outline"
                  size="md"
                  icon={<RotateCcw size={13} className={cacheSyncing ? "animate-spin text-emerald-400" : ""} />}
                  loading={cacheSyncing}
                  onClick={handlePurgeCacheAndSync}
                >
                  Refresh Account Data
                </Button>

                <Button
                  variant="danger"
                  size="md"
                  icon={<LogOut size={13} />}
                  onClick={signOut}
                >
                  Sign Out of arthaX
                </Button>
              </div>
            </Card>

            {/* Danger Zone Wipe within Vault Security */}
            {renderDangerZoneCard()}
          </div>
        )}

        {/* TAB 4: DANGER ZONE (MASTER DATA WIPE) */}
        {activeTab === "danger" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {renderDangerZoneCard()}

            {/* Safeguard & Export Options Card */}
            <Card className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>Safeguards & Export Options Prior to Deletion</span>
              </div>
              <p className="opacity-70 leading-relaxed">
                Before initiating a master wipe, we strongly encourage generating an offline JSON backup or downloading your consolidated CSV statements. Once the wipe is processed, all data will be permanently expunged from the PostgreSQL database and Redis caching layer.
              </p>
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  icon={<Download size={13} />}
                  disabled={exportingTarget !== null}
                  onClick={handleExportAllJSON}
                >
                  Download Complete JSON Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                  icon={<FileText size={13} />}
                  disabled={exportingTarget !== null}
                  onClick={handleExportMasterPDF}
                >
                  Download Master Portfolio PDF
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* POPUP CONFIRMATION MODAL: MASTER DATA WIPE */}
      <Modal
        isOpen={wipeModalOpen}
        onClose={() => !isWiping && setWipeModalOpen(false)}
        title="Delete All Data"
        description="This action is permanent and cannot be undone."
        size="lg"
      >
        <div className="space-y-5">
          {/* Warning Details Callout */}
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2 text-xs">
            <div className="font-bold text-rose-300 flex items-center gap-1.5">
              <span>Are you absolutely certain?</span>
            </div>
            <p className="opacity-80 leading-relaxed">
              You are about to delete all data from your account. The following records will be permanently removed:
            </p>
            <ul className="list-disc list-inside space-y-1 opacity-90 pl-1 font-mono text-[11px] text-rose-200">
              <li>All Expenses & Receipts ({counts.expenses} items)</li>
              <li>All Income Records ({counts.income} items)</li>
              <li>All Account Transfers & Recurring Rules</li>
              <li>All Category Budgets ({counts.budgets} items)</li>
              <li>All Family Members & Transfer Records</li>
              <li>All Linked Accounts & Balances</li>
              <li>All Transaction History</li>
            </ul>
          </div>

          {/* Offline Snapshot Backup Suggestion */}
          <div
            className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)] flex items-center justify-between gap-3 text-xs"
          >
            <div className="min-w-0">
              <div className="font-semibold text-xs">Recommended: Download Backup</div>
              <div className="text-[11px] opacity-60 truncate">Save a complete JSON snapshot prior to wiping.</div>
            </div>
            <Button
              variant="outline"
              size="xs"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              icon={exportingTarget === "all_json" ? <Loader2 size={12} className="animate-spin text-emerald-400" /> : <Download size={12} />}
              disabled={exportingTarget !== null || isWiping}
              onClick={handleExportAllJSON}
            >
              Download JSON
            </Button>
          </div>

          {/* Type Confirmation Safeguard */}
          <div className="space-y-2">
            <Input
              label={
                <span>
                  To confirm, type <span className="font-mono text-rose-400 font-extrabold select-all">DELETE</span> in the box below:
                </span>
              }
              value={wipeConfirmationInput}
              onChange={(e) => setWipeConfirmationInput(e.target.value)}
              disabled={isWiping}
              placeholder='Type "DELETE"'
              autoFocus
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isWiping}
              onClick={() => setWipeModalOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="danger"
              size="md"
              loading={isWiping}
              disabled={wipeConfirmationInput.trim().toUpperCase() !== "DELETE" || isWiping}
              icon={<Trash2 size={14} />}
              onClick={handleMasterWipe}
            >
              Permanently Wipe Everything
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
