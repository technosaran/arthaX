"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "subtle";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "secondary",
      size = "md",
      loading = false,
      disabled = false,
      icon,
      iconRight,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    // Base layout & interaction
    const baseStyles =
      "inline-flex items-center justify-center font-medium tracking-tight rounded-xl transition-all duration-150 select-none cursor-pointer border fintech-focus disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

    // Size variants
    const sizeStyles: Record<ButtonSize, string> = {
      xs: "text-[11px] px-2.5 py-1 gap-1.5 h-7",
      sm: "text-xs px-3 py-1.5 gap-2 h-8",
      md: "text-xs sm:text-sm px-4 py-2 gap-2 h-9 sm:h-10",
      lg: "text-sm sm:text-base px-5 py-2.5 gap-2.5 h-11 sm:h-12",
      icon: "w-9 h-9 sm:w-10 sm:h-10 p-0",
      "icon-sm": "w-8 h-8 p-0",
    };

    // Semantic variant styles
    const variantStyles: Record<ButtonVariant, { className: string; defaultStyle?: React.CSSProperties }> = {
      primary: {
        className:
          "bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white border-transparent shadow-sm shadow-[var(--app-accent)]/20 font-semibold",
      },
      secondary: {
        className:
          "border-[var(--app-border)] hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)]",
        defaultStyle: {
          backgroundColor: "var(--app-card)",
          borderColor: "var(--app-border)",
          color: "var(--app-fg)",
        },
      },
      outline: {
        className:
          "border-[var(--app-border)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] bg-transparent text-[var(--app-fg)]",
      },
      ghost: {
        className:
          "border-transparent bg-transparent hover:bg-[var(--app-card-hover)] text-[var(--app-fg-muted)] hover:text-[var(--app-fg)]",
      },
      danger: {
        className:
          "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 hover:border-rose-500/50 font-semibold",
      },
      subtle: {
        className:
          "bg-[var(--app-accent-subtle)] text-[var(--app-accent)] border-[var(--app-accent-border)] hover:bg-[var(--app-accent-subtle)]/80 font-semibold",
      },
    };

    const variantConf = variantStyles[variant];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${baseStyles} ${sizeStyles[size]} ${variantConf.className} ${className}`}
        style={{ ...variantConf.defaultStyle, ...style }}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === "xs" || size === "icon-sm" ? 13 : 15} className="animate-spin" />
        ) : (
          icon && <span className="flex-shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && iconRight && <span className="flex-shrink-0">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
