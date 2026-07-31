"use client";

import React, { useState } from "react";

interface ProfileTabProps {
  input: string;
  username: string;
  isSyncing: boolean;
  lastSaved: string | null;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  baseCurrency?: string;
  theme?: string;
  timezone?: string;
  onSaveSetting?: (key: string, value: unknown, msg: string) => void;
}

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST • UTC+5:30)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "America/New_York", label: "America/New_York (EST • UTC-5:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST • UTC-8:00)" },
  { value: "Europe/London", label: "Europe/London (GMT • UTC+0:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST • UTC+4:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT • UTC+8:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST • UTC+10:00)" },
];

export default function ProfileTab({
  input,
  username,
  isSyncing,
  lastSaved,
  handleChange,
  handleBlur,
  handleKeyDown,
  baseCurrency = "INR",
  theme = "dark",
  timezone = "Asia/Kolkata",
  onSaveSetting,
}: ProfileTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    onSaveSetting?.("base_currency", curr, `Base currency updated to ${curr}`);
  };

  const handleThemeChange = (th: string) => {
    setSelectedTheme(th);
    onSaveSetting?.("theme", th, `Theme set to ${th}`);
  };

  const handleTimezoneChange = (tz: string) => {
    setSelectedTimezone(tz);
    onSaveSetting?.("timezone", tz, `Timezone updated to ${tz}`);
  };

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Profile & Account Identity Card */}
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-slate-950/80 border border-indigo-500/20 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl shadow-inner">
              👤
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Account & Identity</h2>
              <p className="text-xs text-[--text-muted]">Manage your profile display name, base currency, and regional defaults</p>
            </div>
          </div>
          <div>
            {isSyncing ? (
              <div className="flex items-center gap-2 text-[0.625rem] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Syncing...</span>
              </div>
            ) : lastSaved ? (
              <div className="flex items-center gap-2 text-[0.625rem] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                <span>Saved {lastSaved}</span>
              </div>
            ) : (
              <span className="text-[0.625rem] font-black uppercase tracking-widest text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Auto-Saved
              </span>
            )}
          </div>
        </div>

        {/* User Initial Avatar Card */}
        <div className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.02] border border-white/10 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/25 border border-white/20 shrink-0">
            {input ? input.charAt(0).toUpperCase() : username ? username.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">{input || username || "FinanceOS User"}</h3>
              <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                Verified Account
              </span>
            </div>
            <p className="text-xs text-[--text-muted]">Real-time cloud database session active</p>
          </div>
        </div>

        {/* Display Name Input */}
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-wider text-gray-300">
            Display Name
          </label>
          <input
            type="text"
            value={input}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            maxLength={30}
            className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-gray-600 shadow-inner"
            placeholder="Enter your full name"
          />
          <p className="text-[0.6875rem] text-[--text-muted] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Press Enter or click away to save. Automatically synced to your dashboard header.
          </p>
        </div>
      </div>

      {/* Currency & Regional Preferences */}
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden bg-slate-900/50 border border-white/10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg">
            🌐
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Currency & Regional Preferences</h3>
            <p className="text-xs text-[--text-muted]">Configure default valuation currency and timezone display</p>
          </div>
        </div>

        {/* Currency Grid */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Base Reporting Currency
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CURRENCIES.map((curr) => {
              const isSelected = selectedCurrency === curr.code;
              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => handleCurrencyChange(curr.code)}
                  className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/10 border-cyan-500/50 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                      : "bg-white/[0.02] border-white/5 text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base select-none">{curr.flag}</span>
                    <div className="text-left">
                      <p className="text-xs font-black">{curr.code} ({curr.symbol})</p>
                      <p className="text-[0.625rem] text-gray-500 font-medium truncate max-w-[80px]">{curr.name}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timezone Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Default System Timezone
          </label>
          <select
            value={selectedTimezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-medium outline-none focus:border-cyan-500 transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-slate-900 text-white">
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Appearance & Theme Selection */}
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden bg-slate-900/50 border border-white/10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-lg">
            🎨
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Appearance Theme</h3>
            <p className="text-xs text-[--text-muted]">Choose your visual dashboard style</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: "dark", label: "Dark Obsidian", icon: "🌙", desc: "Sleek high-contrast dark theme" },
            { id: "light", label: "Light Crystal", icon: "☀️", desc: "Clean bright interface" },
            { id: "system", label: "System Default", icon: "💻", desc: "Follow OS system preference" },
          ].map((th) => {
            const isSelected = selectedTheme === th.id;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => handleThemeChange(th.id)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-purple-500/10 border-purple-500/50 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                    : "bg-white/[0.02] border-white/5 text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{th.icon}</span>
                  {isSelected && <span className="text-[0.625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Active</span>}
                </div>
                <p className="text-xs font-bold text-white">{th.label}</p>
                <p className="text-[0.6875rem] text-gray-500 mt-0.5">{th.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
