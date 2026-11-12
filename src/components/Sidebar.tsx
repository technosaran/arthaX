"use client";

import React from "react";
import {
  LayoutDashboard,
  Landmark,
  TrendingUp,
  TrendingDown,
  Target,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
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
    <aside
      className={`relative flex flex-col h-screen transition-all duration-300 ease-in-out select-none border-r ${
        collapsed ? "w-16" : "w-52"
      }`}
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-fg)",
        borderColor: "var(--app-border)",
      }}
    >
      {/* Brand Header */}
      <div
        className="flex items-center h-16 px-3.5 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        {collapsed ? (
          <div className="w-full flex items-center justify-center">
            <Logo size={32} showText={false} />
          </div>
        ) : (
          <div className="w-full flex items-center justify-between">
            <Logo size={32} showText={true} />
            <button
              onClick={() => setCollapsed(true)}
              className="flex items-center justify-center w-7 h-7 rounded-lg border transition-all cursor-pointer opacity-70 hover:opacity-100"
              style={{
                borderColor: "var(--app-border)",
                backgroundColor: "var(--app-card)",
                color: "var(--app-fg)",
              }}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center w-full rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                isSelected
                  ? "font-bold shadow-sm"
                  : "hover:bg-[var(--app-card-hover)]"
              } ${collapsed ? "justify-center" : "gap-3"}`}
              style={{
                backgroundColor: isSelected ? "var(--app-accent-subtle)" : "transparent",
                color: isSelected ? "var(--app-fg)" : "var(--app-muted)",
                borderColor: isSelected ? "var(--app-border)" : "transparent",
              }}
            >
              {/* Active subtle indicator bar */}
              {isSelected && (
                <span
                  className="absolute left-1 top-2 bottom-2 w-1 rounded-full"
                  style={{ backgroundColor: "var(--app-accent)" }}
                />
              )}

              <Icon
                size={16}
                className={`flex-shrink-0 transition-colors ${
                  isSelected
                    ? item.activeColor || "text-[var(--app-accent)]"
                    : "opacity-70 group-hover:opacity-100"
                }`}
                style={isSelected && !item.activeColor ? { color: "var(--app-accent)" } : undefined}
              />

              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* Clean Sign Out Button */}
        <div className="pt-2 border-t mt-2" style={{ borderColor: "var(--app-border-subtle)" }}>
          <button
            onClick={signOut}
            title={collapsed ? "Sign Out" : undefined}
            className={`group relative flex items-center w-full rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 ${
              collapsed ? "justify-center" : "gap-3"
            }`}
            style={{
              borderColor: "transparent",
            }}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">Sign Out</span>}
          </button>
        </div>
      </nav>

      {/* Footer / Expand Control when Collapsed */}
      {collapsed && (
        <div
          className="p-2 flex justify-center border-t"
          style={{ borderColor: "var(--app-border)" }}
        >
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer opacity-70 hover:opacity-100"
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
  );
}
