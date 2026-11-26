"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, X, Share, PlusSquare, Smartphone, Sparkles, CheckCircle2 } from "lucide-react";
import Logo from "@/components/Logo";

export default function PwaInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check if already running in standalone PWA window
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check dismissal cooldown (7 days)
    const dismissedTime = localStorage.getItem("arthax_pwa_dismissed_at");
    if (dismissedTime) {
      const elapsed = Date.now() - parseInt(dismissedTime, 10);
      if (elapsed < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes("safari") && !ua.includes("crios") && !ua.includes("fxios");

    if (isIosDevice && isSafari) {
      setIsIos(true);
      // Give the user 4 seconds to view the page before surfacing install suggestion
      const timer = setTimeout(() => setShowBanner(true), 4000);
      return () => clearTimeout(timer);
    }

    // 4. Android / Chromium beforeinstallprompt listener
    const handleInstallable = () => {
      setShowBanner(true);
    };

    const handleInstalled = () => {
      setShowBanner(false);
      setIsInstalled(true);
    };

    window.addEventListener("arthax:pwa-installable", handleInstallable);
    window.addEventListener("arthax:pwa-installed", handleInstalled);

    if ((window as any).deferredPrompt) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("arthax:pwa-installable", handleInstallable);
      window.removeEventListener("arthax:pwa-installed", handleInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) {
      // Fallback: Show manual instruction
      setShowIosModal(true);
      return;
    }

    promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    if (choiceResult.outcome === "accepted") {
      setShowBanner(false);
      setIsInstalled(true);
    }
    (window as any).deferredPrompt = null;
  }, [isIos]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIosModal(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("arthax_pwa_dismissed_at", Date.now().toString());
    }
  }, []);

  if (isInstalled || (!showBanner && !showIosModal)) {
    return null;
  }

  return (
    <>
      {/* 1. Mobile PWA Install Floating Toast/Banner */}
      {showBanner && !showIosModal && (
        <aside
          aria-label="Install ArthaX Mobile App"
          className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-96 z-50 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300 transition-all select-none"
          style={{
            backgroundColor: "rgba(13, 15, 22, 0.94)",
            borderColor: "rgba(16, 185, 129, 0.35)",
            boxShadow: "0 16px 36px -8px rgba(0, 0, 0, 0.7), 0 0 24px -4px rgba(16, 185, 129, 0.2)",
            color: "#ffffff",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <Logo size={26} showText={false} />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-tight">ArthaX Web App</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  FAST & SECURE
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-2 leading-relaxed">
                Install to Home Screen for fullscreen view, instant offline access, and 0ms navigation.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-6 h-6 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors -mr-1 -mt-1"
              aria-label="Dismiss banner"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/10">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white cursor-pointer transition-colors"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-500/20"
            >
              <Download size={13} />
              <span>{isIos ? "Add to Home Screen" : "Install App"}</span>
            </button>
          </div>
        </aside>
      )}

      {/* 2. iOS Safari Step-by-Step Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-3xl border p-5 shadow-2xl relative select-none animate-in slide-in-from-bottom duration-200"
            style={{
              backgroundColor: "var(--app-card-elevated)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full border border-[var(--app-border)] flex items-center justify-center text-[var(--app-fg)] hover:bg-[var(--app-card-hover)] cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={14} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Logo size={28} showText={false} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Install ArthaX on iOS</h3>
                <p className="text-xs text-[var(--app-muted)]">Add to Home Screen in 2 steps</p>
              </div>
            </div>

            <div className="space-y-3 my-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)]">
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Share size={15} />
                </div>
                <div>
                  <div className="text-xs font-bold">1. Tap the Share button</div>
                  <div className="text-[11px] text-[var(--app-muted)] mt-0.5">
                    Found at the bottom toolbar of Safari on iPhone (or top right on iPad).
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border-subtle)]">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <PlusSquare size={15} />
                </div>
                <div>
                  <div className="text-xs font-bold">2. Tap &quot;Add to Home Screen&quot;</div>
                  <div className="text-[11px] text-[var(--app-muted)] mt-0.5">
                    Scroll down the share sheet and select the Add to Home Screen option.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white cursor-pointer transition-all active:scale-95"
            >
              Got it, let&apos;s go
            </button>
          </div>
        </div>
      )}
    </>
  );
}
