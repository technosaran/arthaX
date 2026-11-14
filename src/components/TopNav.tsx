"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  User,
  Settings,
  LogOut,
  Menu,
  LayoutDashboard,
  Landmark,
  TrendingUp,
  TrendingDown,
  Target,
  BookOpen,
  Users,
  ShieldCheck,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const TAB_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  dashboard: { label: "Financial Overview", icon: LayoutDashboard },
  accounts: { label: "Accounts & Cards", icon: Landmark },
  income: { label: "Income & Inflows", icon: TrendingUp },
  expenses: { label: "Expenses & Outflows", icon: TrendingDown },
  budgets: { label: "Category Budgets", icon: Target },
  family: { label: "Family Financials", icon: Users },
  ledger: { label: "Master Ledger", icon: BookOpen },
  settings: { label: "Settings & Vault", icon: Settings },
};

export default function TopNav({
  activeTab,
  setActiveTab,
  setCollapsed,
}: TopNavProps) {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Synchronize privacy mode from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arthax_privacy_mode") === "true";
      if (saved) {
        setIsPrivacyMasked(true);
        document.documentElement.classList.add("privacy-masked");
      }
    }
  }, []);

  // Close profile dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Compute user name and google avatar
  const displayName =
    profile?.name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const googleAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const isGoogleUser =
    !!googleAvatarUrl ||
    user?.app_metadata?.provider === "google" ||
    user?.identities?.some((i) => i.provider === "google");

  const initials = useMemo(() => {
    if (!displayName) return "U";
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const activeMeta = TAB_META[activeTab] || { label: "Overview", icon: LayoutDashboard };
  const TabIcon = activeMeta.icon;

  const togglePrivacyMask = () => {
    const root = document.documentElement;
    const isMasked = root.classList.toggle("privacy-masked");
    setIsPrivacyMasked(isMasked);
    if (typeof window !== "undefined") {
      localStorage.setItem("arthax_privacy_mode", isMasked ? "true" : "false");
    }
    if (isMasked) {
      showToast(
        "Privacy Mode Enabled",
        "Sensitive financial figures and balances are now blurred for discretion.",
        "info"
      );
    } else {
      showToast(
        "Privacy Mode Disabled",
        "Financial figures and balances are now visible.",
        "info"
      );
    }
  };

  const cycleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <header
      className="h-14 sm:h-16 px-3.5 sm:px-6 md:px-8 border-b flex items-center justify-between flex-shrink-0 select-none z-30 transition-colors backdrop-blur-xl sticky top-0"
      style={{
        backgroundColor: "var(--app-bg)",
        borderColor: "var(--app-border)",
        color: "var(--app-fg)",
      }}
    >
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 pr-2">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] transition-all cursor-pointer opacity-80 hover:opacity-100 active:scale-95 md:hidden flex-shrink-0 fintech-focus"
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0 font-medium">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border border-[var(--app-border)] bg-[var(--app-card)]"
          >
            <TabIcon size={14} className="text-[var(--app-accent)]" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold tracking-tight text-[var(--app-fg)]">arthaX</span>
            <span className="text-[var(--app-muted)] text-xs select-none">/</span>
            <span className="text-[var(--app-muted)] font-medium truncate">
              {activeMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Quick Action Controls & User Avatar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Theme Toggle Button */}
        <button
          type="button"
          onClick={cycleTheme}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 fintech-focus"
          title={`Theme: ${
            theme === "dark" ? "Dark Mode" : "Light Mode"
          } — Click to switch`}
          aria-label="Switch visual theme"
        >
          {theme === "dark" ? (
            <Moon size={14} className="text-sky-400" />
          ) : (
            <Sun size={14} className="text-amber-500" />
          )}
        </button>

        {/* Privacy Mask Toggle */}
        <button
          type="button"
          onClick={togglePrivacyMask}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 fintech-focus ${
            isPrivacyMasked
              ? "ring-2 ring-emerald-500/40 bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              : "border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] opacity-80 hover:opacity-100"
          }`}
          title={
            isPrivacyMasked
              ? "Privacy Mode Active (Balances Masked) — Click to reveal"
              : "Toggle Privacy Mode (Hide Balances)"
          }
          aria-label="Toggle Privacy Mode"
        >
          {isPrivacyMasked ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>

        {/* User Profile Avatar with Popover */}
        <div className="relative ml-1" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[var(--app-border)] bg-[var(--app-card)] flex items-center justify-center overflow-hidden transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95 relative ring-2 ring-transparent hover:ring-[var(--app-accent)] fintech-focus"
            title={user?.email || displayName || "User Profile"}
            aria-label="Open profile menu"
            aria-expanded={isProfileOpen}
          >
            {googleAvatarUrl ? (
              <img
                src={googleAvatarUrl}
                alt={displayName || "Google profile"}
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs font-mono uppercase bg-emerald-500/15 text-emerald-400">
                {initials || <User size={14} className="opacity-70" />}
              </div>
            )}
            {/* Live Status Indicator */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--app-bg)] shadow-[0_0_6px_#10b981]" />
          </button>

          {/* Profile Dropdown Popover */}
          {isProfileOpen && (
            <div
              className="absolute right-0 mt-2.5 w-76 max-w-[calc(100vw-2rem)] rounded-2xl border p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3.5 backdrop-blur-2xl"
              style={{
                backgroundColor: "var(--app-card-elevated)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
                boxShadow: "var(--app-shadow)",
              }}
            >
              {/* Identity Header */}
              <div
                className="flex items-center gap-3 pb-3 border-b border-[var(--app-border-subtle)]"
              >
                <div
                  className="w-10 h-10 rounded-full border border-[var(--app-border)] overflow-hidden flex-shrink-0 flex items-center justify-center"
                >
                  {googleAvatarUrl ? (
                    <img
                      src={googleAvatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-sm bg-emerald-500/15 text-emerald-400">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs truncate text-[var(--app-fg)]">
                    {displayName || "arthaX User"}
                  </div>
                  <div className="text-[11px] text-[var(--app-muted)] truncate">
                    {user?.email || "Personal Account"}
                  </div>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded-full border text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      <ShieldCheck size={10} />
                      {isGoogleUser ? "Google Verified" : "Active Session"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Theme Selector Strip */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-muted)] font-semibold">
                  Visual Appearance
                </div>
                <div
                  className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border border-[var(--app-border-subtle)]"
                  style={{ backgroundColor: "var(--app-card-subtle)" }}
                >
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      theme === "dark"
                        ? "bg-white/[0.1] text-white shadow-xs font-bold"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    <Moon size={12} className="mb-0.5 text-sky-400" />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                      theme === "light"
                        ? "bg-black/[0.08] text-slate-900 shadow-xs font-bold"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    <Sun size={12} className="mb-0.5 text-amber-500" />
                    <span>Light</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div
                className="space-y-1 pt-1 border-t border-[var(--app-border-subtle)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveTab("settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[var(--app-card-hover)] transition-colors cursor-pointer text-left text-[var(--app-fg)]"
                >
                  <Settings size={14} className="opacity-70 text-[var(--app-accent)]" />
                  <span>Settings & Statements</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
