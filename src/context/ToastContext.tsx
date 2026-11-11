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

      // Auto dismiss after 3.5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Popup Notifications Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-3 rounded-xl p-4 border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
                color: "var(--app-fg)",
              }}
            >
              {/* Status Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {toast.type === "success" && (
                  <CheckCircle2 size={17} className="text-emerald-400" />
                )}
                {toast.type === "error" && (
                  <AlertCircle size={17} className="text-red-400" />
                )}
                {toast.type === "info" && (
                  <Info size={17} className="text-cyan-400" />
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 pr-2">
                <div className="text-xs font-bold leading-tight">
                  {toast.title}
                </div>
                {toast.message && (
                  <div className="text-[11px] opacity-70 mt-1 leading-snug">
                    {toast.message}
                  </div>
                )}
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
