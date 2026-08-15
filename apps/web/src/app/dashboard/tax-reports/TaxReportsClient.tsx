"use client";

import { useMemo, useState } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { ModuleGuard } from "@/components/module-guard";
import { toast } from "react-hot-toast";
import { triggerAllMarketSync } from "@/app/dashboard/settings/actions";
import {
  computeIndiaTaxReport,
  formatFYLabel,
  getCurrentFYStartYear,
  type TaxRegime,
} from "@/lib/tax/india-tax-engine";
import Form16ParserModal from "@/components/Form16ParserModal";
import { TaxLossHarvestingCalculator } from "./components/TaxLossHarvestingCalculator";
import { AITaxSyncModal } from "./components/AITaxSyncModal";
import {
  Zap,
  Receipt,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle,
  BarChart3,
  Layers,
  Calculator,
  Sparkles,
  FileText,
  Bot,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const formatINR = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function TaxReportsClient() {
  const { data, mutate } = useFinanceData();
  const [regime, setRegime] = useState<TaxRegime>("new");
  const [fyStartYear, setFyStartYear] = useState(getCurrentFYStartYear());
  const [businessMode, setBusinessMode] = useState(false);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [showMathAudit, setShowMathAudit] = useState(false); // Collapsed by default
  const [showForm16Modal, setShowForm16Modal] = useState(false);
  const [showAITaxSyncModal, setShowAITaxSyncModal] = useState(false);

  const {
    incomes = [],
    expenses = [],
    investments = [],
    mutualFunds = [],
    bonds = [],
    liabilities = [],
    alternativeAssets = [],
  } = data || {};

  const fyOptions = useMemo(() => {
    const current = getCurrentFYStartYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  const taxInput = useMemo(
    () => ({
      fyStartYear,
      regime,
      incomes,
      expenses,
      transactions: data?.transactions || [],
      investments,
      mutualFunds,
      bonds,
      alternativeAssets,
      liabilities,
    }),
    [fyStartYear, regime, incomes, expenses, data?.transactions, investments, mutualFunds, bonds, alternativeAssets, liabilities]
  );

  const report = useMemo(() => computeIndiaTaxReport(taxInput), [taxInput]);

  const stdDeduction = regime === "new" ? (fyStartYear >= 2024 ? 75000 : 50000) : 50000;
  const taxableNet = Math.max(0, report.taxHeads.grossIncome - stdDeduction - (regime === "old" ? report.deductions.totalEligible : 0));
  const rebatedTax = report.taxPayment.taxPayable;
  const isTaxFree87A = rebatedTax === 0 && report.taxHeads.grossIncome > 0;

  const handleSyncPrices = async () => {
    setIsSyncingPrices(true);
    const toastId = toast.loading("Syncing live market NAVs and prices...");
    try {
      const res = await triggerAllMarketSync();
      if (res.error) {
        toast.error(`Market sync failed: ${res.error}`, { id: toastId });
      } else {
        toast.success(res.message || "Live market prices & NAVs updated!", { id: toastId });
        mutate();
      }
    } catch {
      toast.error("Failed to fetch live market prices", { id: toastId });
    } finally {
      setIsSyncingPrices(false);
    }
  };

  return (
    <ModuleGuard moduleKey="Tax & Reports">
      <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-fade-in font-sans">
        
        {/* ─── Minimal Header & Controls ─── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Receipt className="w-5 h-5 text-gray-400" />
                Tax Studio
              </h1>
              <p className="text-xs text-gray-400 mt-1 max-w-xl font-medium">
                Verified India Income Tax Engine for {report.fiscal.label}. Official Finance Act rules.
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowAITaxSyncModal(true)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-gray-400" />
                Auto-Sync
              </button>
              <button
                onClick={() => setShowForm16Modal(true)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                Form 16
              </button>
              <button
                onClick={handleSyncPrices}
                disabled={isSyncingPrices}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Zap className={`w-3.5 h-3.5 text-gray-400 ${isSyncingPrices ? "animate-spin text-cyan-400" : ""}`} />
                {isSyncingPrices ? "Syncing..." : "Live NAVs"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/5 pt-4 flex-wrap">
            <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1 border border-white/5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 ml-2" />
              <select
                value={fyStartYear}
                onChange={(e) => setFyStartYear(Number(e.target.value))}
                className="bg-transparent text-white text-xs font-bold px-2 py-1 outline-none cursor-pointer"
              >
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy} className="bg-slate-900">
                    {formatFYLabel(fy)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => setRegime("new")}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${regime === "new" ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-white"}`}
              >
                New Regime
              </button>
              <button
                type="button"
                onClick={() => setRegime("old")}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${regime === "old" ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-white"}`}
              >
                Old Regime
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setBusinessMode((s) => !s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${businessMode ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-white/5 text-gray-500 bg-black/40 hover:text-white"}`}
            >
              GST: {businessMode ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <AITaxSyncModal
          isOpen={showAITaxSyncModal}
          onClose={() => setShowAITaxSyncModal(false)}
          onSuccess={() => mutate()}
        />

        <Form16ParserModal
          isOpen={showForm16Modal}
          onClose={() => setShowForm16Modal(false)}
          onApply={() => mutate()}
        />

        {/* ─── Hero Metric Cards ─── */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="glass-card-static p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-gray-500 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Gross Earnings
            </span>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">{formatINR(report.taxHeads.grossIncome)}</p>
              <p className="text-[10px] text-gray-500 mt-1 font-medium leading-tight">Salary, Rent, Capital Gains & Interest</p>
            </div>
          </div>

          <div className="glass-card-static p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden">
            <span className="text-gray-500 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              Net Tax Payable
            </span>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">{formatINR(rebatedTax)}</p>
              {isTaxFree87A ? (
                <span className="inline-flex items-center gap-1 mt-1 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3" /> Sec 87A Rebate Active
                </span>
              ) : (
                <p className="text-[10px] text-gray-500 mt-1 font-medium leading-tight">After ₹{stdDeduction.toLocaleString()} std. deduction</p>
              )}
            </div>
          </div>

          <div className="glass-card-static p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden">
            <span className="text-gray-500 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              TDS / Advance Paid
            </span>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">{formatINR(report.taxPayment.totalTaxPaid)}</p>
              {report.taxPayment.taxRefundEstimate > 0 ? (
                <span className="inline-flex items-center gap-1 mt-1 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> Refund: {formatINR(report.taxPayment.taxRefundEstimate)}
                </span>
              ) : (
                <p className="text-[10px] text-gray-500 mt-1 font-medium leading-tight">Deducted by employer or banks</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── TAX LOSS & GAIN HARVESTING STUDIO ─── */}
        <div className="glass-card-static rounded-2xl overflow-hidden">
          <TaxLossHarvestingCalculator input={taxInput} />
        </div>

        {/* ─── Bento Grid Layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          
          {/* Column 1: Income Breakdown */}
          <div className="glass-card-static p-5 rounded-2xl flex flex-col gap-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Income Sources
            </h3>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">Salary Income</span>
                  <span className="text-[10px] text-gray-500">Payroll & bonuses</span>
                </div>
                <span className="font-mono font-bold text-gray-300">{formatINR(report.taxHeads.salaryIncome)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">House Property</span>
                  <span className="text-[10px] text-gray-500">Rental income</span>
                </div>
                <span className="font-mono font-bold text-gray-300">{formatINR(report.taxHeads.housePropertyIncome)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">Capital Gains</span>
                  <span className="text-[10px] text-gray-500">STCG & LTCG</span>
                </div>
                <span className="font-mono font-bold text-gray-300">{formatINR(report.taxHeads.capitalGains.stcg + report.taxHeads.capitalGains.ltcg)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">Other Sources</span>
                  <span className="text-[10px] text-gray-500">Interest, gifts</span>
                </div>
                <span className="font-mono font-bold text-gray-300">{formatINR(report.taxHeads.otherSourcesIncome)}</span>
              </div>
            </div>

            {/* GST Breakdown */}
            {businessMode && (
              <div className="mt-2 pt-4 border-t border-white/5 space-y-1.5 text-xs">
                <p className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider mb-2">GST Outflow</p>
                <div className="flex justify-between text-gray-400"><span>CGST</span><span className="font-mono text-gray-300">{formatINR(report.taxPayment.gstBreakdown.cgst)}</span></div>
                <div className="flex justify-between text-gray-400"><span>SGST</span><span className="font-mono text-gray-300">{formatINR(report.taxPayment.gstBreakdown.sgst)}</span></div>
                <div className="flex justify-between text-gray-400"><span>IGST</span><span className="font-mono text-gray-300">{formatINR(report.taxPayment.gstBreakdown.igst)}</span></div>
                <div className="flex justify-between font-bold text-white border-t border-white/5 pt-1.5 mt-1.5"><span>Total GST</span><span className="font-mono">{formatINR(report.taxPayment.gst)}</span></div>
              </div>
            )}
          </div>

          {/* Column 2: Regime Comparison & Math Audit */}
          <div className="flex flex-col gap-3">
            <div className="glass-card-static p-5 rounded-2xl flex flex-col gap-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" />
                Regime Comparison
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div className={`p-3 rounded-xl border transition-all ${regime === "new" ? "border-cyan-500/30 bg-cyan-500/10" : "border-white/5 bg-black/20"}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">New Regime</p>
                  <p className="text-lg font-black text-white mt-0.5">{formatINR(report.regimeComparison.new)}</p>
                </div>

                <div className={`p-3 rounded-xl border transition-all ${regime === "old" ? "border-purple-500/30 bg-purple-500/10" : "border-white/5 bg-black/20"}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-400">Old Regime</p>
                  <p className="text-lg font-black text-white mt-0.5">{formatINR(report.regimeComparison.old)}</p>
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center justify-between">
                <span className="font-medium text-gray-300">
                  Recommended: <span className="font-bold text-white">{report.regimeComparison.recommended.toUpperCase()}</span>
                </span>
                <span className="font-mono font-bold text-emerald-400">Save {formatINR(report.regimeComparison.savingsVsOther)}</span>
              </div>
            </div>

            {/* Collapsed Math Audit Box */}
            <div className="glass-card-static rounded-2xl flex flex-col overflow-hidden">
              <button 
                onClick={() => setShowMathAudit(!showMathAudit)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Calculator className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Math Audit</span>
                </div>
                {showMathAudit ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              
              {showMathAudit && (
                <div className="px-4 pb-4 font-mono text-[11px] space-y-2 text-gray-400">
                  <div className="flex justify-between border-t border-white/5 pt-3">
                    <span>1. Gross Income</span>
                    <span className="font-bold text-white">+ {formatINR(report.taxHeads.grossIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2. Std Deduction</span>
                    <span className="font-bold text-rose-400">- {formatINR(stdDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300 font-bold">
                    <span>3. Net Taxable</span>
                    <span>= {formatINR(taxableNet)}</span>
                  </div>
                  <div className="pl-3 border-l border-white/10 space-y-1 text-[10px] my-2 py-1">
                    <p className="text-gray-500 font-sans font-bold">Slab Calculation:</p>
                    <div className="flex justify-between"><span>Up to ₹4L (0%)</span><span>₹0</span></div>
                    <div className="flex justify-between"><span>₹4L - ₹8L (5%)</span><span>{taxableNet > 400000 ? formatINR(Math.min(400000, taxableNet - 400000) * 0.05) : "₹0"}</span></div>
                    <div className="flex justify-between"><span>₹8L - ₹12L (10%)</span><span>{taxableNet > 800000 ? formatINR(Math.min(400000, taxableNet - 800000) * 0.10) : "₹0"}</span></div>
                    {taxableNet > 1200000 && (
                      <div className="flex justify-between"><span>₹12L - ₹16L (15%)</span><span>{formatINR(Math.min(400000, taxableNet - 1200000) * 0.15)}</span></div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>4. Sec 87A Rebate</span>
                    <span className="font-bold text-emerald-400">- {isTaxFree87A ? formatINR(report.taxPayment.taxPayable) : "₹0"}</span>
                  </div>
                  <div className="flex justify-between text-sm font-sans font-black text-white border-t border-white/10 pt-2 mt-2">
                    <span>Final Tax</span>
                    <span className={isTaxFree87A ? "text-emerald-400" : "text-rose-400"}>{formatINR(rebatedTax)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Deductions & Deadlines */}
          <div className="flex flex-col gap-3">
            {/* Deductions Tracker */}
            <div className="glass-card-static p-5 rounded-2xl flex flex-col gap-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Deductions
              </h3>
              <div className="space-y-2.5">
                {report.deductions.items.map((item) => {
                  const pct = Math.min(100, Math.round((item.used / item.limit) * 100));
                  return (
                    <div key={item.code} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-gray-300">{item.code}</span>
                        <span className="font-mono text-gray-400">{formatINR(item.used)} / {formatINR(item.limit)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-white/30 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compliance Deadlines */}
            <div className="glass-card-static p-5 rounded-2xl flex flex-col gap-3 flex-1">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Deadlines
              </h3>
              <div className="space-y-2">
                {report.fiscal.taxCalendar.map((event) => (
                  <div key={event.dueDate} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[10px]">
                    <span className="text-gray-400 font-medium">{event.label}</span>
                    <span className="font-mono font-bold text-gray-300 whitespace-nowrap">{event.dueDate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </ModuleGuard>
  );
}
