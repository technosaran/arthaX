"use client";

import React from "react";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8 border-b border-[var(--app-border)] select-none ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-fg)] flex items-center gap-2 flex-wrap">
            {title}
          </h1>
          {badge && <div className="flex-shrink-0">{badge}</div>}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[var(--app-muted)] font-normal max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
