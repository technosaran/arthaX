"use client";

import React from "react";

export type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "violet"
  | "neutral"
  | "outline"
  | "amber"
  | "emerald"
  | "rose"
  | "sky"
  | "accent";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  dot = false,
  size = "sm",
  className = "",
  ...props
}) => {
  const sizeStyles: Record<string, string> = {
    xs: "text-[10px] px-2 py-0.5",
    sm: "text-[11px] px-2.5 py-0.5",
    md: "text-xs px-3 py-1",
    lg: "text-sm px-3.5 py-1.5",
  };
  const sizeClass = sizeStyles[size] || sizeStyles.sm;
  const variantStyles: Record<string, { container: string; dotColor: string }> = {
    success: {
      container: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
      dotColor: "bg-emerald-600 dark:bg-emerald-400",
    },
    emerald: {
      container: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
      dotColor: "bg-emerald-600 dark:bg-emerald-400",
    },
    danger: {
      container: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
      dotColor: "bg-rose-600 dark:bg-rose-400",
    },
    rose: {
      container: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
      dotColor: "bg-rose-600 dark:bg-rose-400",
    },
    warning: {
      container: "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/25",
      dotColor: "bg-amber-600 dark:bg-amber-400",
    },
    amber: {
      container: "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/25",
      dotColor: "bg-amber-600 dark:bg-amber-400",
    },
    info: {
      container: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
      dotColor: "bg-sky-600 dark:bg-sky-400",
    },
    sky: {
      container: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
      dotColor: "bg-sky-600 dark:bg-sky-400",
    },
    accent: {
      container: "bg-[var(--app-accent-subtle)] text-[var(--app-accent)] border-[var(--app-accent)]/25",
      dotColor: "bg-[var(--app-accent)]",
    },
    violet: {
      container: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25",
      dotColor: "bg-violet-600 dark:bg-violet-400",
    },
    neutral: {
      container: "bg-[var(--app-track-bg)] text-[var(--app-muted)] border-[var(--app-border-subtle)]",
      dotColor: "bg-[var(--app-muted)]",
    },
    outline: {
      container: "bg-transparent text-[var(--app-fg)] border-[var(--app-border)]",
      dotColor: "bg-[var(--app-fg)]",
    },
  };

  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-medium border tracking-tight leading-normal select-none ${sizeClass} ${current.container} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${current.dotColor} flex-shrink-0`} />}
      {children}
    </span>
  );
};

export default Badge;
