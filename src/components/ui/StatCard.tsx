"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export interface StatCardProps {
  title?: string;
  label?: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: "emerald" | "rose" | "amber" | "sky" | "violet" | "neutral";
  trend?: {
    value?: string | number;
    direction?: "up" | "down" | "neutral";
    label?: string;
  };
  subtitle?: React.ReactNode;
  progress?: {
    value: number; // 0 - 100
    color?: string;
  };
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  label,
  value,
  icon,
  iconColor = "emerald",
  trend,
  subtitle,
  progress,
  className = "",
  onClick,
}) => {
  const displayTitle = title || label || "";
  const colorMap = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    neutral: "bg-[var(--app-track-bg)] text-[var(--app-muted)] border-[var(--app-border-subtle)]",
  };

  return (
    <div
      onClick={onClick}
      className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 shadow-xs ${
        onClick
          ? "cursor-pointer hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)]"
          : "hover:border-[var(--app-border-hover)]"
      } ${className}`}
      style={{
        backgroundColor: "var(--app-card)",
        borderColor: "var(--app-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--app-muted)] tracking-tight">
          {displayTitle}
        </span>
        {icon && (
          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorMap[iconColor]}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--app-fg)] tabular-nums tracking-tight">
          {value}
        </div>

        {trend && (
          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium">
            {trend.direction === "up" && (
              <span className="text-emerald-400 inline-flex items-center gap-0.5">
                <ArrowUpRight size={13} />
                <span>{trend.value}</span>
              </span>
            )}
            {trend.direction === "down" && (
              <span className="text-rose-400 inline-flex items-center gap-0.5">
                <ArrowDownRight size={13} />
                <span>{trend.value}</span>
              </span>
            )}
            {trend.direction === "neutral" && (
              <span className="text-[var(--app-muted)] inline-flex items-center gap-0.5">
                <Minus size={13} />
                <span>{trend.value}</span>
              </span>
            )}
            {trend.label && (
              <span className="text-[var(--app-muted)] truncate">{trend.label}</span>
            )}
          </div>
        )}

        {subtitle && !trend && (
          <div className="mt-2 text-xs text-[var(--app-muted)] font-medium">
            {subtitle}
          </div>
        )}

        {progress && (
          <div className="mt-3 space-y-1">
            <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, progress.value))}%`,
                  backgroundColor: progress.color || "var(--app-accent)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
