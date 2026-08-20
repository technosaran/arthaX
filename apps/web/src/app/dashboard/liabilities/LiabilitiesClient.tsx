"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { addLiability, updateLiability, deleteLiability } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { Plus, Trash2, User, Home, CreditCard, Calendar, Car, Building2, FileText } from "lucide-react";
import { getColorByLabel } from "@/lib/chart-colours";

import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from "@/components/ui/recharts";
import { EmptyState } from "@/components/empty-state";
import { TrendingUp } from "lucide-react";
import LiabilitiesDataTable from "./components/LiabilitiesDataTable";

const CATEGORIES = [
  { label: "Personal Loan", icon: User },
  { label: "Home Loan", icon: Home },
  { label: "Credit Card", icon: CreditCard },
  { label: "EMI", icon: Calendar },
  { label: "Vehicle Loan", icon: Car },
  { label: "Business Loan", icon: Building2 },
  { label: "Others", icon: FileText },
];

export default function LiabilitiesClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { liabilities, accounts, ledgerLogs, expenses }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "records" | "history">("overview");
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");

  const mounted = useHasMounted();

  const [formData, setFormData] = useState({
    name: "",
    category: "Personal Loan",
    total_amount: "",
    remaining_amount: "",
    interest_rate: "",
    monthly_payment: "",
    due_date: "",
    notes: "",
    account_id: "",
  });

  const stats = useMemo(() => {
    const totalDebt = liabilities.reduce((s, l) => s + Number(l.remaining_amount), 0);
    const totalPrincipal = liabilities.reduce((s, l) => s + Number(l.total_amount), 0);
    const monthlyEMI = liabilities.reduce((s, l) => s + Number(l.monthly_payment || 0), 0);
    const highestInterest = liabilities.reduce((max, l) => Math.max(max, Number(l.interest_rate || 0)), 0);
    const weightedInterest = totalDebt > 0 
      ? liabilities.reduce((sum, l) => sum + (Number(l.remaining_amount) * Number(l.interest_rate || 0)), 0) / totalDebt 
      : 0;
    const totalPaid = totalPrincipal - totalDebt;
    const payoffPct = totalPrincipal > 0 ? (totalPaid / totalPrincipal) * 100 : 0;
    
    return { totalDebt, monthlyEMI, highestInterest, weightedInterest, totalPrincipal, totalPaid, payoffPct };
  }, [liabilities]);

  // Derived Loan History (ledger logs + EMI/Loan expense records)
  const loanHistoryLogs = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      title: string;
      category: string;
      type: "PAYMENT" | "LOG";
      amount: number | null;
      details: string;
      badgeColor: string;
    }> = [];

    // 1. Filter ledger logs for liability events
    (ledgerLogs || []).forEach((log) => {
      const isLiabilityLog =
        log.source_type === "liability" ||
        log.source_type === "liabilities" ||
        (log.details || "").toLowerCase().includes("loan") ||
        (log.details || "").toLowerCase().includes("emi") ||
        (log.details || "").toLowerCase().includes("liability");

      if (isLiabilityLog && log.created_at) {
        items.push({
          id: `log-${log.id}`,
          date: log.created_at,
          title: log.account_name || "Loan Audit Entry",
          category: log.action_type || "LIABILITY",
          type: "LOG",
          amount: log.amount,
          details: log.details || "Liability audit log entry",
          badgeColor: "bg-purple-500/15 border-purple-500/30 text-purple-400",
        });
      }
    });

    // 2. Filter expenses for EMI / Loan Repayments
    (expenses || []).forEach((exp) => {
      const catLower = (exp.category || "").toLowerCase();
      const detLower = ((exp as any).details || (exp as any).merchant || exp.description || "").toLowerCase();
      const isLoanExpense =
        catLower.includes("emi") ||
        catLower.includes("loan") ||
        catLower.includes("credit card") ||
        catLower.includes("vehicle") ||
        catLower.includes("housing") ||
        detLower.includes("emi") ||
        detLower.includes("loan payment");

      if (isLoanExpense && exp.date) {
        items.push({
          id: `exp-${exp.id}`,
          date: exp.date,
          title: (exp as any).merchant || (exp as any).details || exp.description || exp.category || "EMI Payment",
          category: exp.category || "EMI",
          type: "PAYMENT",
          amount: Number(exp.amount),
          details: (exp as any).details || exp.description || `Payment towards ${exp.category}`,
          badgeColor: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
        });
      }
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledgerLogs, expenses]);

  const filteredHistoryLogs = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    return loanHistoryLogs.filter((item) => {
      if (historyTypeFilter !== "all" && item.type !== historyTypeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q)
      );
    });
  }, [loanHistoryLogs, historySearch, historyTypeFilter]);

  const pieChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    liabilities.forEach(l => {
      const cat = l.category || "Others";
      catMap[cat] = (catMap[cat] || 0) + Number(l.remaining_amount);
    });
    return Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value);
  }, [liabilities]);

  const barChartData = useMemo(() => {
    return liabilities.map(l => {
      const remaining = Number(l.remaining_amount);
      const paid = Math.max(0, Number(l.total_amount) - remaining);
      return {
        name: l.name.substring(0, 10) + (l.name.length > 10 ? "..." : ""),
        Paid: paid,
        Remaining: remaining,
        Total: Number(l.total_amount)
      };
    }).sort((a, b) => b.Remaining - a.Remaining).slice(0, 10);
  }, [liabilities]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = parseFloat(formData.total_amount);
    const remaining = parseFloat(formData.remaining_amount);
    const interestRate = formData.interest_rate ? parseFloat(formData.interest_rate) : null;
    const monthlyPayment = formData.monthly_payment ? parseFloat(formData.monthly_payment) : null;

    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Total principal must be greater than zero.");
      return;
    }
    if (!Number.isFinite(remaining) || remaining < 0) {
      toast.error("Remaining balance must be zero or greater.");
      return;
    }
    if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) {
      toast.error("Interest rate cannot be negative.");
      return;
    }
    if (monthlyPayment !== null && (!Number.isFinite(monthlyPayment) || monthlyPayment < 0)) {
      toast.error("Monthly EMI cannot be negative.");
      return;
    }
    if (remaining > total) {
      toast.error("Remaining balance cannot exceed total principal!");
      return;
    }

    await withLock(async () => {
      const { account_id, ...libData } = formData;
      const payload = {
        ...libData,
        total_amount: total,
        remaining_amount: remaining,
        interest_rate: interestRate,
        monthly_payment: monthlyPayment,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
      };

      const res = editingId 
        ? await updateLiability(editingId, payload)
        : await addLiability({ ...payload, account_id });

      if (!res.error) {
        toast.success(editingId ? "Liability updated successfully" : "Liability added successfully");
        setShowAddModal(false);
        setEditingId(null);
        setFormData({ name: "", category: "Personal Loan", total_amount: "", remaining_amount: "", interest_rate: "", monthly_payment: "", due_date: "", notes: "", account_id: "" });
        mutate();
      } else toast.error(res.error);
    });
  }

  const [deletingLiabilityId, setDeletingLiabilityId] = useState<string | null>(null);

  function handleDeleteLiability(id: string) {
    setDeletingLiabilityId(id);
  }

  async function confirmDeleteLiability() {
    if (!deletingLiabilityId) return;
    await withLock(async () => {
      const res = await deleteLiability(deletingLiabilityId);
      if (!res.error) {
        toast.success("Liability deleted successfully");
        setDeletingLiabilityId(null);
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
    return `₹${value.toLocaleString()}`;
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Loans & Debts</h1>
          <p className="text-xs text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Liability Management Terminal</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} disabled={submitting} className="btn-primary !h-11 px-6 !bg-rose-500 hover:!bg-rose-600 shadow-[0_0_30px_rgba(244,63,94,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Record Liability
        </button>
      </div>

      {liabilities.length === 0 && loanHistoryLogs.length === 0 ? (
        <EmptyState
          title="No Active Liabilities"
          description="You have no active loans or credit card debt. Good job staying debt-free!"
          icon={<TrendingUp size={32} />}
          action={
            <button 
              onClick={() => setShowAddModal(true)} 
              className="btn-primary !h-11 px-6 !bg-rose-500 hover:!bg-rose-600 shadow-[0_0_30px_rgba(244,63,94,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              <Plus size={16} /> Record First Liability
            </button>
          }
        />
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted] mb-3">Total Exposure</p>
            <p className="text-2xl md:text-3xl font-black text-rose-500">₹{stats.totalDebt.toLocaleString()}</p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Outstanding Principal</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted] mb-3">Monthly Commitment</p>
            <p className="text-2xl md:text-3xl font-black text-orange-400">₹{stats.monthlyEMI.toLocaleString()}</p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Combined EMIs</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted] mb-3">Weighted Interest</p>
            <p className="text-2xl md:text-3xl font-black text-white">{stats.weightedInterest.toFixed(2)}%</p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Avg APR across debts (Max: {stats.highestInterest.toFixed(1)}%)</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted] mb-3">Total Paid</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{stats.totalPaid.toLocaleString()}</p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Cumulative Repayments</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-rose-500/10 to-transparent">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted] mb-3">Payoff Progress</p>
            <p className={`text-2xl md:text-3xl font-black text-white`}>
              {stats.payoffPct.toFixed(1)}%
            </p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">% Of Principal Cleared</p>
          </div>
        </div>

        {/* Premium Segmented Switcher */}
        <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-2xl max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
          {[
            { key: "overview", label: "Overview" },
            { key: "records", label: "Debt Records" },
            { key: "history", label: "Loan History" }
          ].map((tab) => {
            const isActive = activeView === tab.key;
            
            // Premium Rose Theme for Liabilities
            const activeStyles = "bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]";

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                  isActive
                    ? `${activeStyles} border border-transparent`
                    : "text-[--text-muted] hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* View Content */}
        {activeView === "overview" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Paydown Bar Chart */}
              <div className="glass-card-static p-6 lg:col-span-2 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Debt vs Paid (Top 10)</h3>
                    <p className="text-2xl font-black mt-2 text-white">Paydown Analysis</p>
                  </div>
                </div>
                <div className="flex-1 min-h-[260px] w-full mt-4 -ml-4">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={6}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                        <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", boxShadow: "0 10px 25px rgba(0,0,0,0.6)" }}
                          itemStyle={{ color: "#fff", fontWeight: "bold" }}
                          formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString()}`, name]}
                        />
                        <Legend wrapperStyle={{ paddingTop: "15px" }} />
                        <Bar dataKey="Paid" name="Cleared / Paid" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="Remaining" name="Remaining Debt" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Allocation Pie Chart */}
              <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Debt Exposure</h3>
                <div className="w-full h-[250px] mt-6 relative flex items-center justify-center">
                  {mounted && pieChartData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={65} outerRadius={88} paddingAngle={4} dataKey="value">
                            {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px" }}
                            itemStyle={{ color: "#fff", fontWeight: "bold" }}
                            formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Debt"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span className="text-[0.5625rem] font-black uppercase tracking-widest text-[--text-muted]">Total Exposure</span>
                        <span className="text-sm font-black text-rose-400 mt-0.5">₹{stats.totalDebt.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                       <span className="text-3xl mb-2">📊</span>
                       <span className="text-xs uppercase tracking-widest font-black">No Category Data</span>
                    </div>
                  )}
                </div>
                {pieChartData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
                    {pieChartData.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <span className="text-[--text-secondary] font-semibold">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeView === "records" ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <LiabilitiesDataTable 
              liabilities={liabilities} 
              onEdit={(l) => {
                setEditingId(l.id);
                setFormData({
                  name: l.name,
                  category: l.category || "Personal Loan",
                  total_amount: l.total_amount.toString(),
                  remaining_amount: l.remaining_amount.toString(),
                  interest_rate: (l.interest_rate || "").toString(),
                  monthly_payment: (l.monthly_payment || "").toString(),
                  due_date: l.due_date ? l.due_date.substring(0, 10) : "",
                  notes: l.notes || "", 
                  account_id: "",
                });
                setShowAddModal(true);
              }} 
              onDelete={handleDeleteLiability} 
              onAdd={() => setShowAddModal(true)} 
            />
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* History Header & Controls */}
            <div className="glass-card-static p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02]">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>📜</span> Loan Payment & Audit History
                </h3>
                <p className="text-xs text-[--text-muted] mt-1">
                  Complete timeline of EMI payments, loan adjustments, and balance audit logs.
                </p>
              </div>

              {/* History Search & Type Filter */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search history..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="bg-[#151515] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-rose-500 w-full sm:w-48"
                />
                <select
                  value={historyTypeFilter}
                  onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  className="bg-[#151515] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="all">All Events ({loanHistoryLogs.length})</option>
                  <option value="PAYMENT">EMI Payments Only</option>
                  <option value="LOG">Audit Logs Only</option>
                </select>
              </div>
            </div>

            {/* History Table / Timeline */}
            {filteredHistoryLogs.length === 0 ? (
              <div className="glass-card-static p-12 text-center text-gray-400 space-y-2">
                <span className="text-3xl block">📜</span>
                <p className="text-sm font-bold text-white">No Loan History Found</p>
                <p className="text-xs text-gray-500">Record loan payments or EMIs to see history logged here automatically.</p>
              </div>
            ) : (
              <div className="glass-card-static rounded-2xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto relative">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="sticky top-0 z-10 bg-[#151515] border-b border-white/10 shadow-md">
                      <tr className="border-b border-white/10 bg-[#151515]">
                        <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-[--text-muted]">Date</th>
                        <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-[--text-muted]">Category / Title</th>
                        <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-[--text-muted]">Event Type</th>
                        <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-[--text-muted]">Particulars / Details</th>
                        <th className="px-5 py-3 text-xs font-black uppercase tracking-wider text-[--text-muted] text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {filteredHistoryLogs.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-gray-300 font-mono">
                            {(() => {
                              try {
                                return format(new Date(item.date), "MMM d, yyyy • HH:mm");
                              } catch {
                                return item.date;
                              }
                            })()}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-white">
                            {item.title}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[0.5625rem] font-black uppercase tracking-wider border ${item.badgeColor}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-400 max-w-xs truncate">
                            {item.details}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-white whitespace-nowrap">
                            {item.amount !== null && item.amount !== undefined ? (
                              <span className={item.type === "PAYMENT" ? "text-emerald-400" : "text-rose-400"}>
                                {item.type === "PAYMENT" ? "-" : ""}₹{Number(item.amount).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? "Update Liability" : "Record Liability"}
          variant="center"
          width="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Liability Name</label>
                <input required className="input-premium !h-10 text-xs" placeholder="e.g. HDFC Home Loan" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Category</label>
                <select aria-label="Select liability category" id="liability-category" name="category" className="input-premium !h-10 text-xs text-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c.label} value={c.label} className="bg-[#181A20] text-white font-medium">{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Total Principal (₹)</label>
                <input required type="number" className="input-premium !h-10 text-xs tabular-nums" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Remaining Balance (₹)</label>
                <input required type="number" className="input-premium !h-10 text-xs tabular-nums" value={formData.remaining_amount} onChange={e => setFormData({...formData, remaining_amount: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Interest Rate (%)</label>
                <input type="number" step="0.01" className="input-premium !h-10 text-xs tabular-nums" value={formData.interest_rate} onChange={e => setFormData({...formData, interest_rate: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Monthly EMI (₹)</label>
                <input type="number" className="input-premium !h-10 text-xs tabular-nums" value={formData.monthly_payment} onChange={e => setFormData({...formData, monthly_payment: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Next Due Date</label>
                <input type="date" className="input-premium !h-10 text-xs" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} autoComplete="new-password" />
              </div>
              {!editingId ? (
                <div className="space-y-1.5">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Destination Account (Optional)</label>
                  <select aria-label="Select account" id="liability-account" name="account_id" className="input-premium !h-10 text-xs text-white" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                    <option value="">No Transaction</option>
                    {accounts.map(acc => {
                      const symbol = acc.currency === "USD" ? "$" : "₹";
                      const nameLabel = acc.bank_name && acc.bank_name.trim().toLowerCase() !== acc.name.trim().toLowerCase()
                        ? `${acc.bank_name} (${acc.name})`
                        : acc.name;
                      return (
                        <option key={acc.id} value={acc.id}>
                          {nameLabel} — {symbol}{acc.balance.toLocaleString()}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5 opacity-60">
                  <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Destination Account</label>
                  <input className="input-premium !h-10 text-xs bg-white/5 cursor-not-allowed text-[--text-muted]" value="N/A" disabled />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[0.625rem] font-bold uppercase tracking-wider text-[--text-muted]">Notes / Account Number</label>
                <input type="text" className="input-premium !h-10 text-xs" placeholder="Optional notes..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} autoComplete="new-password" />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button 
                type="button" 
                onClick={() => { setShowAddModal(false); setEditingId(null); }} 
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/10"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submitting} 
                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                {submitting ? "Processing..." : (editingId ? "Update Record" : "Register Liability")}
              </button>
            </div>
          </form>
        </Drawer>
      )}

      {/* Delete Liability Custom Modal */}
      {deletingLiabilityId && (
        <Drawer isOpen={!!deletingLiabilityId} onClose={() => setDeletingLiabilityId(null)} title="Delete Debt Record?" variant="center">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Debt Record</h3>
                <p className="text-xs text-[--text-muted]">Are you sure you want to permanently purge this debt record?</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setDeletingLiabilityId(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={confirmDeleteLiability} className="btn-danger flex-1" disabled={submitting}>
                {submitting ? "Deleting..." : "Delete Liability"}
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
