"use client";

import React from "react";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center select-none ${
        compact ? "py-8 px-4" : "py-12 sm:py-16 px-6"
      } ${className}`}
    >
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center mb-3 sm:mb-4 text-[var(--app-accent)] shadow-xs transition-transform hover:scale-105"
        style={{
          borderColor: "var(--app-border)",
          backgroundColor: "var(--app-card-subtle)",
        }}
      >
        {icon}
      </div>

      <h3 className="text-sm sm:text-base font-bold tracking-tight text-[var(--app-fg)] max-w-sm">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-[var(--app-muted)] mt-1.5 max-w-md leading-relaxed">
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
