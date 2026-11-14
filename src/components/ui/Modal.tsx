"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${sizeClasses[size]} rounded-2xl sm:rounded-3xl border p-5 sm:p-7 shadow-2xl z-10 transition-all duration-200 animate-in fade-in zoom-in-95 my-auto max-h-[90vh] flex flex-col`}
        style={{
          backgroundColor: "var(--app-card)",
          borderColor: "var(--app-border)",
          color: "var(--app-fg)",
          boxShadow: "var(--app-shadow)",
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--app-border-subtle)] flex-shrink-0">
            <div>
              {title && (
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--app-fg)]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-[var(--app-muted)] mt-1">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl border border-[var(--app-border-subtle)] hover:border-[var(--app-border)] hover:bg-[var(--app-card-hover)] flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-all cursor-pointer flex-shrink-0 active:scale-95"
                aria-label="Close dialog"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* Content with smooth scrolling */}
        <div className="py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
