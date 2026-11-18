"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export type ToastFn = {
  (title: string, messageOrType?: string | ToastType, typeArg?: ToastType): void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

interface ToastContextType {
  showToast: ToastFn;
}

const isToastType = (val: unknown): val is ToastType =>
  val === "success" || val === "error" || val === "info" || val === "warning";

const defaultToastFn: ToastFn = Object.assign(
  (_title: string, _messageOrType?: string | ToastType, _typeArg?: ToastType) => {},
  {
    success: (_title: string, _message?: string) => {},
    error: (_title: string, _message?: string) => {},
    warning: (_title: string, _message?: string) => {},
    info: (_title: string, _message?: string) => {},
  }
);

const ToastContext = createContext<ToastContextType>({
  showToast: defaultToastFn,
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const baseShowToast = useCallback(
    (title: string, messageOrType?: string | ToastType, typeArg?: ToastType) => {
      let resolvedType: ToastType = "success";
      let resolvedMessage: string | undefined = undefined;

      if (isToastType(messageOrType)) {
        // Called like: showToast("Goal saved", "success")
        resolvedType = messageOrType;
        resolvedMessage = undefined;
      } else {
        // Called like: showToast("Invalid Input", "Please enter valid title", "error")
        resolvedMessage = messageOrType;
        if (typeArg && isToastType(typeArg)) {
          resolvedType = typeArg;
        }
      }

      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => {
        // Keep at most 5 recent toasts to avoid layout clutter
        const next = [...prev, { id, title, message: resolvedMessage, type: resolvedType }];
        return next.length > 5 ? next.slice(next.length - 5) : next;
      });

      // Auto dismiss: give errors/warnings a bit more time to be read
      const duration = resolvedType === "error" || resolvedType === "warning" ? 4800 : 3800;
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const showToast: ToastFn = useMemo(() => {
    return Object.assign(
      (title: string, messageOrType?: string | ToastType, typeArg?: ToastType) =>
        baseShowToast(title, messageOrType, typeArg),
      {
        success: (title: string, message?: string) => baseShowToast(title, message, "success"),
        error: (title: string, message?: string) => baseShowToast(title, message, "error"),
        warning: (title: string, message?: string) => baseShowToast(title, message, "warning"),
        info: (title: string, message?: string) => baseShowToast(title, message, "info"),
      }
    );
  }, [baseShowToast]);

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
                {toast.type === "warning" && (
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                    <AlertTriangle size={15} />
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
