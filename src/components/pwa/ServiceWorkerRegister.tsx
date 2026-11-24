"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register service worker after window load to preserve maximum LCP performance
    const handleLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for background updates
          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New update is available
                  window.dispatchEvent(new CustomEvent("arthax:pwa-update-available"));
                }
              });
            }
          });
        })
        .catch((error) => {
          if (process.env.NODE_ENV === "development") {
            console.log("[PWA] Service Worker registration note:", error);
          }
        });
    };

    window.addEventListener("load", handleLoad);

    // Capture PWA beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      window.dispatchEvent(new CustomEvent("arthax:pwa-installable"));
    };

    const handleAppInstalled = () => {
      (window as any).deferredPrompt = null;
      window.dispatchEvent(new CustomEvent("arthax:pwa-installed"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("load", handleLoad);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}
