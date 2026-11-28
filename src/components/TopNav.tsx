"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  User,
  Settings,
  LogOut,
  Menu,
  ShieldCheck,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Download,
  Search,
} from "lucide-react";
import Logo from "@/components/Logo";
import { NAV_ITEMS } from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { usePrivacyMode } from "@/utils/privacyMode";
import {
  isGoogleAccount,
  resolveDisplayName,
  resolveAvatarUrl,
  computeInitials,
} from "@/utils/userProfile";

interface TopNavProps {
  activeTab?: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenCommandPalette?: () => void;
}

export default function TopNav({
  activeTab = "dashboard",
  setActiveTab,
  setCollapsed,
  onOpenCommandPalette,
}: TopNavProps) {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const { isPrivacyMasked, togglePrivacyMask: toggleGlobalPrivacy } = usePrivacyMode();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Check PWA installability
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const checkInstall = () =>
      setCanInstallPwa(Boolean((window as { deferredPrompt?: unknown }).deferredPrompt));
    const handleInstalled = () => setCanInstallPwa(false);
    checkInstall();
    window.addEventListener("arthax:pwa-installable", checkInstall);
    window.addEventListener("arthax:pwa-installed", handleInstalled);
    return () => {
      window.removeEventListener("arthax:pwa-installable", checkInstall);
      window.removeEventListener("arthax:pwa-installed", handleInstalled);
    };
  }, []);

  const triggerPwaInstall = useCallback(() => {
    const promptEvent = (window as { deferredPrompt?: { prompt: () => void } }).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
    } else {
      window.dispatchEvent(new CustomEvent("arthax:open-pwa-install"));
      showToast(
        "Install ArthaX App",
        "Follow the on-screen instructions to install ArthaX on your device.",
        "info"
      );
    }
  }, [showToast]);

  // Close dropdowns on outside click or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
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

  // Resolve user display name, Google account status, avatar URL, and initials
  const displayName = resolveDisplayName(profile?.name, user?.user_metadata, user?.email);
  const isGoogleUser = isGoogleAccount(user);
  const googleAvatarUrl = resolveAvatarUrl(user);
  const avatarError = Boolean(googleAvatarUrl && failedAvatarUrl === googleAvatarUrl);
  const initials = computeInitials(displayName);

  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeTab);
  const activeLabel =
    activeTab === "profile" ? "Account Profile" : activeNavMeta?.label || "Dashboard";
  const activeSection =
    activeTab === "profile" ? "Workspace" : activeNavMeta?.section || "Overview";

  const togglePrivacyMask = useCallback(() => {
    const isMasked = toggleGlobalPrivacy();
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
  }, [toggleGlobalPrivacy, showToast]);

  const cycleTheme = useCallback(() => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    showToast(
      nextTheme === "dark" ? "Dark Theme Activated" : "Light Theme Activated",
      nextTheme === "dark"
        ? "Switched to deep dark workspace theme."
        : "Switched to clean daylight theme.",
      "info"
    );
  }, [theme, setTheme, showToast]);

  return (
    <header
      className="h-14 px-3.5 sm:px-5 border-b flex items-center justify-between gap-3 flex-shrink-0 select-none z-30 transition-colors backdrop-blur-xl sticky top-0"
      style={{
        backgroundColor: "var(--app-nav-bg)",
        borderColor: "var(--app-border)",
        color: "var(--app-fg)",
      }}
    >
      {/* Left: Mobile Drawer Toggle OR Desktop Section Breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="md:hidden p-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] transition-all cursor-pointer opacity-80 hover:opacity-100 active:scale-95 flex-shrink-0 fintech-focus"
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} />
        </button>

        <div className="hidden md:flex items-center gap-2 min-w-0 text-xs">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] text-[var(--app-muted)] font-semibold">
            {activeSection}
          </span>
          <span className="text-[var(--app-muted)] opacity-40">/</span>
          <span className="font-bold text-sm tracking-tight text-[var(--app-fg)] truncate">
            {activeLabel}
          </span>
        </div>
      </div>

      {/* Center: Mobile Brand Emblem OR Desktop Command Search Pill */}
      <button
        type="button"
        className="md:hidden flex items-center gap-2 cursor-pointer transition-transform active:scale-95 fintech-focus rounded-xl shrink-0"
        onClick={() => setActiveTab("dashboard")}
        aria-label="Go to Dashboard"
        title="Go to Dashboard"
      >
        <Logo size={24} showText={true} />
      </button>

      {onOpenCommandPalette && (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center justify-between gap-6 w-64 lg:w-80 px-3 py-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] text-xs text-[var(--app-muted)] transition-all cursor-pointer fintech-focus shadow-2xs"
          aria-label="Open quick navigation command palette"
        >
          <span className="flex items-center gap-2 truncate">
            <Search size={13} className="text-[var(--app-accent)] shrink-0" />
            <span className="truncate">Jump to module or action...</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded-md border border-[var(--app-border)] bg-[var(--app-card-subtle)] text-[var(--app-fg)] shrink-0">
            ⌘K
          </kbd>
        </button>
      )}

      {/* Right: Quick Controls & Profile Popover */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Mobile Command Trigger */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="md:hidden w-8 h-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] flex items-center justify-center transition-all cursor-pointer active:scale-95 fintech-focus"
            title="Quick Jump"
            aria-label="Quick Jump Search"
          >
            <Search size={14} />
          </button>
        )}

        {/* PWA Quick Install Pill when available */}
        {canInstallPwa && (
          <button
            type="button"
            onClick={triggerPwaInstall}
            className="h-8 px-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
            title="Install ArthaX App"
          >
            <Download size={13} />
            <span className="hidden xs:inline">Install</span>
          </button>
        )}

        {/* Quick Theme Toggle Button */}
        <button
          type="button"
          onClick={cycleTheme}
          className="w-8 h-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] flex items-center justify-center transition-all cursor-pointer active:scale-95 fintech-focus"
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
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 fintech-focus ${
            isPrivacyMasked
              ? "ring-2 ring-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : "border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] opacity-80"
          }`}
          title={
            isPrivacyMasked
              ? "Privacy Mode Active (Balances Masked)"
              : "Toggle Privacy Mode"
          }
          aria-label="Toggle Privacy Mode"
        >
          {isPrivacyMasked ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>

        {/* User Profile Avatar with Popover */}
        <div className="relative ml-0.5" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full md:rounded-xl md:pl-1.5 md:pr-2.5 md:py-1 border border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-card-hover)] transition-all cursor-pointer shadow-xs active:scale-95 relative fintech-focus"
            title={user?.email || displayName || "User Profile"}
            aria-label="Open profile menu"
            aria-expanded={isProfileOpen}
          >
            <div className="w-7 h-7 md:w-6 md:h-6 rounded-full overflow-hidden flex items-center justify-center relative shrink-0">
              {googleAvatarUrl && !avatarError ? (
                <img
                  src={googleAvatarUrl}
                  alt={displayName || "Google profile"}
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedAvatarUrl(googleAvatarUrl)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {initials || <User size={12} className="opacity-70" />}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-[var(--app-bg)]" />
            </div>
            <span className="hidden lg:inline text-xs font-semibold text-[var(--app-fg)] max-w-[110px] truncate">
              {displayName?.split(" ")[0] || "Account"}
            </span>
          </button>

          {/* Profile Dropdown Popover */}
          {isProfileOpen && (
            <div
              className="absolute right-0 mt-2.5 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3.5 backdrop-blur-2xl"
              style={{
                backgroundColor: "var(--app-card-elevated)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
                boxShadow: "var(--app-shadow)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  setActiveTab("profile");
                }}
                className="w-full flex items-center gap-3 pb-3 border-b border-[var(--app-border-subtle)] text-left hover:opacity-90 transition-opacity cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full border border-[var(--app-border)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {googleAvatarUrl && !avatarError ? (
                    <img
                      src={googleAvatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setFailedAvatarUrl(googleAvatarUrl)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-sm bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded-full border text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      <ShieldCheck size={10} />
                      {isGoogleUser ? "Google Verified" : "Active Session"}
                    </span>
                  </div>
                </div>
              </button>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveTab("profile");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[var(--app-card-hover)] transition-colors cursor-pointer text-left text-[var(--app-fg)]"
                >
                  <User size={14} className="opacity-70 text-emerald-500" />
                  <span>Account Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setActiveTab("settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-[var(--app-card-hover)] transition-colors cursor-pointer text-left text-[var(--app-fg)]"
                >
                  <Settings size={14} className="opacity-70 text-[var(--app-accent)]" />
                  <span>Settings &amp; Statements</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsProfileOpen(false);
                    showToast(
                      "Signing Out",
                      "Ending session and securing financial data...",
                      "info"
                    );
                    await signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
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
