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
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const ariaDescribedBy = error
      ? errorId
      : helperText
      ? helperId
      : props["aria-describedby"];

    return (
      <div className="w-full space-y-1 text-left">
        {label && (
          <label
            htmlFor={inputId}
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

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={ariaDescribedBy}
            className={`w-full rounded-xl border px-3 py-1.5 sm:py-2 text-xs font-medium transition-all duration-150 outline-hidden placeholder:text-[var(--app-muted)]/60 disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-8.5" : ""
            } ${rightIcon ? "pr-8.5" : ""} ${
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
            <div className="absolute right-2.5 flex items-center justify-center text-[var(--app-muted)]">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-[10px] sm:text-[11px] text-rose-600 dark:text-rose-400 font-medium tracking-tight"
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

Input.displayName = "Input";
export default Input;
