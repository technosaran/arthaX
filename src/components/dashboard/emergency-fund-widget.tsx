"use client";

import { motion } from "framer-motion";

type EmergencyFundWidgetProps = {
  cashBalance: number;
  monthlySpend: number;
  showUSD?: boolean;
};

export default function EmergencyFundWidget({ cashBalance, monthlySpend, showUSD = false }: EmergencyFundWidgetProps) {
  const symbol = showUSD ? "$" : "₹";
  const monthlyBurn = monthlySpend > 0 ? monthlySpend : 45000;
  const targetFund = monthlyBurn * 6;
  const currentFund = Math.min(targetFund, cashBalance);
  const savedPct = Math.min(100, Math.round((currentFund / targetFund) * 100));
  const runwayMonths = (currentFund / monthlyBurn).toFixed(1);
  const neededAmount = Math.max(0, targetFund - currentFund);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-lg shadow-inner">
            🛡️
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Emergency Reserve</h3>
            <p className="text-xs text-[--text-muted]">6-Month financial safety runway</p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
          {runwayMonths} Mo Runway
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-[--text-secondary]">Reserve Readiness</span>
          <span className="text-teal-400 font-black">{savedPct}%</span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-700"
            style={{ width: `${savedPct}%` }}
          />
        </div>

        <div className="flex justify-between text-xs font-bold mt-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-[--text-muted]">Current Saved</span>
            <span className="text-white">{symbol}{currentFund.toLocaleString()}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-[--text-muted]">6-Mo Target</span>
            <span className="text-white">{symbol}{targetFund.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {neededAmount > 0 && (
        <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/15 flex items-center justify-between text-xs">
          <span className="text-[--text-muted]">Shortfall needed:</span>
          <span className="font-bold text-teal-400">{symbol}{neededAmount.toLocaleString()}</span>
        </div>
      )}
    </motion.div>
  );
}
