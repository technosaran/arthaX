"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { Download, Check, Sparkles } from "lucide-react";
import { toast } from "react-hot-toast";

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    mql.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function getStandaloneServerSnapshot() {
  return false;
}

export default function PWAInstallPrompt() {
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => { /* Service Worker registered */ })
        .catch((err) => console.error("Service Worker registration failed:", err));
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setJustInstalled(true);
      setDeferredPrompt(null);
      toast.success("FinanceOS installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isInstalled = isStandalone || justInstalled;

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast("To install: Click browser menu (⋮ or ⬆️) -> 'Install App' or 'Add to Home Screen'");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setJustInstalled(true);
      toast.success("Installing FinanceOS...");
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
        <Check className="w-4 h-4" />
        <span>App Installed</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstallClick}
      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 text-white text-xs font-bold shadow-lg hover:shadow-indigo-500/25 hover:scale-105 transition-all duration-300 active:scale-95 cursor-pointer"
      title="Install FinanceOS as a native standalone app"
    >
      <Download className="w-4 h-4" />
      <span>Install App</span>
      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
    </button>
  );
}
