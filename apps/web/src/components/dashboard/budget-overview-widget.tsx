"use client";

import { motion } from "framer-motion";

import { Package, BarChart2 } from "lucide-react";

type CategoryItem = {
  name: string;
  spent: number;
  limit: number;
  icon?: React.ElementType;
};

type BudgetOverviewWidgetProps = {
  items?: CategoryItem[];
  showUSD?: boolean;
};

export default function BudgetOverviewWidget({ items = [], showUSD = false }: BudgetOverviewWidgetProps) {
  const symbol = showUSD ? "$" : "₹";

  const displayItems = items.length > 0 ? items.slice(0, 4) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner"><BarChart2 className="w-5 h-5 text-purple-400" /></div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Budget Overview</h3>
            <p className="text-xs text-[--text-muted]">Monthly spending vs category caps</p>
          </div>
        </div>
      </div>
      <div className="space-y-3.5">
        {displayItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-[--text-muted] italic bg-white/[0.01] rounded-2xl border border-white/5">
            No budget limits or category spending recorded for this month.
          </div>
        ) : (
          displayItems.map((cat) => {
            const hasLimit = cat.limit > 0;
            const pct = hasLimit ? Math.min(100, Math.round((cat.spent / cat.limit) * 100)) : 0;
            const isExceeded = hasLimit && cat.spent > cat.limit;
            const barColor = isExceeded
              ? "from-rose-500 to-red-600 text-rose-400"
              : pct >= 80
              ? "from-amber-400 to-yellow-500 text-amber-400"
              : "from-indigo-500 to-sky-400 text-sky-400";

            return (
              <div key={cat.name} className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white flex items-center gap-2">
                    {cat.icon ? (() => { const Icon = cat.icon; return <Icon className="w-4 h-4 text-gray-400" />; })() : <Package className="w-4 h-4 text-gray-400" />}
                    {cat.name}
                    {isExceeded ? (
                      <span className="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-black tracking-wider">
                        🚨 EXCEEDED CAP
                      </span>
                    ) : pct >= 80 ? (
                      <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-black tracking-wider">
                        ⚠️ 80%+ CAP ALERT
                      </span>
                    ) : null}
                  </span>
                  <span className={`font-extrabold ${barColor.split(" ").pop()}`}>
                    {hasLimit ? `${pct}%` : "No Cap"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                    style={{ width: hasLimit ? `${pct}%` : `${Math.min(100, (cat.spent / 10000) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-medium text-[--text-muted]">
                  <span>{symbol}{cat.spent.toLocaleString()} spent</span>
                  <span>{hasLimit ? `Limit: ${symbol}${cat.limit.toLocaleString()}` : "No limit set"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
