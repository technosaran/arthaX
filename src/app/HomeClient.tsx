"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import DashboardSection from "@/components/DashboardSection";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import { Skeleton, StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { Loader2 } from "lucide-react";

const TabLoadingFallback = () => (
  <main
    className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-6 sm:space-y-8"
    style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
  >
    {/* Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-[var(--app-border)]">
      <div className="space-y-2">
        <Skeleton className="h-7 sm:h-9 w-48 sm:w-64 rounded-xl" />
        <Skeleton className="h-4 w-72 sm:w-96 rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
    </div>

    {/* Metric Cards Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    {/* Content Cards Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
      <div className="lg:col-span-7">
        <CardSkeleton rows={5} />
      </div>
      <div className="lg:col-span-5">
        <CardSkeleton rows={4} />
      </div>
    </div>
  </main>
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
          <span>Securing session credentials...</span>
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
      {/* Modern Responsive Sidebar */}
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
