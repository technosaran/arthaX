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
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;
    const ariaDescribedBy = error
      ? errorId
      : helperText
      ? helperId
      : props["aria-describedby"];

    return (
      <div className="w-full space-y-1 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-[11px] sm:text-xs font-semibold tracking-tight text-[var(--app-fg)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-2.5 flex items-center justify-center text-[var(--app-muted)] pointer-events-none">
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={ariaDescribedBy}
            className={`w-full appearance-none rounded-xl border px-3 py-1.5 sm:py-2 pr-8 text-xs font-medium transition-all duration-150 outline-hidden cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-8.5" : ""
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

          <div className="absolute right-2.5 flex items-center justify-center text-[var(--app-muted)] pointer-events-none">
            <ChevronDown size={14} />
          </div>
        </div>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-[10px] sm:text-[11px] text-rose-400 font-medium tracking-tight"
          >
            {error}
          </p>
        ) : helperText ? (
          <p
            id={helperId}
            className="text-[10px] sm:text-[11px] text-[var(--app-muted)] font-normal"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
