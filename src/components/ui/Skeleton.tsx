"use client";

import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", style, ...props }) => {
  return (
    <div
      className={`fintech-shimmer ${className}`}
      style={{
        backgroundColor: "var(--app-card-subtle)",
        ...style,
      }}
      {...props}
    />
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div
      className="p-5 sm:p-6 rounded-2xl border space-y-3"
      style={{
        backgroundColor: "var(--app-card)",
        borderColor: "var(--app-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-36 rounded-lg mt-2" />
      <Skeleton className="h-3 w-28 rounded-md mt-1" />
    </div>
  );
};

export const CardSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div
      className="p-5 sm:p-7 rounded-2xl border space-y-4"
      style={{
        backgroundColor: "var(--app-card)",
        borderColor: "var(--app-border)",
      }}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border-subtle)]">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-3 w-16 rounded-md" />
      </div>
      <div className="space-y-3 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-xl flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28 rounded-sm" />
                <Skeleton className="h-2.5 w-16 rounded-sm" />
              </div>
            </div>
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
