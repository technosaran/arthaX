"use client";

import React, { useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  variant?: "center" | "slide";
}

export function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  width,
  variant = "center" 
}: DrawerProps) {
  const mounted = useHasMounted();
  const contentRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isOpen, children]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  if (variant === "slide") {
    return (
      <div className="fixed inset-0 z-[200] transition-opacity duration-300 opacity-100 pointer-events-auto">
        <div 
          className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={`absolute top-0 right-0 h-[100dvh] w-full ${width || "max-w-md"} bg-[var(--bg-surface)] border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out translate-x-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]`}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-rose-500" />
          <div className="px-5 sm:px-6 py-4 border-b border-white/5 flex flex-col gap-0.5 shrink-0 relative z-10 bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[--text-muted] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-[--text-muted]">Data Entry / Actions</p>
          </div>
          <div ref={contentRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 relative z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Centered Modal Dialog (Default)
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
      onClick={onClose}
    >
        <div
          className={`w-full ${width || "max-w-xl md:max-w-2xl"} bg-[var(--bg-surface)] border border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-scale-in max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] relative z-10`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Top Accent Gradient */}
          <div className="h-[3px] w-full bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-500 shrink-0" />
          
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
            <div>
              <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
              <p className="text-[0.5625rem] font-bold uppercase tracking-[0.15em] text-[--text-muted]">
                Enter Details & Sync Wealth Ledger
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[--text-muted] hover:text-white transition-all active:scale-95"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Area */}
          <div ref={contentRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {children}
          </div>
        </div>
    </div>
  );
}

