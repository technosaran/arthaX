"use client";

import { useMemo, useState } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { ModuleGuard } from "@/components/module-guard";
import {
  computeIndiaTaxReport,
  formatFYLabel,
  getCurrentFYStartYear,
  type TaxRegime,
} from "@/lib/tax/india-tax-engine";

const formatINR = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function TaxReportsClient() {
  const { data } = useFinanceData();
  const [regime, setRegime] = useState<TaxRegime>("new");
  const [fyStartYear, setFyStartYear] = useState(getCurrentFYStartYear());
  const [businessMode, setBusinessMode] = useState(false);

  const fyOptions = useMemo(() => {
    const current = getCurrentFYStartYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  const report = useMemo(
    () =>
      computeIndiaTaxReport({
        fyStartYear,
        regime,
        incomes: data?.incomes || [],
        expenses: data?.expenses || [],
        transactions: data?.transactions || [],
        investments: data?.investments || [],
        mutualFunds: data?.mutualFunds || [],
        bonds: data?.bonds || [],
        alternativeAssets: data?.alternativeAssets || [],
        liabilities: data?.liabilities || [],
      }),
    [data, fyStartYear, regime]
  );

  const missingTaxSignals = [
    !data?.profile?.username ? "Profile name is missing" : null,
    (data?.transactions || []).some((t) => t.type === "expense" && !t.category) ? "Some expense rows are uncategorized" : null,
    !data?.profile?.base_currency ? "Base currency is missing" : null,
  ].filter(Boolean) as string[];

  return (
    <ModuleGuard moduleKey="Tax & Reports">
      <div className="space-y-6 animate-fade-in">
        <div className="glass-card p-6 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-slate-900/30 to-slate-950/80">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-black">Tax & Reports</p>
              <h1 className="text-2xl font-black text-white tracking-tight">India Fiscal Intelligence Console</h1>
              <p className="text-xs text-[--text-muted] mt-1">Financial year Apr-Mar • Rule version {report.fiscal.ruleVersion}</p>
            </div>
            <div className="flex gap-2">
              <select value={fyStartYear} onChange={(e) => setFyStartYear(Number(e.target.value))} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs">
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy}>{formatFYLabel(fy)}</option>
                ))}
              </select>
              <select value={regime} onChange={(e) => setRegime(e.target.value as TaxRegime)} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs">
                <option value="new">New Regime</option>
                <option value="old">Old Regime</option>
              </select>
              <button type="button" onClick={() => setBusinessMode((s) => !s)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${businessMode ? "border-emerald-400 text-emerald-300" : "border-white/10 text-[--text-muted]"}`}>
                GST Mode {businessMode ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="glass-card-static p-4 rounded-2xl border border-white/10">
            <p className="text-xs text-[--text-muted]">FY Taxable Income</p>
            <p className="text-xl font-black text-white mt-1">{formatINR(report.taxHeads.grossIncome)}</p>
          </div>
          <div className="glass-card-static p-4 rounded-2xl border border-white/10">
            <p className="text-xs text-[--text-muted]">Estimated Tax Payable</p>
            <p className="text-xl font-black text-rose-400 mt-1">{formatINR(report.taxPayment.taxPayable)}</p>
          </div>
          <div className="glass-card-static p-4 rounded-2xl border border-white/10">
            <p className="text-xs text-[--text-muted]">Tax Paid (TDS/TCS/Advance)</p>
            <p className="text-xl font-black text-emerald-400 mt-1">{formatINR(report.taxPayment.totalTaxPaid)}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass-card-static p-4 rounded-2xl border border-white/10">
            <h2 className="text-sm font-black text-white mb-3">Tax Center</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span>Salary</span><span>{formatINR(report.taxHeads.salaryIncome)}</span></div>
              <div className="flex justify-between"><span>House Property</span><span>{formatINR(report.taxHeads.housePropertyIncome)}</span></div>
              <div className="flex justify-between"><span>Capital Gains (STCG)</span><span>{formatINR(report.taxHeads.capitalGains.stcg)}</span></div>
              <div className="flex justify-between"><span>Capital Gains (LTCG)</span><span>{formatINR(report.taxHeads.capitalGains.ltcg)}</span></div>
              <div className="flex justify-between"><span>Other Sources</span><span>{formatINR(report.taxHeads.otherSourcesIncome)}</span></div>
              <div className="pt-2 mt-2 border-t border-white/10 flex justify-between font-bold text-cyan-300"><span>Eligible Deductions</span><span>{formatINR(report.deductions.totalEligible)}</span></div>
              <div className="pt-2 mt-2 border-t border-white/10 flex justify-between"><span>Old Regime Tax</span><span>{formatINR(report.regimeComparison.old)}</span></div>
              <div className="flex justify-between"><span>New Regime Tax</span><span>{formatINR(report.regimeComparison.new)}</span></div>
              <div className="flex justify-between font-black text-emerald-300"><span>Recommended</span><span>{report.regimeComparison.recommended.toUpperCase()}</span></div>
            </div>
          </div>

          <div className="glass-card-static p-4 rounded-2xl border border-white/10">
            <h2 className="text-sm font-black text-white mb-3">Reports Center</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span>Monthly P&L</span><span>{formatINR(report.reports.monthly.pnl)}</span></div>
              <div className="flex justify-between"><span>Quarterly P&L</span><span>{formatINR(report.reports.quarterly.pnl)}</span></div>
              <div className="flex justify-between"><span>Annual P&L</span><span>{formatINR(report.reports.annual.pnl)}</span></div>
              <div className="pt-2 mt-2 border-t border-white/10 flex justify-between"><span>Balance Sheet Net Worth</span><span>{formatINR(report.reports.balanceSheet.netWorth)}</span></div>
              <div className="flex justify-between"><span>Liability Outstanding</span><span>{formatINR(report.reports.liabilities.totalOutstanding)}</span></div>
              <div className="flex justify-between"><span>Monthly EMI</span><span>{formatINR(report.reports.liabilities.monthlyEmi)}</span></div>
              <div className="pt-2 mt-2 border-t border-white/10 text-[--text-muted]">Family view: {report.reports.familyConsolidated.note}</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass-card-static p-4 rounded-2xl border border-white/10">
            <h3 className="text-sm font-black text-white mb-2">Deductions Tracker (80C/80D/80CCD)</h3>
            <div className="space-y-2 text-xs">
              {report.deductions.items.map((item) => (
                <div key={item.code} className="flex justify-between">
                  <span>{item.code} ({formatINR(item.limit)})</span>
                  <span>{formatINR(item.eligible)} used</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card-static p-4 rounded-2xl border border-white/10">
            <h3 className="text-sm font-black text-white mb-2">Tax Calendar (India)</h3>
            <div className="space-y-2 text-xs">
              {report.fiscal.taxCalendar.map((item) => (
                <div key={item.dueDate} className="flex justify-between">
                  <span>{item.label}</span><span className="text-cyan-300">{item.dueDate}</span>
                </div>
              ))}
            </div>
            {businessMode && <p className="text-[11px] text-amber-300 mt-3">GST summary in FY: {formatINR(report.taxPayment.gst)}</p>}
          </div>
        </div>

        <div className="glass-card-static p-4 rounded-2xl border border-white/10">
          <h3 className="text-sm font-black text-white mb-2">Validation & Auditability</h3>
          <div className="text-xs space-y-1 text-[--text-muted]">
            {missingTaxSignals.length === 0 ? <p>All key tax signals look complete for high-level reporting.</p> : missingTaxSignals.map((msg) => <p key={msg}>• {msg}</p>)}
            <p>• Source rows: income {report.audit.incomeRows.length}, expense {report.audit.expenseRows.length}, transactions {report.audit.transactionRows.length}</p>
            <p>• Capital gain trace rows: {report.audit.capitalGainSourceRows.length}</p>
            <p>• Locale defaults: INR / en-IN / Asia-Kolkata (as configured in profile).</p>
          </div>
        </div>
      </div>
    </ModuleGuard>
  );
}
