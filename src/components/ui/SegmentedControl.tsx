"use client";

import React from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  size?: "sm" | "md";
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: SegmentedControlProps<T>) {
  const isSm = size === "sm";

  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl border border-[var(--app-border)] select-none ${className}`}
      style={{
        backgroundColor: "var(--app-card-subtle)",
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center justify-center gap-1.5 rounded-lg transition-all duration-150 cursor-pointer font-semibold ${
              isSm
                ? "px-2.5 py-1 text-[11px]"
                : "px-3.5 py-1.5 text-xs"
            } ${
              isSelected
                ? "bg-[var(--app-card)] text-[var(--app-fg)] shadow-xs border border-[var(--app-border)] font-bold"
                : "border border-transparent text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
