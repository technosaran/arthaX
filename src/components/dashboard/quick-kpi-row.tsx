"use client";

import { motion } from "framer-motion";

type QuickKpiRowProps = {
  netWorth: number;
  netWorthChangePct?: number;
  todayChange: number;
  todayChangePct?: number;
  monthlySavings: number;
  savingsRatePct?: number;
  investmentReturnPct?: number;
  cashAvailable: number;
  debtRatioPct?: number;
  showUSD?: boolean;
};

export default function QuickKpiRow({
  netWorth, netWorthChangePct = 4.2, todayChange, todayChangePct = 0.85,
  monthlySavings, savingsRatePct = 42, investmentReturnPct = 18.4,
  cashAvailable, debtRatioPct = 12, showUSD = false,
}: QuickKpiRowProps) {
  const symbol = showUSD ? "$" : "₹";

  const todaySign = todayChange >= 0 ? "+" : "-";
  const todayPctStr = `${todayChangePct >= 0 ? "+" : ""}${(todayChangePct || 0).toFixed(1)}%`;

  const kpis = [
    { 
      title: "Net Worth", 
      value: `${symbol}${netWorth.toLocaleString()}`, 
      badge: `Today: ${todaySign}${symbol}${Math.abs(todayChange).toLocaleString()} (${todayPctStr})`, 
      badgeColor: todayChange >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20", 
      icon: "💎" 
    },
    { title: "Today's Return", value: `${todayChange >= 0 ? "+" : ""}${symbol}${Math.abs(todayChange).toLocaleString()}`, badge: `${todayChangePct >= 0 ? "+" : ""}${(todayChangePct || 0).toFixed(2)}%`, badgeColor: todayChange >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20", icon: "⚡" },
    { title: "Monthly Savings", value: `${symbol}${monthlySavings.toLocaleString()}`, badge: `${savingsRatePct.toFixed(0)}% Rate`, badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", icon: "🐖" },
    { title: "Investment Return", value: `+${investmentReturnPct.toFixed(1)}%`, badge: "XIRR Annualized", badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: "📈" },
    { title: "Cash Available", value: `${symbol}${cashAvailable.toLocaleString()}`, badge: "Liquid Balance", badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/20", icon: "💵" },
    { title: "Debt Ratio", value: `${debtRatioPct.toFixed(1)}%`, badge: debtRatioPct <= 20 ? "Low Risk" : "Moderate", badgeColor: debtRatioPct <= 20 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: "🛡️" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 animate-fade-in">
      {kpis.map((kpi, idx) => (
        <motion.div key={kpi.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: idx * 0.05 }} whileHover={{ y: -2 }}
          className="glass-card-static rich-border p-4 flex flex-col justify-between gap-3 relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[--text-muted] truncate uppercase tracking-wider">{kpi.title}</span>
            <span className="text-sm group-hover:scale-110 transition-transform">{kpi.icon}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-lg sm:text-xl font-black text-white tracking-tight tabular-nums truncate">{kpi.value}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border w-fit ${kpi.badgeColor}`}>{kpi.badge}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
