"use client";

import React, { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-hot-toast";
import { updateSettings, generateTelegramLinkCode } from "../actions";
import type { FinanceData } from "@/hooks/use-finance-data";

function isGmailLinked(profile: FinanceData["profile"] | undefined): boolean {
  if (!profile) return false;
  return !!(profile.is_gmail_linked || (profile as any).gmail_refresh_token);
}

interface IntegrationsTabProps {
  profile: FinanceData["profile"] | undefined;
  isGmailSyncing: boolean;
  handleGmailSync: () => Promise<void>;
  mutate: () => void;
}

export default function IntegrationsTab({
  profile,
  isGmailSyncing,
  handleGmailSync,
  mutate,
}: IntegrationsTabProps) {
  const [showTelegramCommands, setShowTelegramCommands] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState((profile as any)?.gemini_api_key || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);

  const gmailActive = isGmailLinked(profile);
  const telegramActive = !!profile?.telegram_chat_id;
  const geminiEnabled = (profile as any)?.gemini_enabled !== false;
  const hasGeminiKey = !!((profile as any)?.gemini_api_key || process.env.NEXT_PUBLIC_GEMINI_API_KEY);
  const isGeminiActive = geminiEnabled && hasGeminiKey;

  React.useEffect(() => {
    if (profile && (profile as any).gemini_api_key !== undefined) {
      setGeminiKeyInput((profile as any).gemini_api_key || "");
    }
  }, [profile]);

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
    <div className="max-w-4xl animate-fade-in space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-transparent border border-white/10 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-white tracking-wide flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm">⚡</span>
              Connected Integrations
            </h2>
            <p className="text-xs text-gray-400">
              Link external platforms to automate spending tracking & real-time AI ledger synchronization.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "Gmail", active: gmailActive },
              { label: "Telegram", active: telegramActive },
              { label: "Gemini AI", active: isGeminiActive },
            ].map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.625rem] font-bold uppercase tracking-wider border ${
                  s.active
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-white/5 border-white/10 text-gray-500"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.active ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
                {s.label}: {s.active ? "Active" : "Off"}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Layout of Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ─── 1. Google Gemini AI Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#151515] p-5 flex flex-col justify-between hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl md:col-span-2">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xl shadow-inner">
                  🤖
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Google Gemini AI Assistant
                    <span className="text-[0.625rem] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 font-extrabold uppercase">Project-Wide AI</span>
                  </h3>
                  <span className="text-[0.625rem] text-purple-400 font-bold uppercase tracking-wider">Gemini 2.5 Flash • Natural Language Parser</span>
                </div>
              </div>

              {/* Enable / Disable Toggle Switch */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400">
                  {!geminiEnabled ? "AI Turned OFF" : hasGeminiKey ? "AI Active & Ready" : "AI Enabled (Key Needed)"}
                </span>
                <button
                  type="button"
                  onClick={handleToggleGemini}
                  className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                    geminiEnabled ? "bg-purple-600 justify-end" : "bg-gray-700 justify-start"
                  }`}
                  title={geminiEnabled ? "Click to Turn OFF Gemini AI" : "Click to Turn ON Gemini AI"}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Powers intelligent natural language understanding across your dashboard and Telegram bot. If turned OFF or unconfigured, the system automatically uses standard rule-based parsing.
            </p>

            {/* API Key Box */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>🔑</span> Gemini API Key
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.6875rem] font-bold text-purple-400 hover:underline flex items-center gap-1"
                >
                  Get Free API Key ↗
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white cursor-pointer"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isSavingGemini}
                  onClick={handleSaveGeminiKey}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] cursor-pointer disabled:opacity-50"
                >
                  {isSavingGemini ? "Saving..." : "Save Key"}
                </button>
              </div>

              <p className="text-[0.6875rem] text-gray-500">
                Status: {!geminiEnabled ? (
                  <span className="text-gray-400 font-bold">Turned OFF (Using Rule-Based Fallback)</span>
                ) : hasGeminiKey ? (
                  <span className="text-emerald-400 font-bold">API Key Configured & Ready</span>
                ) : (
                  <span className="text-amber-400 font-bold">Not Configured (Using Rule-Based Fallback)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ─── 2. Gmail Auto-Sync Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#151515] p-5 flex flex-col justify-between hover:border-rose-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-xl shadow-inner">
                  ✉️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Gmail Auto-Sync</h3>
                  <span className="text-[0.625rem] text-rose-400 font-bold uppercase tracking-wider">OAuth 2.0 • Email Scanner</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[0.625rem] font-black uppercase tracking-wider border ${
                gmailActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                {gmailActive ? "Connected" : "Disconnected"}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Securely scan transaction alert emails in the background. Works seamlessly on iPhone, Android, and Desktop.
            </p>

            {gmailActive && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-white">Inbox Scanner</p>
                  <p className="text-[0.6875rem] text-gray-400">Scan recent unread alert emails</p>
                </div>
                <button
                  type="button"
                  disabled={isGmailSyncing}
                  onClick={handleGmailSync}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isGmailSyncing ? (
                    <span className="w-3 h-3 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  )}
                  Scan Now
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-end gap-2">
            {gmailActive ? (
              <>
                <button
                  type="button"
                  onClick={() => { window.location.href = "/api/auth/google"; }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
                >
                  Re-link
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Disconnect Gmail integration?")) return;
                    const res = await updateSettings({ gmail_refresh_token: null });
                    if (res.error) toast.error(res.error);
                    else { toast.success("Gmail disconnected."); mutate(); }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { window.location.href = "/api/auth/google"; }}
                className="w-full py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Connect Gmail
              </button>
            )}
          </div>
        </div>

        {/* ─── 3. Telegram Bot Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#151515] p-5 flex flex-col justify-between hover:border-sky-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-xl shadow-inner">
                  ✈️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Telegram Assistant</h3>
                  <span className="text-[0.625rem] text-sky-400 font-bold uppercase tracking-wider">Voice Notes • Bill OCR • SMS</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[0.625rem] font-black uppercase tracking-wider border ${
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
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5">
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
                    value={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBAORD_bot"}?start=${profile.telegram_link_code}`}
                    size={64}
                    level="M"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-bold text-white">Scan QR or Click Below</p>
                  <a
                    href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBAORD_bot"}?start=${profile.telegram_link_code}`}
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
                onClick={async () => {
                  if (!confirm("Disconnect Telegram bot sync?")) return;
                  const res = await updateSettings({ telegram_chat_id: null });
                  if (res.error) toast.error(res.error);
                  else { toast.success("Telegram disconnected."); mutate(); }
                }}
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
                className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {profile?.telegram_link_code ? "Regenerate Code" : "Connect Telegram"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
