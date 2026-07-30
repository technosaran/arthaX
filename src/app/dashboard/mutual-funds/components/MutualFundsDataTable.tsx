"use client";

import { memo } from "react";
import { EmptyState } from "@/components/empty-state";
import type { Tables } from "@/lib/database.types";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number; day_change?: number; day_change_percent?: number };

interface MutualFundsDataTableProps {
  funds: MF[];
  onEdit: (fund: MF) => void;
  onBuy: (fund: MF) => void;
  onSell: (fund: MF) => void;
  onAdd: () => void;
}

import { BrandLogo } from "@/components/brand-logo";

export const AMCAvatar = memo(({ amcName, fundName, className = "w-8 h-8" }: { amcName?: string; fundName?: string; size?: number; className?: string }) => {
  return <BrandLogo name={amcName || fundName} className={`${className} rounded-lg shrink-0`} />;
});
AMCAvatar.displayName = "AMCAvatar";

export default function MutualFundsDataTable({ funds, onEdit, onBuy, onSell, onAdd }: MutualFundsDataTableProps) {


  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (funds.length === 0) {
    return (
      <EmptyState 
        icon="📈"
        title="No investments"
        description="You haven't invested in any mutual funds yet."
        action={
          <button onClick={onAdd} className="btn-primary">
            Explore funds
          </button>
        }
      />
    );
  }

  const totalInvested = funds.reduce((sum, f) => sum + (Number(f.units) * Number(f.avg_nav)), 0);
  const totalCurrent = funds.reduce((sum, f) => sum + (Number(f.units) * Number(f.current_nav)), 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl w-full relative">
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-white/10 bg-black/80 text-[0.6875rem] font-black uppercase tracking-[0.12em] text-gray-400">
              <th className="px-4 py-3.5">Fund Name</th>
              <th className="px-3 py-3.5 text-center">Type</th>
              <th className="px-3 py-3.5 text-right">Units</th>
              <th className="px-3 py-3.5 text-right">Avg. NAV</th>
              <th className="px-3 py-3.5 text-right">Current NAV</th>
              <th className="px-3 py-3.5 text-right">Invested Value</th>
              <th className="px-3 py-3.5 text-right">Current Value</th>
              <th className="px-4 py-3.5 text-right">P&L / Return</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {funds.map((fund) => {
              const invested = Number(fund.units) * Number(fund.avg_nav);
              const current = Number(fund.units) * Number(fund.current_nav);
              const pnl = current - invested;
              const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
              const isPositive = pnl >= 0;

              return (
                <tr key={fund.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Fund Name */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <BrandLogo name={fund.amc_name || fund.fund_name} symbol={fund.fund_symbol} className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-white block truncate max-w-[200px] lg:max-w-[280px]" title={fund.fund_name}>
                          {fund.fund_name}
                        </span>
                        <span className="text-[0.5625rem] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 inline-block">
                          {fund.category || "Equity"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-3.5 text-center">
                    <span className="text-[0.5625rem] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      {fund.investment_type || "SIP"}
                    </span>
                  </td>

                  {/* Units */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs sm:text-sm font-medium text-gray-200">
                    {Number(fund.units).toFixed(3)}
                  </td>

                  {/* Avg NAV */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs sm:text-sm font-medium text-gray-400">
                    ₹{formatMoney(Number(fund.avg_nav))}
                  </td>

                  {/* Current NAV */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs sm:text-sm font-bold text-white">
                    ₹{formatMoney(Number(fund.current_nav))}
                  </td>

                  {/* Invested Value */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs sm:text-sm font-medium text-gray-300">
                    ₹{formatMoney(invested)}
                  </td>

                  {/* Current Value */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs sm:text-sm font-extrabold text-white">
                    ₹{formatMoney(current)}
                  </td>

                  {/* P&L */}
                  <td className="px-4 py-3.5 text-right">
                    <div 
                      className="font-mono text-xs sm:text-sm font-bold inline-flex flex-col items-end"
                      style={{
                        color: isPositive ? '#10b981' : '#f87171',
                      }}
                    >
                      <span>{isPositive ? '+' : ''}₹{formatMoney(pnl)}</span>
                      <span className="text-[0.6875rem] font-mono opacity-90 mt-0.5">{isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onEdit(fund)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors cursor-pointer"
                        title="Edit details"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onBuy(fund)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[0.625rem] font-black uppercase tracking-wider transition-colors cursor-pointer border border-emerald-500/20"
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => onSell(fund)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[0.625rem] font-black uppercase tracking-wider transition-colors cursor-pointer border border-rose-500/20"
                      >
                        Redeem
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          
          {/* Zerodha-Style Summary Row */}
          <tfoot>
            <tr className="border-t-2 border-white/10 bg-black/80 font-black text-xs">
              <td className="px-4 py-4 text-white uppercase tracking-wider" colSpan={5}>Total Holdings ({funds.length})</td>
              <td className="px-3 py-4 text-right font-mono text-xs sm:text-sm text-gray-300 font-semibold">₹{formatMoney(totalInvested)}</td>
              <td className="px-3 py-4 text-right font-mono text-xs sm:text-sm text-white font-extrabold">₹{formatMoney(totalCurrent)}</td>
              <td className="px-4 py-4 text-right">
                <div 
                  className="font-mono text-xs sm:text-sm font-extrabold inline-flex flex-col items-end"
                  style={{
                    color: totalPnL >= 0 ? '#10b981' : '#f87171',
                  }}
                >
                  <span>{totalPnL >= 0 ? '+' : ''}₹{formatMoney(totalPnL)}</span>
                  <span className="text-[0.6875rem] font-mono opacity-90 mt-0.5">{totalPnL >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%</span>
                </div>
              </td>
              <td className="px-4 py-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
