"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastThemeConfig {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  progressBar: string;
  glowColor: string;
  borderColor: string;
}

export const getToastDuration = (type: ToastType): number => {
  return type === "error" || type === "warning" ? 4800 : 3800;
};

export const getToastThemeConfig = (type: ToastType): ToastThemeConfig => {
  switch (type) {
    case "error":
      return {
        badgeBg: "bg-rose-500/15 dark:bg-rose-500/20",
        badgeBorder: "border-rose-500/30",
        badgeText: "text-rose-600 dark:text-rose-400",
        progressBar: "bg-rose-500",
        glowColor: "rgba(244, 63, 94, 0.16)",
        borderColor: "rgba(244, 63, 94, 0.28)",
      };
    case "warning":
      return {
        badgeBg: "bg-amber-500/15 dark:bg-amber-500/20",
        badgeBorder: "border-amber-500/30",
        badgeText: "text-amber-600 dark:text-amber-400",
        progressBar: "bg-amber-500",
        glowColor: "rgba(245, 158, 11, 0.16)",
        borderColor: "rgba(245, 158, 11, 0.28)",
      };
    case "info":
      return {
        badgeBg: "bg-sky-500/15 dark:bg-sky-500/20",
        badgeBorder: "border-sky-500/30",
        badgeText: "text-sky-600 dark:text-sky-400",
        progressBar: "bg-sky-500",
        glowColor: "rgba(14, 165, 233, 0.16)",
        borderColor: "rgba(14, 165, 233, 0.28)",
      };
    case "success":
    default:
      return {
        badgeBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
        badgeBorder: "border-emerald-500/30",
        badgeText: "text-emerald-600 dark:text-emerald-400",
        progressBar: "bg-emerald-500",
        glowColor: "rgba(16, 185, 129, 0.16)",
        borderColor: "rgba(16, 185, 129, 0.28)",
      };
  }
};

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
  (() => {}) as unknown as ToastFn,
  {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  }
);

const ToastContext = createContext<ToastContextType>({
  showToast: defaultToastFn,
});

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const duration = getToastDuration(toast.type);
  const theme = getToastThemeConfig(toast.type);
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  useEffect(() => {
    if (isHovered) return;

    startTimeRef.current = Date.now();
    const intervalTime = 30;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentRemaining = Math.max(0, remainingTimeRef.current - elapsed);
      const nextProgress = Math.max(0, (currentRemaining / duration) * 100);

      setProgress(nextProgress);

      if (currentRemaining <= 0) {
        clearInterval(timer);
        onDismiss(toast.id);
      }
    }, intervalTime);

    return () => {
      clearInterval(timer);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    };
  }, [isHovered, duration, onDismiss, toast.id]);

  return (
    <div
      role="alert"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="pointer-events-auto group relative w-full overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.01] animate-in fade-in slide-in-from-top-4 select-none"
      style={{
        backgroundColor: "var(--app-card-elevated)",
        borderColor: "var(--app-border)",
        color: "var(--app-fg)",
        boxShadow: `0 12px 32px -4px rgba(0, 0, 0, 0.25), 0 0 0 1px ${theme.borderColor}`,
        background: `radial-gradient(circle at top right, ${theme.glowColor} 0%, transparent 70%), var(--app-card-elevated)`,
      }}
    >
      <div className="flex items-start gap-3 p-3.5 sm:p-4">
        {/* Status Icon Badge */}
        <div className="mt-0.5 flex-shrink-0">
          <div
            className={`w-7 h-7 rounded-xl ${theme.badgeBg} border ${theme.badgeBorder} ${theme.badgeText} flex items-center justify-center transition-transform duration-200 group-hover:scale-110 shadow-sm`}
          >
            {toast.type === "success" && <CheckCircle2 size={16} strokeWidth={2.2} />}
            {toast.type === "error" && <AlertCircle size={16} strokeWidth={2.2} />}
            {toast.type === "warning" && <AlertTriangle size={16} strokeWidth={2.2} />}
            {toast.type === "info" && <Info size={16} strokeWidth={2.2} />}
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 pr-1 min-w-0">
          <div className="text-xs sm:text-sm font-semibold tracking-tight text-[var(--app-fg)] leading-snug">
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-[11px] sm:text-xs text-[var(--app-muted)] mt-1 leading-relaxed break-words">
              {toast.message}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="w-6 h-6 rounded-lg border border-[var(--app-border-subtle)] hover:border-[var(--app-border)] hover:bg-[var(--app-card-hover)] flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-all cursor-pointer opacity-70 group-hover:opacity-100 flex-shrink-0 active:scale-95"
          aria-label="Dismiss notification"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </div>

      {/* Micro Countdown Progress Bar */}
      <div className="h-[2px] w-full bg-[var(--app-border-subtle)] overflow-hidden">
        <div
          className={`h-full ${theme.progressBar} opacity-80 transition-[width] ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

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
        // Keep at most 4 recent toasts to avoid layout clutter
        const next = [...prev, { id, title, message: resolvedMessage, type: resolvedType }];
        return next.length > 4 ? next.slice(next.length - 4) : next;
      });
    },
    []
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

      {/* Floating Notifications Hub - Top Center */}
      <div
        className="fixed top-5 inset-x-0 mx-auto max-w-md w-[calc(100%-2rem)] z-50 flex flex-col items-center gap-2.5 pointer-events-none px-2 sm:px-0"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
