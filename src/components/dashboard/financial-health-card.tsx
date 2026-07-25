"use client";

import { motion } from "framer-motion";
import type { FinancialHealthResult } from "@/lib/financial-health-score";

type FinancialHealthCardProps = { healthData: FinancialHealthResult };

export default function FinancialHealthCard({ healthData }: FinancialHealthCardProps) {
  const { overallScore, tier, factors, aiSuggestions } = healthData;
  const tierColor = tier === "Excellent" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
    : tier === "Good" ? "text-sky-400 border-sky-500/20 bg-sky-500/10"
    : tier === "Fair" ? "text-amber-400 border-amber-500/20 bg-amber-500/10"
    : "text-rose-400 border-rose-500/20 bg-rose-500/10";

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg shadow-inner">⭐</div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Financial Health Score</h3>
            <p className="text-xs text-[--text-muted]">Composite index based on 6 core pillars</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${tierColor}`}>{tier}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="relative flex items-center justify-center w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path className="text-white/10" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path className="text-indigo-500 transition-all duration-1000" strokeDasharray={`${overallScore}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white tabular-nums">{overallScore}</span>
            <span className="text-[9px] font-bold text-[--text-muted] uppercase tracking-widest">/ 100</span>
          </div>
        </div>
        <div className="flex-1 w-full space-y-2">
          {factors.slice(0, 4).map((f) => (
            <div key={f.name} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[--text-secondary]">{f.name}</span>
                <span className="text-white font-bold">{f.score}/100</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-700" style={{ width: `${f.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5"><span>🤖</span> AI Financial Assessment</span>
        <ul className="space-y-1.5 text-xs text-[--text-secondary] list-disc list-inside leading-relaxed">
          {aiSuggestions.map((sug, i) => <li key={i}>{sug}</li>)}
        </ul>
      </div>
    </motion.div>
  );
}
