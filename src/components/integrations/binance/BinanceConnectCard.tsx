"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, AlertCircle, Key, X, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { mutate as globalMutate } from "swr";
import { useBinanceSettings } from "@/hooks/use-binance-settings";

export function BinanceConnectCard() {
  const { status, loading, isSaving, isSyncing, fetchStatus, saveCustomKeys, clearCustomKeys, syncHoldings } =
    useBinanceSettings();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Settings form state
  const [customApiKey, setCustomApiKey] = useState("");
  const [customApiSecret, setCustomApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Sync state when status loads
  useEffect(() => {
    if (status?.userApiKey) {
      setCustomApiKey(status.userApiKey);
    }
  }, [status?.userApiKey]);

  const handleOpenModal = () => {
    if (status?.userApiKey) {
      setCustomApiKey(status.userApiKey);
    }
    setCustomApiSecret("");
    setShowSecret(false);
    setShowSettingsModal(true);
  };

  if (!status && loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 animate-pulse h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-800" />
          <div className="space-y-2">
            <div className="h-4 w-36 bg-slate-800 rounded" />
            <div className="h-3 w-56 bg-slate-800/60 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!status || !status.enabled) {
    return null;
  }

  const handleSync = async () => {
    setSyncError(null);
    const res = await syncHoldings();

    if (res.success) {
      void globalMutate("finance_investments");
      void globalMutate("finance_summary");
      void globalMutate("finance_cashflow");
    } else if (res.error) {
      setSyncError(res.error);
    }
  };

  const handleSaveCustomKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await saveCustomKeys(customApiKey.trim(), customApiSecret.trim());
    if (success) {
      setShowSettingsModal(false);
      setSyncError(null);
      setCustomApiSecret("");
    }
  };

  const handleClearCustomKeys = async () => {
    const success = await clearCustomKeys();
    if (success) {
      setCustomApiKey("");
      setCustomApiSecret("");
      setShowSettingsModal(false);
      setSyncError(null);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-950/20 via-background to-background p-4 shadow-sm backdrop-blur-md transition-all hover:border-yellow-500/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/30 font-bold text-lg leading-none">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground">Binance Exchange Sync</h3>
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
                Directly import spot balances and crypto portfolio from Binance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {status.configured && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 font-medium text-white text-xs shadow-md transition-all hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Binance"}
              </button>
            )}

            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 font-medium text-yellow-300 text-xs transition-colors hover:bg-yellow-500/20 cursor-pointer"
              title="Configure Binance API Key"
            >
              <Key className="h-3.5 w-3.5 text-yellow-400" />
              <span>{status.hasCustomKeys ? "Manage API Key" : "Add Binance API Key"}</span>
            </button>
          </div>
        </div>

        {syncError && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300 text-xs animate-in fade-in duration-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Sync Error:</span> {syncError}. Check your credentials by clicking{" "}
              <button
                type="button"
                onClick={handleOpenModal}
                className="font-bold underline text-amber-200 hover:text-white cursor-pointer"
              >
                Manage API Key
              </button>.
            </div>
          </div>
        )}
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/30">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">Binance Read-Only API Key</h3>
                <p className="text-slate-400 text-xs">Connect your Binance spot wallet securely</p>
              </div>
            </div>

            <form onSubmit={handleSaveCustomKeys} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Binance API Key</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. vmPU2v483n..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Binance API Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    required
                    placeholder="e.g. nhKw4v..."
                    value={customApiSecret}
                    onChange={(e) => setCustomApiSecret(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-3 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:border-yellow-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
                🔒 <strong className="text-slate-300">Read-Only Permission Required:</strong> Generate a Read-Only API key in your Binance Account Settings. Disable trade and withdrawal permissions for maximum security.
              </div>

              <div className="flex items-center justify-between pt-2">
                {status.hasCustomKeys ? (
                  <button
                    type="button"
                    onClick={handleClearCustomKeys}
                    disabled={isSaving}
                    className="text-xs text-red-400 hover:underline cursor-pointer"
                  >
                    Clear API Key
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !customApiKey.trim() || !customApiSecret.trim()}
                    className="rounded-lg bg-yellow-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-yellow-500 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save API Key"}
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
