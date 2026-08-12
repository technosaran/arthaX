"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { RefreshCw, ExternalLink, ShieldCheck, AlertCircle, Key, X, AlertTriangle } from "lucide-react";
import { getClientCsrfToken } from "@/lib/csrf-client";

export function ZerodhaConnectCard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<{
    enabled: boolean;
    configured: boolean;
    activeSource?: string;
    hasCustomKeys?: boolean;
    userApiKey?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Settings form state
  const [customApiKey, setCustomApiKey] = useState("");
  const [customApiSecret, setCustomApiSecret] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchStatus = () => {
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
        if (data.userApiKey) {
          setCustomApiKey(data.userApiKey);
        }
      })
      .catch(() => setStatus({ enabled: false, configured: false }));
  };

  useEffect(() => {
    fetchStatus();

    // Handle OAuth Callback Toast Notifications
    const syncSuccess = searchParams.get("zerodha_sync");
    const count = searchParams.get("count");
    const stocksCount = searchParams.get("stocks");
    const mfsCount = searchParams.get("mfs");
    const created = searchParams.get("created");
    const updated = searchParams.get("updated");
    const errorParam = searchParams.get("zerodha_error");

    if (syncSuccess === "success") {
      setSyncError(null);
      const detailStr = stocksCount || mfsCount ? ` (${stocksCount ?? 0} Stocks, ${mfsCount ?? 0} Mutual Funds)` : "";
      toast.success(
        `Zerodha Sync Complete! ${count ?? 0} holdings synced${detailStr}.`,
        { duration: 6000 }
      );
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      router.refresh();
    } else if (errorParam) {
      let friendlyErr = "Zerodha authentication failed.";
      if (errorParam === "cancelled") {
        friendlyErr = "Zerodha login was cancelled.";
      } else if (errorParam === "missing_keys") {
        friendlyErr = "Default system API keys missing.";
      } else if (errorParam === "disabled") {
        friendlyErr = "Zerodha integration is currently disabled.";
      } else {
        friendlyErr = decodeURIComponent(errorParam);
      }

      setSyncError(friendlyErr);
      toast.error(`Sync error: ${friendlyErr}`);

      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams, router]);

  if (!status || !status.enabled) {
    return null; // Unmounts if feature flag is disabled
  }

  const handleConnect = () => {
    setLoading(true);
    setSyncError(null);
    window.location.href = "/api/integrations/zerodha/login";
  };

  const handleSaveCustomKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const csrfToken = getClientCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const res = await fetch("/api/integrations/zerodha/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          apiKey: customApiKey,
          apiSecret: customApiSecret,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Saved custom Zerodha API keys!");
        setShowSettingsModal(false);
        setSyncError(null);
        setCustomApiSecret("");
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to save keys");
      }
    } catch {
      toast.error("Failed to update Zerodha settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearCustomKeys = async () => {
    setSavingSettings(true);
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
        setCustomApiKey("");
        setCustomApiSecret("");
        setShowSettingsModal(false);
        setSyncError(null);
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to clear keys");
      }
    } catch {
      toast.error("Failed to clear settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Always show BYOK button so any user can configure or manage custom keys
  const showByokButton = true;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-950/20 via-background to-background p-4 shadow-sm backdrop-blur-md transition-all hover:border-orange-500/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/30">
              <span className="font-bold text-lg leading-none">K</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground">Zerodha Kite Sync</h3>
                {status.configured && !syncError ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400 text-xs ring-1 ring-emerald-500/20">
                    <ShieldCheck className="h-3 w-3" />{" "}
                    {status.activeSource === "user" ? "Custom Key Active" : "Ready"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-400 text-xs ring-1 ring-amber-500/20">
                    <AlertCircle className="h-3 w-3" /> Setup Needed
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Directly import your stock holdings into your dashboard.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {status.configured && (
              <button
                onClick={handleConnect}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white text-xs shadow-md transition-all hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Connecting..." : "Sync with Zerodha"}
              </button>
            )}

            {/* BYOK button is hidden by default and pops up if sync fails or setup is needed */}
            {showByokButton && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 font-medium text-orange-300 text-xs transition-colors hover:bg-orange-500/20"
                title="Use Your Own Zerodha Key (BYOK)"
              >
                <Key className="h-3.5 w-3.5 text-orange-400" />
                <span>{status.hasCustomKeys ? "Manage Custom Key" : "Use Your Own Key (BYOK)"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Error / Failure Banner informing user to use BYOK */}
        {syncError && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300 text-xs animate-in fade-in duration-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Sync Failed:</span> {syncError}. You can bypass system limits by clicking{" "}
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="font-bold underline text-amber-200 hover:text-white"
              >
                Use Your Own Key (BYOK)
              </button>.
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/30">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">Use Custom Zerodha Key (BYOK)</h3>
                <p className="text-slate-400 text-xs">Bypass system limits using your personal Zerodha app credentials</p>
              </div>
            </div>

            <form onSubmit={handleSaveCustomKeys} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Zerodha API Key</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1a2b3c4d5e"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Zerodha API Secret</label>
                <input
                  type="password"
                  required
                  placeholder="e.g. 9z8y7x6w5v..."
                  value={customApiSecret}
                  onChange={(e) => setCustomApiSecret(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
                💡 <strong className="text-slate-300">Free Personal App:</strong> Create a free app at{" "}
                <a href="https://developers.kite.trade" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">
                  developers.kite.trade
                </a>{" "}
                and paste your API key & secret above.
              </div>

              <div className="flex items-center justify-between pt-2">
                {status.hasCustomKeys ? (
                  <button
                    type="button"
                    onClick={handleClearCustomKeys}
                    disabled={savingSettings}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Clear Custom Key
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-50"
                  >
                    {savingSettings ? "Saving..." : "Save Custom Key"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
