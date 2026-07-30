"use client";

import { useEffect, useState, useRef, startTransition, useMemo } from "react";
import { mutate as globalMutate } from "swr";
import { useUser } from "@/context/user-context";
import { resetUserData, updateSettings } from "./actions";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";
import type { FinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS } from "@/lib/modules";


import ProfileTab from "./components/ProfileTab";
import ModulesTab from "./components/ModulesTab";
import DefaultsTab from "./components/DefaultsTab";
import ImportsTab from "./components/ImportsTab";
import ExportsTab from "./components/ExportsTab";
import IntegrationsTab from "./components/IntegrationsTab";
import SystemStatusTab from "./components/SystemStatusTab";
import DangerZoneTab from "./components/DangerZoneTab";



type TabKey = "profile" | "modules" | "defaults" | "imports" | "integrations" | "exports" | "status" | "danger";

export default function SettingsPage() {
  const { username, setUsername, loading, isSyncing } = useUser();
  const { data, mutate } = useFinanceData();
  const {
    profile,
    accounts = [],
  } = data || {};

  const [input, setInput] = useState(username);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const prevIsSyncingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const gmailStatus = params.get("gmail");
      if (gmailStatus) {
        setActiveTab("integrations");

        const url = new URL(window.location.href);
        url.searchParams.delete("gmail");
        url.searchParams.delete("reason");
        window.history.replaceState({}, "", url.toString());

        if (gmailStatus === "success") {
          toast.success("Gmail account linked successfully!");
          mutate();
        } else {
          const reason = params.get("reason") || "Unknown error";
          toast.error(`Failed to link Gmail: ${reason}`);
        }
      }
    }
  }, [mutate]);

  const [diagnostics, setDiagnostics] = useState<{ name: string; status: string; latency: string; code: number; error?: string }[]>([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const { checkApiHealth } = await import("./actions");
      const res = await checkApiHealth();
      if (res.success && res.results) {
        setDiagnostics(res.results);
      } else {
        toast.error("Failed to run diagnostics");
      }
    } catch {
      toast.error("An error occurred during diagnostics");
    } finally {
      setRunningDiagnostics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "status" && diagnostics.length === 0) {
      runDiagnostics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const defaultAccounts = profile?.default_accounts || {};
  const baseCurrency = profile?.base_currency || "INR";
  const theme = profile?.theme || "system";
  const timezone = profile?.timezone || "Asia/Kolkata";

  const enabledModules = useMemo(() => {
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    const populated = [...raw] as string[];

    if (raw.includes("Income & Expenses")) {
      populated.push("Income", "Expenses");
    } else if (raw.includes("Income") || raw.includes("Expenses")) {
      populated.push("Income & Expenses");
    }

    if (raw.includes("Investments")) {
      populated.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex");
    } else if (
      raw.includes("Stocks") ||
      raw.includes("Mutual Funds") ||
      raw.includes("Bonds") ||
      raw.includes("FnO") ||
      raw.includes("Forex")
    ) {
      populated.push("Investments");
    }

    return populated;
  }, [profile]);

  useEffect(() => {
    if (!loading && !isSyncing) {
      setInput(username);
    }
  }, [loading, username, isSyncing]);

  useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing) {
      startTransition(() =>
        setLastSaved(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        )
      );
    }
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleBlur = () => {
    if (input !== username) {
      setUsername(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const saveSetting = async (key: string, value: unknown, successMessage: string) => {
    const optimisticProfile = {
      username: profile?.username || "",
      base_currency: key === "base_currency" ? value : baseCurrency,
      theme: key === "theme" ? value : theme,
      timezone: key === "timezone" ? value : timezone,
      enabled_modules: key === "enabled_modules" ? value : enabledModules,
      default_accounts: key === "default_accounts" ? value : defaultAccounts,
    };

    mutate((prev: FinanceData | undefined) => (prev ? { ...prev, profile: optimisticProfile } : prev), false);

    const res = await updateSettings({ [key]: value });
    if (res.error) {
      toast.error(res.error);
      mutate();
    } else {
      toast.success(successMessage);
      mutate();
    }
  };

  const handleDefaultAccountChange = (sectionKey: string, accountId: string) => {
    const updatedDefaultAccounts = {
      ...defaultAccounts,
      [sectionKey]: accountId || null,
    };
    saveSetting("default_accounts", updatedDefaultAccounts, "Default account updated");
  };

  const toggleModule = (module: string) => {
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    let newModules: string[];

    if (module === "Income & Expenses") {
      const isEnabled = raw.includes("Income & Expenses") || raw.includes("Income") || raw.includes("Expenses");
      newModules = isEnabled
        ? raw.filter((m) => m !== "Income & Expenses" && m !== "Income" && m !== "Expenses")
        : [...raw.filter((m) => m !== "Income" && m !== "Expenses"), "Income & Expenses"];
    } else if (module === "Investments") {
      const isEnabled =
        raw.includes("Investments") ||
        raw.includes("Stocks") ||
        raw.includes("Mutual Funds") ||
        raw.includes("Bonds") ||
        raw.includes("FnO") ||
        raw.includes("Forex");
      newModules = isEnabled
        ? raw.filter(
            (m) => m !== "Investments" && m !== "Stocks" && m !== "Mutual Funds" && m !== "Bonds" && m !== "FnO" && m !== "Forex"
          )
        : [...raw.filter((m) => !["Stocks", "Mutual Funds", "Bonds", "FnO", "Forex"].includes(m)), "Investments"];
    } else {
      newModules = raw.includes(module) ? raw.filter((m) => m !== module) : [...raw, module];
    }

    newModules = newModules.filter(
      (m) => !["Income", "Expenses", "Stocks", "Mutual Funds", "Bonds", "FnO", "Forex"].includes(m)
    );

    saveSetting("enabled_modules", newModules, `${module} visibility updated`);
  };

  const SECTIONS_REQUIRING_ACCOUNT = [
    { key: "expenses", label: "Expenses", icon: "💳" },
    { key: "income", label: "Income", icon: "💰" },
    { key: "family", label: "Family Transfers", icon: "💜" },
    { key: "goals", label: "Goals & Savings", icon: "🎯" },
    { key: "stocks", label: "Stock Portfolio", icon: "📊" },
    { key: "mutual_funds", label: "Mutual Funds", icon: "🏦" },
    { key: "bonds", label: "Bond Investments", icon: "🔏" },
    { key: "fno", label: "Futures & Options", icon: "📈" },
    { key: "forex", label: "Forex Operations", icon: "💱" },
  ];

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetCountdown, setResetCountdown] = useState(0);
  const [hasCountdownStarted, setHasCountdownStarted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (resetConfirmText === "RESET") {
      if (!hasCountdownStarted) {
        setResetCountdown(3);
        setHasCountdownStarted(true);
      }
    } else {
      setHasCountdownStarted(false);
      setResetCountdown(0);
    }
  }, [resetConfirmText, hasCountdownStarted]);

  useEffect(() => {
    if (resetCountdown <= 0) return;
    const timer = setTimeout(() => setResetCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resetCountdown]);

  const handleResetClick = () => {
    setShowResetModal(true);
    setResetConfirmText("");
    setResetCountdown(0);
    setHasCountdownStarted(false);
  };

  const handleResetConfirm = async () => {
    if (resetConfirmText !== "RESET" || resetCountdown > 0) return;
    setIsResetting(true);
    const toastId = toast.loading("Executing full data erasure...");
    try {
      const result = await resetUserData();
      if (result.error) {
        toast.error(`Reset failed: ${result.error}`, { id: toastId });
      } else {
        toast.success("All data erased successfully", { id: toastId });

        mutate(
          {
            profile: profile || null,
            accounts: [],
            transactions: [],
            ledgerLogs: [],
            investments: [],
            mutualFunds: [],
            bonds: [],
            alternativeAssets: [],
            stockTrades: [],
            mutualFundTrades: [],
            bondTransactions: [],
            fnoTrades: [],
            incomes: [],
            expenses: [],
            budgets: [],
            goals: [],
            liabilities: [],
            forexAccounts: [],
            forexTrades: [],
            forexTransactions: [],
          },
          { revalidate: false }
        );

        globalMutate(
          "finance_family",
          {
            members: [],
            transfers: [],
          },
          { revalidate: false }
        );

        setTimeout(() => {
          window.location.href = "/dashboard?reset=success";
        }, 1500);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`A system error occurred: ${message}`, { id: toastId });
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  const canExecuteReset = resetConfirmText === "RESET" && resetCountdown <= 0 && !isResetting;

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">
            Settings
          </h1>
          <p className="mt-1 text-sm md:text-sm text-[--text-secondary]">
            Manage your account preferences, modules, and database defaults.
          </p>
        </div>
      </div>

      {/* Premium Segmented Toggle Bar */}
      <div className="w-full overflow-x-auto no-scrollbar scroll-smooth py-1">
        <div className="flex items-center gap-1.5 rounded-2xl bg-white/[0.02] border border-white/10 p-1.5 w-max min-w-full md:w-auto shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {[
            { key: "profile", label: "Profile", icon: "👤" },
            { key: "modules", label: "Modules", icon: "🧩" },
            { key: "defaults", label: "Defaults", icon: "⚙️" },
            { key: "imports", label: "Data Imports", icon: "📥" },
            { key: "exports", label: "Data Exports", icon: "📤" },
            { key: "integrations", label: "Integrations", icon: "⚡" },
            { key: "status", label: "System Status", icon: "🟢" },
            { key: "danger", label: "Danger Zone", icon: "⚠️" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;

            let activeStyles = "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_20px_rgba(6,182,212,0.35)]";
            if (tab.key === "imports") activeStyles = "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-[0_4px_20px_rgba(168,85,247,0.35)]";
            if (tab.key === "exports") activeStyles = "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)]";
            if (tab.key === "danger") activeStyles = "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-[0_4px_20px_rgba(244,63,94,0.35)]";

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer shrink-0 ${
                  isActive
                    ? `${activeStyles} border border-white/20`
                    : "text-[--text-muted] hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className="text-sm select-none">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "profile" && (
        <ProfileTab
          input={input}
          username={username}
          isSyncing={isSyncing}
          lastSaved={lastSaved}
          handleChange={handleChange}
          handleBlur={handleBlur}
          handleKeyDown={handleKeyDown}
        />
      )}

      {activeTab === "modules" && (
        <ModulesTab enabledModules={enabledModules} toggleModule={toggleModule} />
      )}

      {activeTab === "defaults" && (
        <DefaultsTab
          defaultAccounts={defaultAccounts}
          accounts={accounts}
          handleDefaultAccountChange={handleDefaultAccountChange}
          sectionsRequiringAccount={SECTIONS_REQUIRING_ACCOUNT}
        />
      )}

      {activeTab === "imports" && (
        <ImportsTab accounts={accounts} mutate={mutate} />
      )}

      {activeTab === "exports" && (
        <ExportsTab />
      )}

      {activeTab === "integrations" && (
        <IntegrationsTab
          profile={profile}
          mutate={mutate}
        />
      )}

      {activeTab === "status" && (
        <SystemStatusTab
          diagnostics={diagnostics}
          runningDiagnostics={runningDiagnostics}
          runDiagnostics={runDiagnostics}
        />
      )}

      {activeTab === "danger" && (
        <DangerZoneTab
          handleResetClick={handleResetClick}
          showResetModal={showResetModal}
          setShowResetModal={setShowResetModal}
          resetConfirmText={resetConfirmText}
          setResetConfirmText={setResetConfirmText}
          resetCountdown={resetCountdown}
          isResetting={isResetting}
          handleResetConfirm={handleResetConfirm}
          canExecuteReset={canExecuteReset}
        />
      )}
    </div>
  );
}
