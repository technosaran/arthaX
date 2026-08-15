"use client";

import Link from "next/link";
import { format } from "date-fns";
import { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { getCanonicalEnabledModules } from "@/lib/modules";
import { TrendingUp, Landmark, LineChart, ShieldCheck, Banknote, FileText, Building2, Users, Sparkles, TrendingDown } from "lucide-react";


import { type DashboardStats } from "./DashboardDesktop";

type Props = {
  stats: DashboardStats;
  recentLogs: FinanceData["ledgerLogs"];
  accounts: FinanceData["accounts"];
  isLoading: boolean;
  isValidating: boolean;
};

const secondaryQuickActions = [
  { label: "Stock Trade", href: "/dashboard/stocks?action=new", icon: TrendingUp, color: "#3b82f6", desc: "Equities market", module: "Stocks" },
  { label: "Mutual Fund", href: "/dashboard/mutual-funds?action=new", icon: Landmark, color: "#a855f7", desc: "SIP & Lumpsum", module: "Mutual Funds" },
  { label: "FnO Trade", href: "/dashboard/fno?action=new", icon: LineChart, color: "#10b981", desc: "Derivatives", module: "FnO" },
  { label: "Bonds", href: "/dashboard/bonds?action=new", icon: ShieldCheck, color: "#eab308", desc: "Fixed income", module: "Bonds" },
  { label: "Forex", href: "/dashboard/forex?action=new", icon: Banknote, color: "#fbbf24", desc: "Currencies", module: "Forex" },
  { label: "Liability", href: "/dashboard/liabilities?action=new", icon: FileText, color: "#ec4899", desc: "Loans & EMIs", module: "Liabilities" },
  { label: "Alt Asset", href: "/dashboard/alternative-assets?action=new", icon: Building2, color: "#14b8a6", desc: "Gold & Property", module: "Alt Assets" },
  { label: "Family Send", href: "/dashboard/family?action=send", icon: Users, color: "#8b5cf6", desc: "Send to members", module: "Family Management" },
];

const DashboardMobile = memo(function DashboardMobile({ stats, recentLogs, accounts, isValidating }: Props) {
  const { data: { profile } = {} } = useFinanceData();
  const [showUSD, setShowUSD] = useState(false);
  
  const enabledModules = useMemo(() => {
    return getCanonicalEnabledModules(profile?.enabled_modules);
  }, [profile]);

  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };

  const filteredSecondaryActions = useMemo(() => {
    return secondaryQuickActions.filter(action => !action.module || enabledModules.includes(action.module));
  }, [enabledModules]);

  return (
    <div className="relative z-20 flex flex-col gap-5 animate-fade-in pb-16">
      
      {/* Console Header */}
      <div className="flex items-center justify-between pt-2 px-1">
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-[--accent-primary]">Console</span>
          <h2 className="text-lg font-black text-white tracking-tighter">Dashboard</h2>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 px-2.5 py-1 rounded-full">
          <span className={`w-1.5 h-1.5 rounded-full ${isValidating ? 'animate-pulse bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'}`} />
          <span className="text-xs font-semibold text-[--text-muted]">{isValidating ? "Syncing" : "Synced"}</span>
        </div>
      </div>

      {/* Portfolio Net Asset Value Card */}
      <div className="glass-card-static relative flex flex-col overflow-hidden border border-white/10 p-5 shadow-2xl rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950/80 to-slate-900/90 backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600" />
        <div className="absolute -right-16 -top-16 w-36 h-36 bg-[--accent-primary]/10 blur-3xl rounded-full" />
        <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />
        
        <div className="flex flex-col gap-4">
          {/* Net Worth (Flippable) */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <button 
                type="button"
                onClick={() => setShowUSD(!showUSD)}
                className="text-[0.6875rem] font-black uppercase tracking-wider text-[--text-muted] flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 active:scale-95 transition-all"
              >
                <span>{showUSD ? 'USD' : 'INR'} Net Worth</span>
                <span className="text-[0.625rem] font-bold text-sky-400 flex items-center gap-1">
                  ({showUSD ? 'USD $' : 'INR ₹'})
                  <svg className="w-2.5 h-2.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </span>
              </button>
              <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Live</span>
              </span>
            </div>
            
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.625rem] font-extrabold tracking-tight border backdrop-blur-md transition-all ${
                  (showUSD ? stats.totalDayPnLUSD : stats.totalDayPnLINR) >= 0 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.15)]' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                }`}>
                  <span>Today: {(showUSD ? stats.totalDayPnLUSD : stats.totalDayPnLINR) >= 0 ? "+" : "-"}</span>
                  <span>
                    {showUSD ? "$" : "₹"}{Math.abs(showUSD ? stats.totalDayPnLUSD : stats.totalDayPnLINR).toLocaleString(showUSD ? 'en-US' : 'en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </span>
                
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.625rem] font-extrabold tracking-tight border backdrop-blur-md transition-all ${
                  (showUSD ? (stats.totalGrowthUSD || 0) : (stats.totalGrowthINR || 0)) >= 0 
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                }`}>
                  <span>Growth: {(showUSD ? (stats.totalGrowthUSD || 0) : (stats.totalGrowthINR || 0)) >= 0 ? "+" : "-"}</span>
                  <span>
                    {showUSD ? "$" : "₹"}{Math.abs(showUSD ? (stats.totalGrowthUSD || 0) : (stats.totalGrowthINR || 0)).toLocaleString(showUSD ? 'en-US' : 'en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </span>
              </div>
              <h1 className="text-3xl font-[950] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-200 whitespace-nowrap">
                {showUSD ? "$" : "₹"}{(showUSD ? stats.netWorthUSD : stats.netWorthINR).toLocaleString(showUSD ? 'en-US' : 'en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </h1>
            </div>
          </div>
        </div>

        {/* Quick Month Cashflow Inflow vs Outflow */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
          <div>
            <span className="text-xs font-semibold text-[--text-muted] block mb-0.5">Month inflow</span>
            <span className="text-sm font-extrabold text-emerald-400">
              +₹{stats.monthlyIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <span className="text-[0.5625rem] font-black uppercase tracking-wider text-[--text-muted] block mb-0.5">Month Outflow</span>
            <span className="text-sm font-extrabold text-rose-400">
              -₹{stats.monthlySpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Fast Record actions */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Fast Logs</h3>
          <span className="text-[0.5625rem] text-[--text-muted] font-bold">Frequent entries</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {enabledModules.includes("Expenses") && (
            <Link 
              href="/dashboard/expenses?action=new" 
              prefetch={true}
              className="glass-card-static flex flex-col items-center justify-center p-3.5 rounded-2xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/15 active:scale-95 transition-all text-center no-underline"
            >
              <span className="text-2xl mb-1 filter drop-shadow-[0_4px_8px_rgba(239,68,68,0.25)]">🔴</span>
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">Expense</span>
            </Link>
          )}
          {enabledModules.includes("Income") && (
            <Link 
              href="/dashboard/income?action=new" 
              prefetch={true}
              className="glass-card-static flex flex-col items-center justify-center p-3.5 rounded-2xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 active:scale-95 transition-all text-center no-underline"
            >
              <span className="text-2xl mb-1 filter drop-shadow-[0_4px_8px_rgba(16,185,129,0.25)]">🟢</span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Income</span>
            </Link>
          )}
          <Link 
            href="/dashboard/accounts?action=transfer" 
            prefetch={true}
            className="glass-card-static flex flex-col items-center justify-center p-3.5 rounded-2xl bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/15 active:scale-95 transition-all text-center no-underline"
          >
            <span className="text-2xl mb-1 filter drop-shadow-[0_4px_8px_rgba(14,165,233,0.25)]">🔄</span>
            <span className="text-xs font-black uppercase tracking-wider text-sky-400">Transfer</span>
          </Link>
        </div>
      </div>

      {/* Assets & Trades registration */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Assets & Markets</h3>
          <span className="text-[0.5625rem] text-[--text-muted] font-bold">Investments</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredSecondaryActions.map((action) => (
            <Link 
              key={action.label} 
              href={action.href} 
              className="glass-card-static p-3 flex items-center gap-3 no-underline transition-all active:scale-[0.97] bg-white/[0.01] border border-white/5 shadow-sm rounded-2xl animate-fade-in"
              style={{ borderLeft: `3px solid ${action.color}40` }}
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[--text-secondary] shrink-0">
                <action.icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white tracking-tight leading-snug">{action.label}</span>
                <span className="text-[0.5625rem] text-[--text-muted] font-medium truncate w-full">{action.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Financial Pulse (Recent Logs feed) */}
      {enabledModules.includes("Ledger") && (
        <div className="flex flex-col gap-2.5 px-0.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Financial Pulse</h3>
            <Link href="/dashboard/ledger" className="text-[0.5625rem] font-black uppercase tracking-wider text-[--accent-primary] no-underline">Statement</Link>
          </div>
          <div className="space-y-2">
            {recentLogs.slice(0, 4).map((log) => {
               const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
               const logCurrencySymbol = getAccountCurrency(log.account_id) === 'USD' ? '$' : '₹';
               return (
                 <div key={log.id} className="glass-card-static flex items-center justify-between gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-2xl">
                   <div className="flex min-w-0 items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${isOut ? "bg-rose-500/5 text-rose-400 border border-rose-500/10" : "bg-emerald-500/5 text-emerald-400 border border-emerald-500/10"}`}>
                        {log.action_type === "CREATE" ? <Sparkles className="w-3.5 h-3.5" /> : isOut ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-xs font-bold text-white leading-tight">{log.details}</span>
                        <span className="truncate text-xs font-medium text-[--text-muted] mt-0.5">{log.created_at ? format(new Date(log.created_at), "MMM d, HH:mm") : "—"} · {log.account_name}</span>
                      </div>
                    </div>
                   <span className={`shrink-0 text-[11.5px] font-black tabular-nums ${isOut ? "text-rose-400" : "text-emerald-400"}`}>
                      {log.amount ? `${isOut ? "-" : "+"}${logCurrencySymbol}${log.amount.toLocaleString()}` : "—"}
                    </span>
                 </div>
               );
            })}
            {recentLogs.length === 0 && (
              <div className="py-8 text-center glass-card-static text-[0.5625rem] uppercase font-bold tracking-[0.2em] text-[--text-muted] border-dashed rounded-2xl">
                Ready for data entry
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
});

export default DashboardMobile;

