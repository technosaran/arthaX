"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Filter, ChevronDown, Check, Search, X } from "lucide-react";

export interface CategoryFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  categoryColors?: Record<string, string>;
  allLabel?: string;
  align?: "left" | "right";
  className?: string;
}

export function CategoryFilterDropdown({
  value,
  onChange,
  categories,
  categoryColors = {},
  allLabel = "All Categories",
  align = "right",
  className = "",
}: CategoryFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const activeColor = value !== "all" ? categoryColors[value] || "#71717A" : null;
  const isCustomSelected = value !== "all";

  const handleSelect = (catValue: string) => {
    onChange(catValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("all");
    setSearchQuery("");
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-all cursor-pointer font-medium select-none outline-none ${
          isCustomSelected
            ? "border-[var(--app-accent-border)] bg-[var(--app-card-elevated)] shadow-xs"
            : "border-[var(--app-border)] bg-[var(--app-input-bg)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)]"
        }`}
        style={{
          color: "var(--app-fg)",
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Left Indicator: Category Color Dot or Filter Icon */}
        {activeColor ? (
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
            style={{ backgroundColor: activeColor }}
          />
        ) : (
          <Filter size={13} className="text-[var(--app-muted)] flex-shrink-0" />
        )}

        <span className="truncate max-w-[140px] sm:max-w-[180px]">
          {isCustomSelected ? value : allLabel}
        </span>

        {/* Clear Button if filtered, otherwise dropdown caret */}
        {isCustomSelected ? (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-md hover:bg-[var(--app-card-subtle)] text-[var(--app-muted)] hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
            title="Reset to All Categories"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown
            size={13}
            className={`text-[var(--app-muted)] transition-transform duration-200 flex-shrink-0 ${
              isOpen ? "rotate-180 text-[var(--app-fg)]" : ""
            }`}
          />
        )}
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 w-72 sm:w-80 rounded-2xl border p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{
            backgroundColor: "var(--app-card-elevated)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
            boxShadow: "var(--app-shadow)",
          }}
          role="listbox"
        >
          {/* Header & Mini Search Bar */}
          <div className="relative mb-2 px-1">
            <Search
              size={13}
              className="absolute left-3.5 top-2.5 text-[var(--app-muted)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] outline-none focus:border-[var(--app-accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2 text-[var(--app-muted)] hover:text-[var(--app-fg)] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* All Categories Option */}
          {!searchQuery && (
            <div className="pb-1 mb-1 border-b border-[var(--app-border-subtle)]">
              <button
                type="button"
                onClick={() => handleSelect("all")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  value === "all"
                    ? "bg-[var(--app-accent-subtle)] text-[var(--app-accent)] font-semibold"
                    : "text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
                }`}
                role="option"
                aria-selected={value === "all"}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full border border-dashed border-[var(--app-muted)]" />
                  <span>{allLabel}</span>
                </div>
                {value === "all" && <Check size={13} className="text-[var(--app-accent)]" />}
              </button>
            </div>
          )}

          {/* Scrollable Categories List */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredCategories.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--app-muted)]">
                No matching categories found
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const isSelected = value === cat;
                const dotColor = categoryColors[cat] || "#71717A";

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-[var(--app-accent-subtle)] text-[var(--app-accent)] font-semibold"
                        : "text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="truncate">{cat}</span>
                    </div>
                    {isSelected && (
                      <Check size={13} className="text-[var(--app-accent)] flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Footer Count */}
          <div className="pt-2 mt-1 border-t border-[var(--app-border-subtle)] px-2 flex items-center justify-between text-[10px] font-mono text-[var(--app-muted)]">
            <span>{categories.length} Total Categories</span>
            {isCustomSelected && (
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-400 hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryFilterDropdown;
