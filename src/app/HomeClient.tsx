"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import DashboardSection from "@/components/DashboardSection";
import AccountsSection from "@/components/AccountsSection";
import IncomeSection from "@/components/IncomeSection";
import ExpensesSection from "@/components/ExpensesSection";
import BudgetsSection from "@/components/BudgetsSection";
import LedgerSection from "@/components/LedgerSection";
import SettingsSection from "@/components/SettingsSection";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import { Loader2 } from "lucide-react";

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
          <Loader2 size={16} className="animate-spin text-[#4bb473]" />
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
      <div className="flex-1 h-screen flex flex-col overflow-hidden relative">
        {/* Universal Top Header Bar with Theme Switcher & Profile Avatar (Always Visible Across ALL Tabs) */}
        <TopNav
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />

        {/* Content Viewport */}
        <div className="flex-1 h-full overflow-hidden relative">
          <div className={`h-full w-full ${activeTab === "dashboard" ? "block" : "hidden"}`}>
            <DashboardSection />
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
