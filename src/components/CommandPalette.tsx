"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, ArrowRight, Sun, Moon, Eye, EyeOff, User, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/Sidebar";
import { useTheme } from "@/context/ThemeContext";
import { usePrivacyMode } from "@/utils/privacyMode";
import { useToast } from "@/context/ToastContext";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: string) => void;
}

interface PaletteEntry {
  id: string;
  label: string;
  section: string;
  icon: React.ReactNode;
  onExecute: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectTab,
}: CommandPaletteProps) {
  const { theme, setTheme } = useTheme();
  const { isPrivacyMasked, togglePrivacyMask } = usePrivacyMode();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const closePalette = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  const entries: PaletteEntry[] = useMemo(() => {
    const navEntries: PaletteEntry[] = NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      return {
        id: `nav:${item.id}`,
        label: item.label,
        section: item.section || "Module",
        icon: <Icon size={15} className="text-[var(--app-accent)]" />,
        onExecute: () => {
          onSelectTab(item.id);
          closePalette();
        },
      };
    });

    navEntries.push({
      id: "nav:profile",
      label: "Account Profile",
      section: "Workspace",
      icon: <User size={15} className="text-[var(--app-accent)]" />,
      onExecute: () => {
        onSelectTab("profile");
        closePalette();
      },
    });

    navEntries.push({
      id: "action:theme",
      label: theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme",
      section: "Quick Action",
      icon:
        theme === "dark" ? (
          <Sun size={15} className="text-amber-500" />
        ) : (
          <Moon size={15} className="text-sky-400" />
        ),
      onExecute: () => {
        const next = theme === "dark" ? "light" : "dark";
        void setTheme(next);
        showToast(
          next === "dark" ? "Dark Theme Activated" : "Light Theme Activated",
          undefined,
          "info"
        );
        closePalette();
      },
    });

    navEntries.push({
      id: "action:privacy",
      label: isPrivacyMasked ? "Reveal Balances (Disable Privacy Mode)" : "Hide Balances (Enable Privacy Mode)",
      section: "Quick Action",
      icon: isPrivacyMasked ? (
        <Eye size={15} className="text-emerald-400" />
      ) : (
        <EyeOff size={15} className="text-emerald-400" />
      ),
      onExecute: () => {
        const masked = togglePrivacyMask();
        showToast(
          masked ? "Privacy Mode Enabled" : "Privacy Mode Disabled",
          undefined,
          "info"
        );
        closePalette();
      },
    });

    return navEntries;
  }, [theme, setTheme, isPrivacyMasked, togglePrivacyMask, onSelectTab, closePalette, showToast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.section.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
    );
  }, [entries, query]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === "Enter" && filtered[safeIndex]) {
        e.preventDefault();
        filtered[safeIndex].onExecute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, safeIndex, closePalette]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick navigation command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
    >
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={closePalette}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: "var(--app-card-elevated)",
          borderColor: "var(--app-border)",
          color: "var(--app-fg)",
        }}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--app-border-subtle)]">
          <Search size={16} className="text-[var(--app-accent)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Jump to module, tax, forecast, or quick action..."
            className="flex-1 bg-transparent text-sm outline-hidden placeholder:text-[var(--app-muted)]"
          />
          <button
            type="button"
            onClick={closePalette}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)] cursor-pointer"
            aria-label="Close quick search"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5" role="listbox" aria-label="Navigation options">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--app-muted)]">
              No matching modules or actions found.
            </div>
          ) : (
            filtered.map((entry, idx) => {
              const isSelected = idx === safeIndex;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={entry.onExecute}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[var(--app-card-hover)] text-[var(--app-fg)] border border-[var(--app-border)]"
                      : "text-[var(--app-fg)] border border-transparent hover:bg-[var(--app-card-hover)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)] flex items-center justify-center shrink-0">
                      {entry.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{entry.label}</div>
                      <div className="text-[10px] font-mono text-[var(--app-muted)] uppercase tracking-wider">
                        {entry.section}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    size={13}
                    className={`shrink-0 transition-opacity ${
                      isSelected ? "opacity-90 text-[var(--app-accent)]" : "opacity-30"
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-[var(--app-border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--app-muted)]">
          <span>↑↓ Navigate · ↵ Select · Esc Close</span>
          <span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
