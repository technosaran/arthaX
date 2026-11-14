"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = "success") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);

      // Auto dismiss after 3.8 seconds
      setTimeout(() => {
        removeToast(id);
      }, 3800);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Floating Notifications Hub */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl p-4 border shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 group select-none"
              style={{
                backgroundColor: "var(--app-card-elevated)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
                boxShadow: "var(--app-shadow)",
              }}
            >
              {/* Status Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {toast.type === "success" && (
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 size={15} />
                  </div>
                )}
                {toast.type === "error" && (
                  <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                    <AlertCircle size={15} />
                  </div>
                )}
                {toast.type === "info" && (
                  <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                    <Info size={15} />
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 pr-1 min-w-0">
                <div className="text-xs font-bold tracking-tight text-[var(--app-fg)] leading-tight">
                  {toast.title}
                </div>
                {toast.message && (
                  <div className="text-[11px] text-[var(--app-muted)] mt-1 leading-snug break-words">
                    {toast.message}
                  </div>
                )}
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="w-6 h-6 rounded-lg border border-[var(--app-border-subtle)] hover:border-[var(--app-border)] hover:bg-[var(--app-card-hover)] flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-all cursor-pointer opacity-70 group-hover:opacity-100 flex-shrink-0 active:scale-95"
                aria-label="Dismiss notification"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
