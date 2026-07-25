"use client";

import { motion } from "framer-motion";

type CreditScoreWidgetProps = {
  score?: number;
};

export default function CreditScoreWidget({ score = 785 }: CreditScoreWidgetProps) {
  const getRating = (s: number) => {
    if (s >= 750) return { label: "Excellent", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" };
    if (s >= 700) return { label: "Good", color: "text-sky-400 border-sky-500/20 bg-sky-500/10" };
    if (s >= 650) return { label: "Fair", color: "text-amber-400 border-amber-500/20 bg-amber-500/10" };
    return { label: "Needs Improvement", color: "text-rose-400 border-rose-500/20 bg-rose-500/10" };
  };

  const rating = getRating(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg shadow-inner">
            💳
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Credit Score</h3>
            <p className="text-xs text-[--text-muted]">CIBIL / Experian Credit Health</p>
          </div>
        </div>

        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${rating.color}`}>
          {rating.label}
        </span>
      </div>

      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex flex-col gap-0.5">
          <span className="text-3xl font-black text-white tracking-tight tabular-nums">{score}</span>
          <span className="text-[10px] font-bold text-[--text-muted]">300 - 900 Range</span>
        </div>

        <div className="flex flex-col gap-1.5 text-right text-xs">
          <span className="text-emerald-400 font-bold">✓ 100% On-time payments</span>
          <span className="text-emerald-400 font-bold">✓ Low credit utilization (&lt;15%)</span>
        </div>
      </div>
    </motion.div>
  );
}
