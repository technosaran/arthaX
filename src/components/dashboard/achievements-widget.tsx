"use client";

import { motion } from "framer-motion";

type AchievementItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  unlocked: boolean;
};

export default function AchievementsWidget() {
  const achievements: AchievementItem[] = [
    { id: "1", title: "Saved ₹1,00,000", subtitle: "Milestone Reached", icon: "🏆", unlocked: true },
    { id: "2", title: "100-Day Streak", subtitle: "Budget Discipline", icon: "🔥", unlocked: true },
    { id: "3", title: "Debt Reduced", subtitle: "Paid down loans", icon: "🛡️", unlocked: true },
    { id: "4", title: "Investor Badge", subtitle: "SIP active", icon: "⭐", unlocked: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg shadow-inner">
            🏆
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Milestones & Streaks</h3>
            <p className="text-xs text-[--text-muted]">Financial discipline achievements</p>
          </div>
        </div>

        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          4 Unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {achievements.map((a) => (
          <div
            key={a.id}
            className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3 hover:border-amber-500/20 hover:bg-white/[0.04] transition-all"
          >
            <span className="text-2xl p-2 rounded-xl bg-white/5">{a.icon}</span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate">{a.title}</span>
              <span className="text-[10px] font-medium text-amber-400">{a.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
