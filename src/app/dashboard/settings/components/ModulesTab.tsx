"use client";

import React from "react";
import { MODULE_KEYS, MODULE_DISPLAY_LABELS } from "@/lib/modules";

interface ModulesTabProps {
  enabledModules: string[];
  toggleModule: (module: string) => void;
}

export default function ModulesTab({ enabledModules, toggleModule }: ModulesTabProps) {
  const MODULE_METADATA: Record<string, { icon: string; desc: string; category: string }> = {
    "Income & Expenses": { icon: "💰", desc: "Track daily revenue, recurring debits, and cash flow", category: "Core Cashflow" },
    "Budget": { icon: "📊", desc: "Set spending limits and receive over-budget alerts", category: "Planning" },
    "Investments": { icon: "📈", desc: "Manage Stocks, Mutual Funds, Bonds, FnO & Forex portfolios", category: "Wealth" },
    "Alt Assets": { icon: "🏢", desc: "Track Real Estate, Gold, Startup equity, & Collectibles", category: "Wealth" },
    "Liabilities": { icon: "💸", desc: "Monitor Loans, EMIs, Mortgages, and Outstanding Debt", category: "Debt" },
    "Goals": { icon: "🎯", desc: "Target savings milestones and track progress live", category: "Planning" },
    "Family Management": { icon: "👨‍👩‍👧‍👦", desc: "Coordinate household budgets, allowances, and member transfers", category: "Household" },
    "Ledger": { icon: "📑", desc: "Immutable audit trail of all balance adjustments", category: "Audit" },
  };

  const handleEnableAll = () => {
    MODULE_KEYS.forEach((mod) => {
      if (!enabledModules.includes(mod)) toggleModule(mod);
    });
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden bg-gradient-to-br from-cyan-950/20 via-slate-900/40 to-slate-950/80 border border-cyan-500/20 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 to-blue-600" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xl shadow-inner">
              🧩
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Module Architecture & Visibility</h2>
              <p className="text-xs text-[--text-muted]">Customize active workspace modules. Disabling hides sections from UI without deleting historical data.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnableAll}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            ⚡ Enable All Modules
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULE_KEYS.map((module) => {
            const displayLabel = MODULE_DISPLAY_LABELS[module];
            const isEnabled = enabledModules.includes(module);
            const meta = MODULE_METADATA[module] || { icon: "⚙️", desc: "Module feature section", category: "General" };

            return (
              <div
                key={module}
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-3 ${
                  isEnabled
                    ? "bg-white/[0.03] border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.08)]"
                    : "bg-black/20 border-white/5 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white">{displayLabel}</h3>
                        <span className="text-[0.5625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                          {meta.category}
                        </span>
                      </div>
                      <p className="text-[0.6875rem] text-[--text-muted] mt-1 leading-relaxed">{meta.desc}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleModule(module)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                      isEnabled ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-xs text-[--text-muted]">
          <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Disabling a module instantly updates your sidebar and dashboard widgets while preserving database integrity.</span>
        </div>
      </div>
    </div>
  );
}
