"use client";

import { motion } from "framer-motion";
import type { DecisionAnswers } from "@/lib/dashboard-intelligence";

export default function AIInsightsCard({ insights }: { insights: DecisionAnswers }) {
  const { insightsBullets, actionItemToday, isRicher, netWorthGrowthPct } = insights;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-card-static rich-border p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between gap-5 border border-sky-500/20 shadow-[0_10px_30px_rgba(14,165,233,0.08)]">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-lg shadow-inner">🤖</div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              AI Insights & Action Plan
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">Live</span>
            </h3>
            <p className="text-xs text-[--text-muted]">Actionable guidance generated for today</p>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          {isRicher ? `▲ +${netWorthGrowthPct.toFixed(1)}%` : `▼ ${netWorthGrowthPct.toFixed(1)}%`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insightsBullets.map((b) => (
          <div key={b.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-3 hover:bg-white/[0.04] transition-colors">
            <span className="text-base mt-0.5">{b.icon}</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-white leading-snug">{b.text}</span>
              {b.subtext && <span className="text-[11px] font-medium text-[--text-muted]">{b.subtext}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 flex items-center gap-3">
        <span className="text-xl">🎯</span>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Recommendation For Today</span>
          <span className="text-xs font-bold text-white">{actionItemToday}</span>
        </div>
      </div>
    </motion.div>
  );
}
