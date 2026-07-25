"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function FloatingQuickAction() {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { label: "Expense", href: "/dashboard/expenses?action=new", icon: "💸", color: "from-rose-500 to-pink-500" },
    { label: "Income", href: "/dashboard/income?action=new", icon: "💰", color: "from-emerald-500 to-teal-400" },
    { label: "Investment", href: "/dashboard/investments?action=new", icon: "📈", color: "from-sky-500 to-indigo-500" },
    { label: "Transfer", href: "/dashboard/accounts?action=transfer", icon: "🔄", color: "from-purple-500 to-violet-500" },
    { label: "Goal", href: "/dashboard/goals?action=new", icon: "🎯", color: "from-amber-400 to-orange-500" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-end gap-2 mb-2"
          >
            {actions.map((act, i) => (
              <Link
                key={act.label}
                href={act.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl hover:scale-105 transition-all text-xs font-bold text-white no-underline group`}
              >
                <span className="text-white group-hover:text-sky-400 transition-colors">{act.label}</span>
                <span className={`w-8 h-8 rounded-xl bg-gradient-to-r ${act.color} flex items-center justify-center text-sm shadow-md`}>
                  {act.icon}
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-400 text-white font-black text-2xl flex items-center justify-center shadow-[0_10px_35px_rgba(99,102,241,0.5)] hover:scale-110 active:scale-95 transition-all border border-white/20 cursor-pointer"
        aria-label="Quick Action"
      >
        <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          +
        </motion.span>
      </button>
    </div>
  );
}
