"use client";

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { getClientCsrfToken } from "@/lib/csrf-client";

export interface ZerodhaStatus {
  enabled: boolean;
  configured: boolean;
  activeSource?: string;
  hasCustomKeys?: boolean;
  userApiKey?: string;
}

export function useZerodhaSettings() {
  const [status, setStatus] = useState<ZerodhaStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch("/api/integrations/zerodha/settings")
      .then((res) => res.json())
      .then((data) => {
        setStatus({
          enabled: data.enabled ?? false,
          configured: data.activeSource !== "none",
          activeSource: data.activeSource,
          hasCustomKeys: data.hasCustomKeys,
          userApiKey: data.userApiKey,
        });
      })
      .catch(() => setStatus({ enabled: false, configured: false }));
  }, []);

  const saveCustomKeys = useCallback(async (apiKey: string, apiSecret: string): Promise<boolean> => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Both API Key and API Secret are required.");
      return false;
    }
    setIsSaving(true);
    try {
      const csrfToken = getClientCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const res = await fetch("/api/integrations/zerodha/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ apiKey, apiSecret }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Custom Zerodha API keys saved!");
        fetchStatus();
        return true;
      } else {
        toast.error(data.error || "Failed to save keys");
        return false;
      }
    } catch {
      toast.error("Failed to update Zerodha settings.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetchStatus]);

  const clearCustomKeys = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const csrfToken = getClientCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const res = await fetch("/api/integrations/zerodha/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "clear" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Cleared custom keys. Reverted to system keys.");
        fetchStatus();
        return true;
      } else {
        toast.error(data.error || "Failed to clear keys");
        return false;
      }
    } catch {
      toast.error("Failed to clear settings.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fetchStatus]);

  return {
    status,
    isSaving,
    fetchStatus,
    saveCustomKeys,
    clearCustomKeys,
  };
}
