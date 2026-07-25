"use client";

import { motion } from "framer-motion";
import type { PortfolioAnalytics } from "@/lib/portfolio-analytics";

type Props = { analytics: PortfolioAnalytics; showUSD?: boolean };

export default function PortfolioPerformanceCard({ analytics, showUSD = false }: Props) {
  const { todayPnL, todayPnLPct, totalGain, totalGainPct, xirrPct, bestPerformerName, bestPerformerGainPct, worstPerformerName, worstPerformerGainPct } = analytics;
  const symbol = showUSD ? "$" : "₹";

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5 relative overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shadow-inner">📈</div>
          <div><h3 className="text-base font-bold text-white tracking-tight">Portfolio Performance</h3><p className="text-xs text-[--text-muted]">Return analytics & asset leaders</p></div>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">XIRR {xirrPct.toFixed(1)}%</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[--text-muted]">Today&apos;s P/L</span>
          <span className={`text-sm font-black ${todayPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{todayPnL >= 0 ? "+" : ""}{symbol}{Math.abs(todayPnL).toLocaleString()}</span>
          <span className="text-[10px] font-bold text-[--text-muted]">({todayPnLPct >= 0 ? "+" : ""}{todayPnLPct.toFixed(2)}%)</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[--text-muted]">Total Gain</span>
          <span className="text-sm font-black text-emerald-400">+{symbol}{totalGain.toLocaleString()}</span>
          <span className="text-[10px] font-bold text-[--text-muted]">(+{totalGainPct.toFixed(1)}%)</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[--text-muted]">Annual XIRR</span>
          <span className="text-sm font-black text-purple-400">{xirrPct.toFixed(1)}%</span>
          <span className="text-[10px] font-bold text-[--text-muted]">Annualized</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between">
          <div className="flex flex-col"><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Best</span><span className="text-xs font-black text-white truncate max-w-[100px]">{bestPerformerName}</span></div>
          <span className="text-xs font-black text-emerald-400">+{bestPerformerGainPct.toFixed(1)}%</span>
        </div>
        <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/15 flex items-center justify-between">
          <div className="flex flex-col"><span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Worst</span><span className="text-xs font-black text-white truncate max-w-[100px]">{worstPerformerName}</span></div>
          <span className="text-xs font-black text-rose-400">{worstPerformerGainPct.toFixed(1)}%</span>
        </div>
      </div>
    </motion.div>
  );
}
