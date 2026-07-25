"use client";

import { motion } from "framer-motion";
import BankLogo from "@/components/ui/bank-logo";

type MultiAccountSnapshotProps = { accounts?: any[]; showUSD?: boolean };

export default function MultiAccountSnapshot({ accounts = [], showUSD = false }: MultiAccountSnapshotProps) {
  const symbol = showUSD ? "$" : "₹";
  const defaultAccounts = [
    { id: "1", name: "HDFC Bank Salary", type: "bank", balance: 82000 },
    { id: "2", name: "SBI Savings", type: "bank", balance: 12000 },
    { id: "3", name: "ICICI Wealth", type: "bank", balance: 45000 },
    { id: "4", name: "Cash Wallet", type: "cash", balance: 5400 },
    { id: "5", name: "Paytm Wallet", type: "wallet", balance: 620 },
  ];
  const items = accounts.length > 0 ? accounts.slice(0, 5) : defaultAccounts;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="glass-card-static rich-border p-6 flex flex-col justify-between gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-lg shadow-inner">🏦</div>
          <div><h3 className="text-base font-bold text-white tracking-tight">Multi-Account Snapshot</h3><p className="text-xs text-[--text-muted]">Balances across connected banks & wallets</p></div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">{items.length} Linked</span>
      </div>
      <div className="space-y-2.5">
        {items.map((acc: any) => (
          <div key={acc.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center gap-3">
              <BankLogo bankName={acc.name || acc.bank_name} accountName={acc.name} type={acc.type} size={32} className="rounded-xl flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[180px]">{acc.name || acc.bank_name || "Account"}</span>
                <span className="text-[10px] font-medium text-[--text-muted] capitalize">{acc.type || "bank"}</span>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-black text-white tabular-nums">{symbol}{Number(acc.balance || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
