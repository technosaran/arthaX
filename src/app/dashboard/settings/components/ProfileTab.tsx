"use client";

import React from "react";

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

export default function ProfileTab({
  input,
  username,
  isSyncing,
  lastSaved,
  handleChange,
  handleBlur,
  handleKeyDown,
}: ProfileTabProps) {
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
              <p className="text-xs text-[--text-muted]">Manage your profile display name and account settings</p>
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
          <label htmlFor="display-name-input" className="block text-xs font-black uppercase tracking-wider text-gray-300">
            Display Name
          </label>
          <input
            id="display-name-input"
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
    </div>
  );
}

