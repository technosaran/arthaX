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
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
          {/* Group 1: MONEY */}
          <div>
            {!collapsed && (
              <div className="px-2.5 pb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-semibold">
                Money
              </div>
            )}
            <div className="space-y-1">
              {NAV_ITEMS.filter((item) => item.id !== "settings").map((item) => {
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
                    className={`group relative flex items-center w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                      isSelected
                        ? "bg-white/[0.08] border-white/[0.14] text-white shadow-sm"
                        : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    } ${collapsed ? "justify-center" : "gap-3"}`}
                  >
                    <Icon
                      size={16}
                      className={`flex-shrink-0 transition-transform duration-150 ${
                        isSelected
                          ? "text-white"
                          : "opacity-70 group-hover:opacity-100 group-hover:scale-105"
                      }`}
                    />

                    {!collapsed && (
                      <>
                        <span className="truncate tracking-tight font-medium text-[13px] flex-1 text-left">
                          {item.label}
                        </span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 2: SYSTEM */}
          <div>
            {!collapsed && (
              <div className="px-2.5 pb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-semibold">
                System
              </div>
            )}
            <div className="space-y-1">
              {NAV_ITEMS.filter((item) => item.id === "settings").map((item) => {
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
                    className={`group relative flex items-center w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                      isSelected
                        ? "bg-white/[0.08] border-white/[0.14] text-white shadow-sm"
                        : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    } ${collapsed ? "justify-center" : "gap-3"}`}
                  >
                    <Icon
                      size={16}
                      className={`flex-shrink-0 transition-transform duration-150 ${
                        isSelected
                          ? "text-white"
                          : "opacity-70 group-hover:opacity-100 group-hover:scale-105"
                      }`}
                    />

                    {!collapsed && (
                      <>
                        <span className="truncate tracking-tight font-medium text-[13px] flex-1 text-left">
                          {item.label}
                        </span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Static Bottom Footer / Sign Out */}
        <div
          className={`p-2.5 border-t flex-shrink-0 space-y-1.5 ${collapsed ? "flex flex-col items-center" : ""}`}
          style={{ borderColor: "var(--app-border)" }}
        >
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                setCollapsed(true);
              }
              signOut();
            }}
            title={collapsed ? "Sign Out" : undefined}
            className={`group relative flex items-center w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 ${
              collapsed ? "justify-center px-2" : "gap-3"
            }`}
            style={{
              borderColor: "transparent",
            }}
          >
            <LogOut size={16} className="flex-shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5" />
            {!collapsed && <span className="truncate text-xs">Sign Out</span>}
          </button>

          {collapsed && (
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
          )}
        </div>
      </aside>
    </>
  );
}
