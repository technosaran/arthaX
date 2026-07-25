"use client";

import { motion } from "framer-motion";

type GoalsOverviewWidgetProps = { goals?: any[]; showUSD?: boolean };

export default function GoalsOverviewWidget({ goals = [], showUSD = false }: GoalsOverviewWidgetProps) {
  const symbol = showUSD ? "$" : "₹";
  const defaultGoals = [
    { id: "1", name: "Emergency Fund", current_amount: 320000, target_amount: 500000, category: "emergency", icon: "🛡️", color: "from-emerald-500 to-teal-400" },
    { id: "2", name: "New Car", current_amount: 180000, target_amount: 400000, category: "car", icon: "🚗", color: "from-sky-500 to-indigo-400" },
    { id: "3", name: "Vacation Fund", current_amount: 85000, target_amount: 150000, category: "vacation", icon: "🏖️", color: "from-amber-400 to-orange-500" },
    { id: "4", name: "House Downpayment", current_amount: 650000, target_amount: 2000000, category: "house", icon: "🏠", color: "from-purple-500 to-pink-500" },
  ];
  const items = goals.length > 0
    ? goals.slice(0, 4).map((g: any, idx: number) => ({
        id: g.id || String(idx), name: g.name || g.title || "Goal",
        current_amount: Number(g.current_amount || 0), target_amount: Math.max(1, Number(g.target_amount || 100000)),
        icon: g.category === "emergency" ? "🛡️" : g.category === "car" ? "🚗" : g.category === "house" ? "🏠" : "🎯",
        color: "from-indigo-500 to-sky-400",
      }))
    : defaultGoals;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shadow-inner">🎯</div>
          <div><h3 className="text-base font-bold text-white tracking-tight">Goal Progress</h3><p className="text-xs text-[--text-muted]">Financial targets & progress</p></div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{items.length} Active</span>
      </div>
      <div className="space-y-3.5">
        {items.map((item: any) => {
          const pct = Math.min(100, Math.round((item.current_amount / item.target_amount) * 100));
          return (
            <div key={item.id} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white flex items-center gap-2"><span>{item.icon}</span>{item.name}</span>
                <span className="text-emerald-400 font-extrabold">{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] font-medium text-[--text-muted]">
                <span>{symbol}{item.current_amount.toLocaleString()} saved</span>
                <span>Target: {symbol}{item.target_amount.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
