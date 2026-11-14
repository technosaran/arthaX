"use client";

import React, { forwardRef, useId } from "react";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "label"> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = "",
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
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

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-all duration-150 outline-hidden placeholder:text-[var(--app-muted)]/60 disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : ""
            } ${rightIcon ? "pr-9" : ""} ${
              error
                ? "border-rose-500/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "border-[var(--app-border)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-ring)]"
            } ${className}`}
            style={{
              backgroundColor: "var(--app-input-bg)",
              color: "var(--app-fg)",
            }}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 flex items-center justify-center text-[var(--app-muted)]">
              {rightIcon}
            </div>
          )}
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

Input.displayName = "Input";
export default Input;
