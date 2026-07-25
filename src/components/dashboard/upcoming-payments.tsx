"use client";

import { motion } from "framer-motion";

type UpcomingPaymentsProps = { liabilities?: any[]; showUSD?: boolean };

export default function UpcomingPayments({ liabilities = [], showUSD = false }: UpcomingPaymentsProps) {
  const symbol = showUSD ? "$" : "₹";
  const defaultPayments = [
    { id: "1", name: "Electricity Bill", dueDate: "28 Jul", amount: 2450, icon: "⚡" },
    { id: "2", name: "SBI Credit Card", dueDate: "29 Jul", amount: 14200, icon: "💳" },
    { id: "3", name: "Netflix", dueDate: "31 Jul", amount: 649, icon: "🎬" },
    { id: "4", name: "Home Loan EMI", dueDate: "2 Aug", amount: 24500, icon: "🏠" },
  ];
  const payments = liabilities.length > 0
    ? liabilities.slice(0, 4).map((l: any, i: number) => ({ id: l.id || String(i), name: l.name || l.lender_name || "EMI", dueDate: l.due_date || `${28+i} Jul`, amount: Number(l.minimum_payment || l.emi_amount || 5000), icon: l.type === "credit_card" ? "💳" : "🏠" }))
    : defaultPayments;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg shadow-inner">📅</div>
          <div><h3 className="text-base font-bold text-white tracking-tight">Upcoming Payments</h3><p className="text-xs text-[--text-muted]">Bills, EMIs & subscriptions due soon</p></div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{payments.length} Due</span>
      </div>
      <div className="space-y-2.5">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-amber-500/20 transition-all">
            <div className="flex items-center gap-3">
              <span className="text-lg p-2 rounded-xl bg-white/5">{p.icon}</span>
              <div className="flex flex-col"><span className="text-xs font-bold text-white">{p.name}</span><span className="text-[11px] font-medium text-amber-400">Due {p.dueDate}</span></div>
            </div>
            <span className="text-xs sm:text-sm font-black text-white tabular-nums">-{symbol}{p.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
