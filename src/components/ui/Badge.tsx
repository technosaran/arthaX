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
  | "sky";

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
      container: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      dotColor: "bg-emerald-400",
    },
    emerald: {
      container: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      dotColor: "bg-emerald-400",
    },
    danger: {
      container: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      dotColor: "bg-rose-400",
    },
    rose: {
      container: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      dotColor: "bg-rose-400",
    },
    warning: {
      container: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dotColor: "bg-amber-400",
    },
    amber: {
      container: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dotColor: "bg-amber-400",
    },
    info: {
      container: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      dotColor: "bg-sky-400",
    },
    sky: {
      container: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      dotColor: "bg-sky-400",
    },
    violet: {
      container: "bg-violet-500/10 text-violet-400 border-violet-500/20",
      dotColor: "bg-violet-400",
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
      <span>{children}</span>
    </span>
  );
};

export default Badge;
