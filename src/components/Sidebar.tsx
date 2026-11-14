"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Landmark,
  TrendingUp,
  TrendingDown,
  Target,
  BookOpen,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tag?: string;
  group: "finance" | "system";
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "finance" },
  { id: "accounts", label: "Accounts", icon: Landmark, group: "finance" },
  { id: "income", label: "Income", icon: TrendingUp, group: "finance" },
  { id: "expenses", label: "Expenses", icon: TrendingDown, group: "finance" },
  { id: "budgets", label: "Budgets", icon: Target, group: "finance" },
  { id: "family", label: "Family", icon: Users, group: "finance" },
  { id: "ledger", label: "Ledger", icon: BookOpen, group: "finance" },
  { id: "settings", label: "Settings", icon: Settings, group: "system" },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
}: SidebarProps) {
  const { signOut } = useAuth();
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setCollapsed(true);
    }
  };

  const financeItems = NAV_ITEMS.filter((item) => item.group === "finance");
  const systemItems = NAV_ITEMS.filter((item) => item.group === "system");

  const renderNavButton = (item: NavItemDef) => {
    const Icon = item.icon;
    const isSelected = activeTab === item.id;

    return (
      <div key={item.id} className="relative">
        <button
          type="button"
          onClick={() => handleTabSelect(item.id)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
          className={`group relative flex items-center w-full rounded-xl transition-all duration-150 cursor-pointer fintech-focus ${
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5 gap-3"
          } ${
            isSelected
              ? "bg-[var(--app-card-elevated)] text-[var(--app-fg)] font-semibold border border-[var(--app-border)] shadow-xs"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)] border border-transparent"
          }`}
          aria-current={isSelected ? "page" : undefined}
        >
          {/* Active Accent Bar on Left */}
          {isSelected && !collapsed && (
            <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--app-accent)] shadow-[0_0_8px_var(--app-accent)]" />
          )}

          <Icon
            size={17}
            className={`flex-shrink-0 transition-transform duration-150 ${
              isSelected
                ? "text-[var(--app-accent)] scale-105"
                : "opacity-75 group-hover:opacity-100 group-hover:scale-105"
            }`}
          />

          {!collapsed && (
            <>
              <span className="truncate tracking-tight text-xs sm:text-[13px] flex-1 text-left">
                {item.label}
              </span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)] flex-shrink-0 shadow-[0_0_6px_var(--app-accent)]" />
              )}
            </>
          )}
        </button>

        {/* Instant Sleek Floating Tooltip when Collapsed */}
        {collapsed && hoveredItemId === item.id && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-elevated)] text-[var(--app-fg)] text-xs font-semibold shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
            {item.label}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col h-screen transition-all duration-300 ease-in-out select-none border-r ${
          collapsed
            ? "-translate-x-full md:translate-x-0 md:w-16"
            : "translate-x-0 w-64 md:w-56 shadow-2xl md:shadow-none"
        }`}
        style={{
          backgroundColor: "var(--app-bg)",
          borderColor: "var(--app-border)",
          color: "var(--app-fg)",
        }}
      >
        {/* Brand Header */}
        <div
          className="flex items-center h-14 sm:h-16 px-3.5 border-b flex-shrink-0 border-[var(--app-border)]"
        >
          {collapsed ? (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="cursor-pointer transition-transform hover:scale-105 active:scale-95 fintech-focus rounded-xl p-1"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <Logo size={32} showText={false} />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <Logo size={32} showText={true} />
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="flex items-center justify-center w-8 h-8 rounded-xl border border-[var(--app-border-subtle)] hover:border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] transition-all cursor-pointer opacity-75 hover:opacity-100 active:scale-95 fintech-focus"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <X size={15} className="md:hidden" />
                <ChevronLeft size={15} className="hidden md:block" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-2.5 py-4 space-y-5 overflow-y-auto">
          {/* Group 1: FINANCE */}
          <div>
            {!collapsed && (
              <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-[var(--app-muted)] font-bold opacity-75">
                Financial Suite
              </div>
            )}
            <div className="space-y-1">
              {financeItems.map(renderNavButton)}
            </div>
          </div>

          {/* Group 2: SYSTEM */}
          <div>
            {!collapsed && (
              <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-[var(--app-muted)] font-bold opacity-75">
                Workspace
              </div>
            )}
            <div className="space-y-1">
              {systemItems.map(renderNavButton)}
            </div>
          </div>
        </nav>

        {/* Footer / User Session Control */}
        <div
          className={`p-2.5 border-t border-[var(--app-border)] flex-shrink-0 space-y-2 ${
            collapsed ? "flex flex-col items-center" : ""
          }`}
        >
          <div className="relative w-full">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                  setCollapsed(true);
                }
                signOut();
              }}
              onMouseEnter={() => setHoveredItemId("signout")}
              onMouseLeave={() => setHoveredItemId(null)}
              className={`group flex items-center w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer border border-transparent text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 fintech-focus ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3"
              }`}
              aria-label="Sign out of arthaX"
            >
              <LogOut size={16} className="flex-shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5" />
              {!collapsed && <span className="truncate text-xs">Sign Out</span>}
            </button>

            {collapsed && hoveredItemId === "signout" && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-[var(--app-card-elevated)] text-rose-400 text-xs font-semibold shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                Sign Out
              </div>
            )}
          </div>

          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-[var(--app-border-subtle)] hover:border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-fg)] transition-all cursor-pointer opacity-70 hover:opacity-100 hover:scale-105 active:scale-95 fintech-focus"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
