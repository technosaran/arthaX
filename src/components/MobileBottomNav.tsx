"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  PieChart,
  ArrowLeftRight,
  Menu,
  Landmark,
  CandlestickChart,
  Coins,
  ShieldCheck,
  Gem,
  Bitcoin,
  Zap,
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  Users,
  BookOpen,
  Clock,
  Scale,
  ReceiptIndianRupee,
  Sparkles,
  Settings,
  X,
  ChevronRight,
  Download,
} from "lucide-react";

export type MobileNavGroup = "dashboard" | "portfolio" | "cashflow" | "more";

export interface MobileNavDestination {
  id: MobileNavGroup;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  defaultTab: string;
}

export const MOBILE_NAV_DESTINATIONS: MobileNavDestination[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard, defaultTab: "dashboard" },
  { id: "portfolio", label: "Portfolio", icon: PieChart, defaultTab: "stocks" },
  { id: "cashflow", label: "Cashflow", icon: ArrowLeftRight, defaultTab: "expenses" },
  { id: "more", label: "More", icon: Menu, defaultTab: "settings" },
];

export function getMobileNavGroup(tab: string): MobileNavGroup {
  switch (tab) {
    case "dashboard":
      return "dashboard";
    case "stocks":
    case "mutual-funds":
    case "bonds":
    case "gold-silver":
    case "crypto":
    case "fno":
    case "accounts":
      return "portfolio";
    case "income":
    case "expenses":
    case "budgets":
    case "ledger":
    case "forecast":
    case "reconciliation":
      return "cashflow";
    case "tax":
    case "tax-harvesting":
    case "goals":
    case "family":
    case "settings":
    case "profile":
    default:
      return "more";
  }
}

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export default function MobileBottomNav({ activeTab, onSelectTab }: MobileBottomNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const currentGroup = getMobileNavGroup(activeTab);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");
    setIsStandalone(standalone);
  }, []);

  // Close sheet on Escape key or browser back navigation
  useEffect(() => {
    if (!sheetOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    const handlePop = () => setSheetOpen(false);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("popstate", handlePop);
    };
  }, [sheetOpen]);

  const handleDestinationClick = (dest: MobileNavDestination) => {
    if (dest.id === "more") {
      setSheetOpen(true);
    } else {
      setSheetOpen(false);
      onSelectTab(dest.defaultTab);
    }
  };

  const handleSelectModule = (tab: string) => {
    setSheetOpen(false);
    onSelectTab(tab);
  };

  return (
    <>
      {/* 1. Mobile Bottom Dock Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t safe-bottom-nav select-none transition-colors backdrop-blur-xl"
        style={{
          backgroundColor: "var(--app-nav-bg)",
          borderColor: "var(--app-border)",
        }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {MOBILE_NAV_DESTINATIONS.map((dest) => {
            const Icon = dest.icon;
            const isGroupActive = currentGroup === dest.id;

            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => handleDestinationClick(dest)}
                aria-current={isGroupActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 ${
                  isGroupActive
                    ? "text-[var(--app-accent)] font-bold"
                    : "text-[var(--app-muted)] hover:text-[var(--app-fg)] opacity-85"
                }`}
              >
                <div className="relative">
                  <Icon size={20} className={isGroupActive ? "text-[var(--app-accent)]" : ""} />
                  {isGroupActive && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[var(--app-accent)] shadow-[0_0_6px_var(--app-accent)]" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-1 truncate">{dest.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 2. Slide-up All Modules Sheet */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sovereign Financial Suite"
          className="fixed inset-0 z-50 md:hidden flex flex-col justify-end animate-in fade-in duration-200"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs cursor-pointer"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet Modal Container */}
          <div
            className="relative z-10 w-full max-h-[85vh] rounded-t-3xl border-t p-5 safe-bottom-nav overflow-y-auto sheet-slide-up shadow-2xl"
            style={{
              backgroundColor: "var(--app-card-elevated)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-[var(--app-border)] mx-auto mb-4 opacity-70" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border-subtle)] mb-4">
              <div>
                <h3 className="text-base font-bold tracking-tight">Sovereign Financial Suite</h3>
                <p className="text-xs opacity-60 font-mono">Select a module to view</p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-8 h-8 rounded-full border border-[var(--app-border)] flex items-center justify-center text-[var(--app-fg)] hover:bg-[var(--app-card-hover)] cursor-pointer"
                aria-label="Close sheet"
              >
                <X size={16} />
              </button>
            </div>

            {/* Categorized Grid */}
            <div className="space-y-4">
              {/* Investments */}
              <div>
                <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-400 mb-2">
                  Investments & Assets
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ModuleItem
                    icon={CandlestickChart}
                    label="Stocks"
                    active={activeTab === "stocks"}
                    onClick={() => handleSelectModule("stocks")}
                  />
                  <ModuleItem
                    icon={Coins}
                    label="Mutual Funds"
                    active={activeTab === "mutual-funds"}
                    onClick={() => handleSelectModule("mutual-funds")}
                  />
                  <ModuleItem
                    icon={ShieldCheck}
                    label="Bonds"
                    active={activeTab === "bonds"}
                    onClick={() => handleSelectModule("bonds")}
                  />
                  <ModuleItem
                    icon={Gem}
                    label="Gold & Silver"
                    active={activeTab === "gold-silver"}
                    onClick={() => handleSelectModule("gold-silver")}
                  />
                  <ModuleItem
                    icon={Bitcoin}
                    label="Crypto"
                    active={activeTab === "crypto"}
                    onClick={() => handleSelectModule("crypto")}
                  />
                  <ModuleItem
                    icon={Zap}
                    label="Futures & Options"
                    active={activeTab === "fno"}
                    onClick={() => handleSelectModule("fno")}
                  />
                </div>
              </div>

              {/* Cash Flow */}
              <div>
                <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-sky-400 mb-2">
                  Cash Flow & Ledger
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ModuleItem
                    icon={Landmark}
                    label="Accounts"
                    active={activeTab === "accounts"}
                    onClick={() => handleSelectModule("accounts")}
                  />
                  <ModuleItem
                    icon={TrendingDown}
                    label="Expenses"
                    active={activeTab === "expenses"}
                    onClick={() => handleSelectModule("expenses")}
                  />
                  <ModuleItem
                    icon={TrendingUp}
                    label="Income"
                    active={activeTab === "income"}
                    onClick={() => handleSelectModule("income")}
                  />
                  <ModuleItem
                    icon={Target}
                    label="Budgets"
                    active={activeTab === "budgets"}
                    onClick={() => handleSelectModule("budgets")}
                  />
                  <ModuleItem
                    icon={BookOpen}
                    label="Ledger"
                    active={activeTab === "ledger"}
                    onClick={() => handleSelectModule("ledger")}
                  />
                  <ModuleItem
                    icon={Clock}
                    label="Runway & Forecast"
                    active={activeTab === "forecast"}
                    onClick={() => handleSelectModule("forecast")}
                  />
                  <ModuleItem
                    icon={Scale}
                    label="Reconciliation"
                    active={activeTab === "reconciliation"}
                    onClick={() => handleSelectModule("reconciliation")}
                  />
                </div>
              </div>

              {/* Tax & Workspace */}
              <div>
                <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-purple-400 mb-2">
                  Tax, Goals & Settings
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ModuleItem
                    icon={ReceiptIndianRupee}
                    label="Tax Overview"
                    active={activeTab === "tax"}
                    onClick={() => handleSelectModule("tax")}
                  />
                  <ModuleItem
                    icon={Sparkles}
                    label="Tax Harvesting"
                    active={activeTab === "tax-harvesting"}
                    onClick={() => handleSelectModule("tax-harvesting")}
                  />
                  <ModuleItem
                    icon={Trophy}
                    label="Goals"
                    active={activeTab === "goals"}
                    onClick={() => handleSelectModule("goals")}
                  />
                  <ModuleItem
                    icon={Users}
                    label="Family"
                    active={activeTab === "family"}
                    onClick={() => handleSelectModule("family")}
                  />
                  <ModuleItem
                    icon={Settings}
                    label="Settings"
                    active={activeTab === "settings"}
                    onClick={() => handleSelectModule("settings")}
                  />
                </div>
              </div>

              {/* Install PWA Quick Tile */}
              {!isStandalone && (
                <div className="pt-2 border-t border-[var(--app-border-subtle)]">
                  <button
                    type="button"
                    onClick={() => {
                      setSheetOpen(false);
                      window.dispatchEvent(new CustomEvent("arthax:open-pwa-install"));
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 transition-all cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Download size={16} className="text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-[var(--app-fg)]">Install ArthaX Mobile App</div>
                        <div className="text-[10px] text-emerald-400/80">Add to Home Screen for native fullscreen</div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="opacity-60" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModuleItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all cursor-pointer active:scale-98 ${
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold shadow-xs"
          : "border-[var(--app-border-subtle)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)]"
      }`}
    >
      <div className="flex items-center gap-2.5 truncate">
        <Icon size={16} className={active ? "text-emerald-400" : "opacity-70"} />
        <span className="truncate">{label}</span>
      </div>
      <ChevronRight size={13} className="opacity-40 flex-shrink-0" />
    </button>
  );
}
