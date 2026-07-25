"use client";

import { motion } from "framer-motion";
import type { AssetClassItem } from "@/lib/portfolio-analytics";

type Props = { assetClasses: AssetClassItem[]; showUSD?: boolean };

export default function RichAssetBreakdown({ assetClasses = [], showUSD = false }: Props) {
  const symbol = showUSD ? "$" : "₹";

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5 lg:col-span-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg shadow-inner">🏛️</div>
          <div><h3 className="text-base font-bold text-white tracking-tight">Rich Asset Breakdown</h3><p className="text-xs text-[--text-muted]">Complete wealth distribution across 10 asset classes</p></div>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{assetClasses.filter((a) => a.value > 0).length} Active</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        {assetClasses.map((ac) => (
          <div key={ac.key} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-2.5 hover:border-indigo-500/30 hover:bg-white/[0.04] transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xl p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform">{ac.icon}</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5" style={{ color: ac.color }}>{ac.percentage}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-[--text-secondary] truncate group-hover:text-white transition-colors">{ac.name}</span>
              <span className="text-sm font-black text-white tabular-nums">{symbol}{ac.value.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
