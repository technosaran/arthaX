"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import DashboardSection from "@/components/DashboardSection";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import { Loader2 } from "lucide-react";

const TabLoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center p-8">
    <div className="flex items-center gap-2.5 text-xs font-mono opacity-50">
      <Loader2 size={16} className="animate-spin text-emerald-400" />
      <span>Loading section...</span>
    </div>
  </div>
);

const AccountsSection = dynamic(() => import("@/components/AccountsSection"), {
  loading: TabLoadingFallback,
});
const IncomeSection = dynamic(() => import("@/components/IncomeSection"), {
  loading: TabLoadingFallback,
});
const ExpensesSection = dynamic(() => import("@/components/ExpensesSection"), {
  loading: TabLoadingFallback,
});
const BudgetsSection = dynamic(() => import("@/components/BudgetsSection"), {
  loading: TabLoadingFallback,
});
const FamilySection = dynamic(() => import("@/components/FamilySection"), {
  loading: TabLoadingFallback,
});
const LedgerSection = dynamic(() => import("@/components/LedgerSection"), {
  loading: TabLoadingFallback,
});
const SettingsSection = dynamic(() => import("@/components/SettingsSection"), {
  loading: TabLoadingFallback,
});

export default function HomeClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  // Lazy-mount and keep visited tabs alive for 0ms instant switching without re-renders
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({
    dashboard: true,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    // Auto-collapse sidebar on mobile screens when switching tabs
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setCollapsed(true);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  // Loading Screen while authenticating session
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center p-4 space-y-4 select-none transition-colors"
        style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
      >
        <Logo size={52} showText={false} />
        <div className="flex items-center gap-2.5 text-xs font-mono opacity-60">
          <Loader2 size={16} className="animate-spin text-emerald-400" />
          <span>Loading your workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div
      className="flex h-screen w-full overflow-hidden transition-colors"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Ultra Dark Modern Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* Main Viewport Container with 0ms Instant Tab Switching */}
      <div className="flex-1 h-screen flex flex-col overflow-hidden relative w-full min-w-0">
        {/* Universal Top Header Bar with Theme Switcher & Profile Avatar (Always Visible Across ALL Tabs) */}
        <TopNav
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />

        {/* Content Viewport */}
        <div className="flex-1 h-full overflow-hidden relative w-full min-w-0">
          <div className={`h-full w-full ${activeTab === "dashboard" ? "block" : "hidden"}`}>
            <DashboardSection onNavigate={handleTabChange} />
          </div>
          {visitedTabs.accounts && (
            <div className={`h-full w-full ${activeTab === "accounts" ? "block" : "hidden"}`}>
              <AccountsSection />
            </div>
          )}
          {visitedTabs.income && (
            <div className={`h-full w-full ${activeTab === "income" ? "block" : "hidden"}`}>
              <IncomeSection />
            </div>
          )}
          {visitedTabs.expenses && (
            <div className={`h-full w-full ${activeTab === "expenses" ? "block" : "hidden"}`}>
              <ExpensesSection />
            </div>
          )}
          {visitedTabs.budgets && (
            <div className={`h-full w-full ${activeTab === "budgets" ? "block" : "hidden"}`}>
              <BudgetsSection />
            </div>
          )}
          {visitedTabs.family && (
            <div className={`h-full w-full ${activeTab === "family" ? "block" : "hidden"}`}>
              <FamilySection />
            </div>
          )}
          {visitedTabs.ledger && (
            <div className={`h-full w-full ${activeTab === "ledger" ? "block" : "hidden"}`}>
              <LedgerSection />
            </div>
          )}
          {visitedTabs.settings && (
            <div className={`h-full w-full ${activeTab === "settings" ? "block" : "hidden"}`}>
              <SettingsSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
