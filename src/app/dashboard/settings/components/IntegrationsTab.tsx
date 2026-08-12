"use client";

import React, { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-hot-toast";
import { updateSettings, generateTelegramLinkCode } from "../actions";
import type { FinanceData } from "@/hooks/use-finance-data";
import { Bot, Key, Send, AlertTriangle, ExternalLink } from "lucide-react";

interface IntegrationsTabProps {
  profile: FinanceData["profile"] | undefined;
  mutate: () => void;
}

export default function IntegrationsTab({
  profile,
  mutate,
}: IntegrationsTabProps) {
  const [showTelegramCommands, setShowTelegramCommands] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState((profile as any)?.gemini_api_key || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Zerodha BYOK state
  const [zerodhaApiKey, setZerodhaApiKey] = useState("");
  const [zerodhaApiSecret, setZerodhaApiSecret] = useState("");
  const [showZerodhaSecret, setShowZerodhaSecret] = useState(false);
  const [hasCustomZerodhaKeys, setHasCustomZerodhaKeys] = useState(false);
  const [activeZerodhaSource, setActiveZerodhaSource] = useState<string>("none");
  const [isSavingZerodha, setIsSavingZerodha] = useState(false);
  const [zerodhaEnabled, setZerodhaEnabled] = useState(true);

  const fetchZerodhaStatus = React.useCallback(() => {
    fetch("/api/integrations/zerodha/settings")
      .then((res) => res.json())
      .then((data) => {
        setZerodhaEnabled(data.enabled ?? true);
        setHasCustomZerodhaKeys(data.hasCustomKeys ?? false);
        setActiveZerodhaSource(data.activeSource || "none");
        if (data.userApiKey) {
          setZerodhaApiKey(data.userApiKey);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    fetchZerodhaStatus();
  }, [fetchZerodhaStatus]);

  const handleDisconnectTelegram = async () => {
    const res = await updateSettings({ telegram_chat_id: null });
    if (res.error) toast.error(res.error);
    else { toast.success("Telegram disconnected."); setShowDisconnectModal(false); mutate(); }
  };

  const telegramActive = !!profile?.telegram_chat_id;
  const geminiEnabled = (profile as any)?.gemini_enabled !== false;
  const hasGeminiKey = !!(profile as any)?.gemini_api_key;

  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile !== prevProfile) {
    setPrevProfile(profile);
    if (profile && (profile as any).gemini_api_key !== undefined) {
      setGeminiKeyInput((profile as any).gemini_api_key || "");
    }
  }

  const handleSaveZerodhaKeys = async () => {
    if (!zerodhaApiKey.trim() || !zerodhaApiSecret.trim()) {
      toast.error("Both API Key and API Secret are required.");
      return;
    }
    setIsSavingZerodha(true);
    try {
      const csrfToken = (await import("@/lib/csrf-client")).getClientCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const res = await fetch("/api/integrations/zerodha/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          apiKey: zerodhaApiKey,
          apiSecret: zerodhaApiSecret,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Custom Zerodha API keys saved successfully!");
        setZerodhaApiSecret("");
        fetchZerodhaStatus();
        mutate();
      } else {
        toast.error(data.error || "Failed to save Zerodha keys");
      }
    } catch {
      toast.error("Failed to update Zerodha settings");
    } finally {
      setIsSavingZerodha(false);
    }
  };

  const handleClearZerodhaKeys = async () => {
    setIsSavingZerodha(true);
    try {
      const csrfToken = (await import("@/lib/csrf-client")).getClientCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const res = await fetch("/api/integrations/zerodha/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "clear" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Cleared custom Zerodha keys. Reverted to system keys.");
        setZerodhaApiKey("");
        setZerodhaApiSecret("");
        fetchZerodhaStatus();
        mutate();
      } else {
        toast.error(data.error || "Failed to clear Zerodha keys");
      }
    } catch {
      toast.error("Failed to clear Zerodha settings");
    } finally {
      setIsSavingZerodha(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    setIsSavingGemini(true);
    try {
      const res = await updateSettings({ gemini_api_key: geminiKeyInput.trim() || null });
      if (res.error) toast.error(res.error);
      else {
        toast.success(geminiKeyInput.trim() ? "Gemini API key saved successfully!" : "Gemini API key cleared.");
        mutate();
      }
    } catch {
      toast.error("Failed to update Gemini API key");
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleToggleGemini = async () => {
    const nextState = !geminiEnabled;
    try {
      const res = await updateSettings({ gemini_enabled: nextState });
      if (res.error) toast.error(res.error);
      else {
        toast.success(nextState ? "Gemini AI enabled project-wide!" : "Gemini AI turned OFF. System using rule-based fallback.");
        mutate();
      }
    } catch {
      toast.error("Failed to toggle Gemini AI");
    }
  };

  return (
    <div className="max-w-4xl animate-fade-in space-y-5">
      {/* Grid Layout of Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ─── 1. Google Gemini AI Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#121620] p-5 flex flex-col justify-between hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner">
                  <Bot className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Google Gemini AI
                  </h3>
                  <span className="text-[0.625rem] text-purple-400 font-bold uppercase tracking-wider">Gemini 2.5 Flash</span>
                </div>
              </div>

              {/* Enable / Disable Toggle Switch */}
              <button
                type="button"
                onClick={handleToggleGemini}
                className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                  geminiEnabled ? "bg-purple-600 justify-end" : "bg-gray-700 justify-start"
                }`}
                title={geminiEnabled ? "Click to Turn OFF Gemini AI" : "Click to Turn ON Gemini AI"}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Powers natural language parsing across dashboard & Telegram bot. If unconfigured or OFF, system falls back to rule-based parsing.
            </p>

            {/* API Key Box */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="gemini-key-input" className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400 shrink-0" /> Gemini API Key
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.6875rem] font-bold text-purple-400 hover:underline flex items-center gap-1"
                >
                  Get Free Key <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="gemini-key-input"
                    type={showApiKey ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-3 pr-12 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.6875rem] text-gray-400 hover:text-white cursor-pointer"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isSavingGemini}
                  onClick={handleSaveGeminiKey}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingGemini ? "..." : "Save"}
                </button>
              </div>

              <p className="text-[0.6875rem] text-gray-500">
                Status: {!geminiEnabled ? (
                  <span className="text-gray-400 font-bold">Turned OFF (Rule Fallback)</span>
                ) : hasGeminiKey ? (
                  <span className="text-emerald-400 font-bold">Configured & Ready</span>
                ) : (
                  <span className="text-amber-400 font-bold">Not Configured (Rule Fallback)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ─── 2. Telegram Bot Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#121620] p-5 flex flex-col justify-between hover:border-sky-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shadow-inner">
                  <Send className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Telegram Assistant</h3>
                  <span className="text-[0.625rem] text-sky-400 font-bold uppercase tracking-wider">Voice Notes • Bills • SMS</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider border ${
                telegramActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                {telegramActive ? "Connected" : "Disconnected"}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Log transactions via voice notes, bill photos, or SMS alerts. Get real-time report summaries via bot commands.
            </p>

            {telegramActive ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Bot Active
                    </p>
                    <p className="text-[0.6875rem] text-gray-400 mt-0.5">Chat ID: <code className="font-mono text-white">{profile?.telegram_chat_id}</code></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTelegramCommands(!showTelegramCommands)}
                    className="text-[0.6875rem] font-bold text-sky-400 hover:underline cursor-pointer"
                  >
                    {showTelegramCommands ? "Hide Commands" : "View Commands"}
                  </button>
                </div>

                {showTelegramCommands && (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 text-[0.6875rem]">
                    <p className="font-bold text-gray-300 uppercase tracking-wider">Bot Commands</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div><code className="text-sky-400">/balance</code> <span className="text-gray-400">— Net Worth</span></div>
                      <div><code className="text-emerald-400">/summary</code> <span className="text-gray-400">— Monthly</span></div>
                      <div><code className="text-purple-400">/recent</code> <span className="text-gray-400">— Last 5</span></div>
                      <div><code className="text-rose-400">/undo</code> <span className="text-gray-400">— Revert</span></div>
                    </div>
                  </div>
                )}
              </div>
            ) : profile?.telegram_link_code ? (
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-3">
                <div className="p-1 bg-white rounded-lg shrink-0">
                  <QRCode
                    value={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBOARD_bot"}?start=${profile.telegram_link_code}`}
                    size={64}
                    level="M"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-bold text-white">Scan QR or Click Below</p>
                  <a
                    href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBOARD_bot"}?start=${profile.telegram_link_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[0.6875rem] font-bold text-sky-400 underline"
                  >
                    Open Telegram Bot
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-end gap-2">
            {telegramActive ? (
              <button
                type="button"
                onClick={() => setShowDisconnectModal(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const res = await generateTelegramLinkCode();
                  if (res.error) toast.error(res.error);
                  else { toast.success("Link code generated!"); mutate(); }
                }}
                className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {profile?.telegram_link_code ? "Regenerate Code" : "Connect Telegram"}
              </button>
            )}
          </div>
        </div>

        {/* ─── 3. Zerodha Kite Connect (BYOK) Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#121620] p-5 flex flex-col justify-between hover:border-orange-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl col-span-1 md:col-span-2">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shadow-inner text-orange-400 font-bold text-lg">
                  K
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Zerodha Kite Connect (BYOK)
                  </h3>
                  <span className="text-[0.625rem] text-orange-400 font-bold uppercase tracking-wider">
                    Stock & Mutual Fund Portfolio Sync
                  </span>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider border ${
                hasCustomZerodhaKeys
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : activeZerodhaSource === "global"
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}>
                {hasCustomZerodhaKeys ? "Custom Key Active" : activeZerodhaSource === "global" ? "System Key Active" : "Not Configured"}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Connect your Zerodha account to import stock holdings and mutual funds directly into your dashboard portfolio.
            </p>

            {/* Help Note for Multi-User Zerodha Apps */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-1">
              <p className="font-semibold text-amber-200">💡 Why enter custom Zerodha keys (BYOK)?</p>
              <p className="text-amber-300/90 text-[11px]">
                Standard Zerodha personal API apps only allow the Zerodha User ID of the key creator to log in. If logging in displays <code className="bg-black/40 px-1 py-0.5 rounded text-amber-200 font-mono">The user is not enabled for the app</code>, enter your own free/personal Zerodha Kite API Key & Secret below.
              </p>
            </div>

            {/* API Key & Secret Input Form */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-orange-400 shrink-0" /> Zerodha API Credentials
                </label>
                <a
                  href="https://developers.kite.trade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.6875rem] font-bold text-orange-400 hover:underline flex items-center gap-1"
                >
                  Create Key at developers.kite.trade <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="zerodha-api-key-input" className="block text-[11px] text-gray-400 font-medium mb-1">API Key</label>
                  <input
                    id="zerodha-api-key-input"
                    type="text"
                    placeholder="e.g. 1a2b3c4d5e"
                    value={zerodhaApiKey}
                    onChange={(e) => setZerodhaApiKey(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="zerodha-api-secret-input" className="block text-[11px] text-gray-400 font-medium mb-1">API Secret</label>
                  <div className="relative">
                    <input
                      id="zerodha-api-secret-input"
                      type={showZerodhaSecret ? "text" : "password"}
                      placeholder="e.g. 9z8y7x6w5v..."
                      value={zerodhaApiSecret}
                      onChange={(e) => setZerodhaApiSecret(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-3 pr-12 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-orange-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowZerodhaSecret(!showZerodhaSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.6875rem] text-gray-400 hover:text-white cursor-pointer"
                    >
                      {showZerodhaSecret ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {hasCustomZerodhaKeys ? (
                  <button
                    type="button"
                    onClick={handleClearZerodhaKeys}
                    disabled={isSavingZerodha}
                    className="text-xs text-rose-400 hover:underline cursor-pointer font-medium"
                  >
                    Clear Custom Keys
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-500">
                    Status: <strong className="text-gray-400">{activeZerodhaSource === "global" ? "Using System Fallback Key" : "No Keys Set"}</strong>
                  </span>
                )}

                <button
                  type="button"
                  disabled={isSavingZerodha}
                  onClick={handleSaveZerodhaKeys}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingZerodha ? "Saving..." : "Save Zerodha Keys"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Telegram Custom Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-card rich-border p-6 rounded-2xl max-w-sm w-full space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Disconnect Telegram?</h3>
                <p className="text-xs text-[--text-muted]">Are you sure you want to disconnect Telegram bot sync?</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowDisconnectModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={handleDisconnectTelegram} className="btn-danger flex-1">Disconnect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
