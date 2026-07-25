"use client";

import { motion } from "framer-motion";

type SubscriptionItem = {
  id: string;
  name: string;
  cost: number;
  cycle: string;
  icon: string;
};

type SubscriptionTrackerProps = {
  showUSD?: boolean;
};

export default function SubscriptionTracker({ showUSD = false }: SubscriptionTrackerProps) {
  const symbol = showUSD ? "$" : "₹";

  const subscriptions: SubscriptionItem[] = [
    { id: "1", name: "Netflix Premium", cost: 649, cycle: "Monthly", icon: "🍿" },
    { id: "2", name: "Spotify Family", cost: 179, cycle: "Monthly", icon: "🎵" },
    { id: "3", name: "ChatGPT Plus", cost: 1999, cycle: "Monthly", icon: "🤖" },
    { id: "4", name: "Amazon Prime", cost: 299, cycle: "Monthly", icon: "📦" },
  ];

  const totalMonthlyCost = subscriptions.reduce((sum, s) => sum + s.cost, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-lg shadow-inner">
            📱
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Active Subscriptions</h3>
            <p className="text-xs text-[--text-muted]">Recurring app & service charges</p>
          </div>
        </div>

        <span className="text-xs font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
          {symbol}{totalMonthlyCost.toLocaleString()}/mo
        </span>
      </div>

      <div className="space-y-2">
        {subscriptions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5"
          >
            <div className="flex items-center gap-3">
              <span className="text-base p-1.5 rounded-xl bg-white/5">{s.icon}</span>
              <span className="text-xs font-bold text-white">{s.name}</span>
            </div>

            <span className="text-xs font-black text-white tabular-nums">
              {symbol}{s.cost.toLocaleString()}/mo
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
