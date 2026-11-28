"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "arthax_privacy_mode";
const PRIVACY_EVENT = "arthax:privacy_mode_changed";

function applyPrivacyClass(masked: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("privacy-masked", masked);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = () => callback();
  window.addEventListener(PRIVACY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PRIVACY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Synchronized Privacy Mask state across Sidebar, TopNav, and CommandPalette.
 */
export function usePrivacyMode() {
  const isPrivacyMasked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyPrivacyClass(isPrivacyMasked);
  }, [isPrivacyMasked]);

  const togglePrivacyMask = useCallback((): boolean => {
    const next = !getSnapshot();
    applyPrivacyClass(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      } catch {}
      window.dispatchEvent(new CustomEvent(PRIVACY_EVENT, { detail: { masked: next } }));
    }
    return next;
  }, []);

  return { isPrivacyMasked, togglePrivacyMask };
}
