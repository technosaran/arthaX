import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";

export interface BinanceSettingsStatus {
  enabled: boolean;
  hasCustomKeys: boolean;
  userApiKey: string;
  isGlobalConfigured: boolean;
  activeSource: "user" | "global" | "none";
  configured: boolean;
}

export function useBinanceSettings() {
  const [status, setStatus] = useState<BinanceSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/binance/settings");
      if (res.ok) {
        const data = await res.json();
        setStatus({
          ...data,
          configured: data.hasCustomKeys || data.isGlobalConfigured,
        });
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCustomKeys = async (apiKey: string, apiSecret: string): Promise<boolean> => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Both Binance API Key and API Secret are required.");
      return false;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/integrations/binance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, action: "save" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save Binance API keys");
        return false;
      }

      toast.success(data.message || "Binance API keys saved successfully!");
      await fetchStatus();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to save Binance API keys");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const clearCustomKeys = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/integrations/binance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to clear Binance keys");
        return false;
      }

      toast.success(data.message || "Custom Binance keys cleared.");
      await fetchStatus();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to clear Binance keys");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const syncHoldings = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/integrations/binance/sync", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to sync Binance holdings");
        return { success: false, error: data.error };
      }

      toast.success(
        `Binance Sync Complete! ${data.syncedHoldingsCount ?? 0} balances synced (${data.createdCount ?? 0} new, ${data.updatedCount ?? 0} updated).`
      );
      return { success: true, data };
    } catch (err: any) {
      const msg = err.message || "Failed to sync Binance holdings";
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    status,
    loading,
    isSaving,
    isSyncing,
    fetchStatus,
    saveCustomKeys,
    clearCustomKeys,
    syncHoldings,
  };
}
