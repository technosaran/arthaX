"use client";

import { motion } from "framer-motion";

type SpendingHeatmapProps = {
  showUSD?: boolean;
};

export default function SpendingHeatmap({ showUSD = false }: SpendingHeatmapProps) {
  const symbol = showUSD ? "$" : "₹";

  const days = [
    { day: "Mon", spend: 1200, level: "low" },
    { day: "Tue", spend: 3400, level: "mid" },
    { day: "Wed", spend: 850, level: "low" },
    { day: "Thu", spend: 5200, level: "high" },
    { day: "Fri", spend: 2800, level: "mid" },
    { day: "Sat", spend: 6100, level: "high" },
    { day: "Sun", spend: 1900, level: "low" },
  ];

  const maxSpend = Math.max(...days.map((d) => d.spend));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg shadow-inner">
            🔥
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Weekly Spending Heatmap</h3>
            <p className="text-xs text-[--text-muted]">7-day daily spending intensity</p>
          </div>
        </div>

        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          This Week
        </span>
      </div>

      <div className="flex items-end justify-between gap-2 h-32 pt-4 px-2 bg-white/[0.01] rounded-2xl border border-white/5">
        {days.map((d) => {
          const heightPct = Math.max(15, Math.round((d.spend / maxSpend) * 100));
          const colorClass =
            d.level === "high"
              ? "from-rose-500 to-pink-500 text-rose-400"
              : d.level === "mid"
              ? "from-indigo-500 to-sky-400 text-indigo-400"
              : "from-emerald-500 to-teal-400 text-emerald-400";

          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
              <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                {symbol}{d.spend}
              </span>
              <div
                className={`w-full rounded-t-xl bg-gradient-to-t ${colorClass} transition-all duration-500 group-hover:brightness-125`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[11px] font-bold text-[--text-muted]">{d.day}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
