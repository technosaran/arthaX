"use client";

import React, { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  subtle?: boolean;
  interactive?: boolean;
  variant?: string;
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      elevated = false,
      subtle = false,
      interactive = false,
      variant,
      hoverable = false,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const isInteractive = interactive || hoverable;
    const isSubtle = subtle || variant === "subtle";
    const isElevated = elevated || variant === "elevated";
    return (
      <div
        ref={ref}
        className={`rounded-2xl border transition-all duration-200 ${
          isSubtle
            ? "border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]"
            : isElevated
            ? "border-[var(--app-border)] bg-[var(--app-card-elevated)] shadow-lg"
            : "border-[var(--app-border)] bg-[var(--app-card)] shadow-xs"
        } ${
          isInteractive
            ? "cursor-pointer hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)]"
            : ""
        } ${className}`}
        style={{
          color: "var(--app-fg)",
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", children, ...props }, ref) => (
  <div
    ref={ref}
    className={`p-5 sm:p-6 pb-2 sm:pb-3 flex flex-col space-y-1 ${className}`}
    {...props}
  >
    {children}
  </div>
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", children, ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-base sm:text-lg font-bold tracking-tight text-[var(--app-fg)] ${className}`}
    {...props}
  >
    {children}
  </h3>
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", children, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-xs sm:text-sm text-[var(--app-muted)] font-normal ${className}`}
    {...props}
  >
    {children}
  </p>
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", children, ...props }, ref) => (
  <div ref={ref} className={`p-5 sm:p-6 pt-2 sm:pt-3 ${className}`} {...props}>
    {children}
  </div>
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", children, ...props }, ref) => (
  <div
    ref={ref}
    className={`p-5 sm:p-6 pt-0 border-t border-[var(--app-border-subtle)] flex items-center justify-between ${className}`}
    {...props}
  >
    {children}
  </div>
));
CardFooter.displayName = "CardFooter";

export default Card;
