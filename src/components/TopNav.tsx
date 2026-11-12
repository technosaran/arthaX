"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Sun,
  Moon,
  Zap,
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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const TAB_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  accounts: { label: "Accounts & Vault", icon: Landmark },
  income: { label: "Income Streams", icon: TrendingUp },
  expenses: { label: "Expenses & Outflows", icon: TrendingDown },
  budgets: { label: "Category Budgets", icon: Target },
  family: { label: "Family Space", icon: Users },
  ledger: { label: "Consolidated Ledger", icon: BookOpen },
  settings: { label: "Preferences & Vault", icon: Settings },
};

export default function TopNav({
  activeTab,
  setActiveTab,
  setCollapsed,
}: TopNavProps) {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "ultra" : "light";
    setTheme(next);
  };

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute user name and google avatar
  const displayName = profile?.name || user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const googleAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const isGoogleUser = !!googleAvatarUrl || user?.app_metadata?.provider === "google" || user?.identities?.some((i) => i.provider === "google");

  const initials = useMemo(() => {
    if (!displayName) return "U";
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const activeMeta = TAB_META[activeTab] || { label: "arthaX", icon: LayoutDashboard };
  const TabIcon = activeMeta.icon;

  return (
    <header
      className="h-14 sm:h-16 px-4 sm:px-8 border-b flex items-center justify-between flex-shrink-0 select-none z-30 transition-colors"
      style={{
        backgroundColor: "var(--app-bg)",
        borderColor: "var(--app-border)",
        color: "var(--app-fg)",
      }}
    >
      {/* Left: Mobile Toggle & Active Section Identity */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-1.5 rounded-xl border transition-all cursor-pointer opacity-75 hover:opacity-100 md:hidden"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card)",
            color: "var(--app-fg)",
          }}
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider opacity-40 hidden sm:inline">
            arthaX /
          </span>
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: "var(--app-card)",
              }}
            >
              <TabIcon size={14} className="opacity-80" />
            </span>
            <span className="text-xs sm:text-sm font-bold tracking-tight truncate">
              {activeMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Appearance Logo & Small Circle Profile Avatar */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Appearance Simple Logo (Theme Switcher) */}
        <button
          type="button"
          onClick={cycleTheme}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card)",
            color: "var(--app-fg)",
          }}
          title={`Appearance: ${theme === "light" ? "Light" : theme === "dark" ? "Dark" : "Ultra Dark"} (Click to cycle)`}
          aria-label="Toggle theme appearance"
        >
          {theme === "light" && <Sun size={17} className="text-amber-500" />}
          {theme === "dark" && <Moon size={17} className="text-sky-400" />}
          {theme === "ultra" && <Zap size={17} className="text-[#4bb473]" />}
        </button>

        {/* Profile Logo in Small Circle */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center overflow-hidden transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 relative ring-2 ring-transparent hover:ring-[var(--app-accent)]"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-card)",
            }}
            title={user?.email || displayName || "User Profile"}
            aria-label="Open profile details"
          >
            {googleAvatarUrl ? (
              <img
                src={googleAvatarUrl}
                alt={displayName || "Google profile"}
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-xs font-mono uppercase bg-emerald-500/15 text-emerald-400"
              >
                {initials || <User size={15} className="opacity-70" />}
              </div>
            )}
          </button>

          {/* Profile Dropdown Popover */}
          {isProfileOpen && (
            <div
              className="absolute right-0 mt-2 w-72 rounded-2xl border p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
              }}
            >
              {/* Identity Header */}
              <div
                className="flex items-center gap-3 pb-3 border-b"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                <div
                  className="w-10 h-10 rounded-full border overflow-hidden flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: "var(--app-border)" }}
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
                  <div className="font-bold text-xs truncate">{displayName || "arthaX User"}</div>
                  <div className="text-[11px] opacity-60 truncate">{user?.email || "Local Vault"}</div>
                  <div className="mt-1">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded-full border text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    >
                      {isGoogleUser ? "Google Verified" : "Email Verified"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveTab("settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[var(--app-bg)] transition-colors cursor-pointer text-left"
                >
                  <Settings size={14} className="opacity-70" />
                  <span>Preferences & Settings</span>
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
