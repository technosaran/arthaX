"use client";

import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  leftIcon?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      leftIcon,
      children,
      className = "",
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold tracking-tight text-[var(--app-fg)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center justify-center text-[var(--app-muted)] pointer-events-none">
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full appearance-none rounded-xl border px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-medium transition-all duration-150 outline-hidden cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : ""
            } ${
              error
                ? "border-rose-500/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "border-[var(--app-border)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-ring)]"
            } ${className}`}
            style={{
              backgroundColor: "var(--app-input-bg)",
              color: "var(--app-fg)",
            }}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3.5 flex items-center justify-center text-[var(--app-muted)] pointer-events-none">
            <ChevronDown size={15} />
          </div>
        </div>

        {error ? (
          <p className="text-[11px] text-rose-400 font-medium tracking-tight">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-[11px] text-[var(--app-muted)] font-normal">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
