"use client";

import { motion } from "framer-motion";

type BudgetOverviewWidgetProps = { pieData?: Array<{ name: string; value: number }>; showUSD?: boolean };

export default function BudgetOverviewWidget({ pieData = [], showUSD = false }: BudgetOverviewWidgetProps) {
  const symbol = showUSD ? "$" : "₹";
  const defaultCats = [
    { name: "Food & Dining", spent: 18500, limit: 25000, icon: "🍔" },
    { name: "Shopping", spent: 9600, limit: 30000, icon: "🛍️" },
    { name: "Travel & Fuel", spent: 14100, limit: 15000, icon: "✈️" },
    { name: "Entertainment", spent: 3600, limit: 20000, icon: "🍿" },
  ];
  const items = pieData.length > 0
    ? pieData.slice(0, 4).map((p) => ({ name: p.name, spent: p.value, limit: Math.max(p.value * 1.2, 10000), icon: p.name.toLowerCase().includes("food") ? "🍔" : p.name.toLowerCase().includes("shop") ? "🛍️" : "💳" }))
    : defaultCats;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-lg shadow-inner">📊</div>
          <div><h3 className="text-base font-bold text-white tracking-tight">Budget Overview</h3><p className="text-xs text-[--text-muted]">Monthly spending vs category caps</p></div>
        </div>
      </div>
      <div className="space-y-3.5">
        {items.map((cat) => {
          const pct = Math.min(100, Math.round((cat.spent / cat.limit) * 100));
          const barColor = pct >= 95 ? "from-rose-500 to-red-600 text-rose-400" : pct >= 80 ? "from-amber-400 to-yellow-500 text-amber-400" : "from-indigo-500 to-sky-400 text-sky-400";
          return (
            <div key={cat.name} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white flex items-center gap-2"><span>{cat.icon}</span>{cat.name}</span>
                <span className={`font-extrabold ${barColor.split(" ").pop()}`}>{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] font-medium text-[--text-muted]">
                <span>{symbol}{cat.spent.toLocaleString()} spent</span><span>Limit: {symbol}{cat.limit.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
