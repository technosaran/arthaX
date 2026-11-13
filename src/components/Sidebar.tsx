"use client";

import React from "react";
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
  Sparkles,
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

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "accounts", label: "Accounts", icon: Landmark },
  { id: "income", label: "Income", icon: TrendingUp, activeColor: "text-emerald-400" },
  { id: "expenses", label: "Expenses", icon: TrendingDown, activeColor: "text-rose-400" },
  { id: "budgets", label: "Budgets", icon: Target, activeColor: "text-amber-400" },
  { id: "family", label: "Family", icon: Users, activeColor: "text-violet-400" },
  { id: "ledger", label: "Ledger", icon: BookOpen, activeColor: "text-sky-400" },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
}: SidebarProps) {
  const { signOut } = useAuth();

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
            : "translate-x-0 w-64 md:w-60 shadow-2xl md:shadow-none"
        }`}
        style={{
          backgroundColor: "var(--app-bg)",
          color: "var(--app-fg)",
          borderColor: "var(--app-border)",
        }}
      >
        {/* Brand Header */}
        <div
          className="flex items-center h-16 px-3.5 sm:px-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--app-border)" }}
        >
          {collapsed ? (
            <div className="w-full flex items-center justify-center">
              <button
                onClick={() => setCollapsed(false)}
                className="cursor-pointer transition-transform hover:scale-105"
                title="Expand sidebar"
              >
                <Logo size={32} showText={false} />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <Logo size={32} showText={true} />
              <button
                onClick={() => setCollapsed(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer opacity-70 hover:opacity-100 hover:scale-105 active:scale-95"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-card)",
                  color: "var(--app-fg)",
                }}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <X size={15} className="md:hidden" />
                <ChevronLeft size={14} className="hidden md:block" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
          {!collapsed && (
            <div className="px-2 pb-2 text-[10px] font-mono uppercase tracking-wider opacity-40 font-semibold">
              Menu
            </div>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setCollapsed(true);
                  }
                }}
                title={collapsed ? item.label : undefined}
                className={`group relative flex items-center w-full rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                  isSelected
                    ? "shadow-sm"
                    : "hover:bg-[var(--app-card-hover)]"
                } ${collapsed ? "justify-center" : "gap-3"}`}
                style={{
                  backgroundColor: isSelected ? "var(--app-accent-subtle)" : "transparent",
                  color: isSelected ? "var(--app-fg)" : "var(--app-muted)",
                  borderColor: isSelected ? "var(--app-border)" : "transparent",
                }}
              >
                {/* Subtle active pill indicator on left edge */}
                {isSelected && (
                  <span
                    className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full shadow-[0_0_8px_var(--app-accent)]"
                    style={{ backgroundColor: "var(--app-accent)" }}
                  />
                )}

                <Icon
                  size={17}
                  className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isSelected
                      ? item.activeColor || "text-[var(--app-accent)]"
                      : "opacity-70 group-hover:opacity-100"
                  }`}
                  style={isSelected && !item.activeColor ? { color: "var(--app-accent)" } : undefined}
                />

                {!collapsed && (
                  <span className="truncate tracking-tight font-medium text-[13px]">{item.label}</span>
                )}
              </button>
            );
          })}

          {/* Clean Sign Out Button */}
          <div className="pt-3 border-t mt-3" style={{ borderColor: "var(--app-border-subtle)" }}>
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                  setCollapsed(true);
                }
                signOut();
              }}
              title={collapsed ? "Sign Out" : undefined}
              className={`group relative flex items-center w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 ${
                collapsed ? "justify-center" : "gap-3"
              }`}
              style={{
                borderColor: "transparent",
              }}
            >
              <LogOut size={16} className="flex-shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5" />
              {!collapsed && <span className="truncate text-xs">Sign Out</span>}
            </button>
          </div>
        </nav>

        {/* Footer / System Status */}
        {!collapsed ? (
          <div
            className="p-3 border-t flex items-center justify-between text-[11px] font-mono opacity-60 flex-shrink-0"
            style={{ borderColor: "var(--app-border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span className="text-[10px] uppercase tracking-wider">Synced & Encrypted</span>
            </div>
            <span className="text-[10px]">v1.0</span>
          </div>
        ) : (
          <div
            className="p-2 flex justify-center border-t flex-shrink-0"
            style={{ borderColor: "var(--app-border)" }}
          >
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer opacity-70 hover:opacity-100 hover:scale-105"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
                color: "var(--app-fg)",
              }}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
