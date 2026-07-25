"use client";

import { useEffect } from "react";

export default function PwaSecurityManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let refreshing = false;

    // Auto reload when a new service worker replaces the active worker
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

      const registerSw = () => {
        navigator.serviceWorker
          .register("/sw.js", { updateViaCache: "none" })
          .then((reg) => {
            reg.update();

            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (!newWorker) return;

              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                }
              });
            });
          })
          .catch((err) => {
            console.warn("Service Worker registration failed: ", err);
          });
      };

      if (document.readyState === "complete") {
        registerSw();
      } else {
        window.addEventListener("load", registerSw, { once: true });
      }
    }

    // Auto-reload recovery when Next.js fails to load dynamic script chunks on new deployment
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = "reason" in event ? (event as PromiseRejectionEvent).reason : (event as ErrorEvent).error;
      const message = error?.message || (event as ErrorEvent)?.message || "";

      const isChunkError =
        message.includes("Loading chunk") ||
        message.includes("ChunkLoadError") ||
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed");

      if (isChunkError) {
        const lastReload = sessionStorage.getItem("chunk_error_reload");
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem("chunk_error_reload", now.toString());
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
          }
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleChunkError);

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      }
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleChunkError);
    };
  }, []);

  return null;
}
