"use client";

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { toast } from "react-hot-toast";
import useSWR from "swr";

import { createClient } from "@/lib/supabase-browser";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, subMonths, parseISO } from "date-fns";
import { Edit2, Trash2, Send, Plus, Users, History, TrendingUp, PieChart as PieIcon, Download } from "lucide-react";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "@/components/ui/recharts";

const FAMILY_PALETTE = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#f43f5e"];
import {
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  processFamilyTransfer,
  deleteFamilyTransfer,
} from "./actions";

/* ── Types ── */
type Member = {
  id: string;
  name: string;
  relationship: string;
  balance: number | string;
  avatar_url?: string | null;
  created_at: string;
  user_id: string;
};

type Transfer = {
  id: string;
  family_member_id: string;
  account_id: string;
  amount: number;
  type: string;
  transfer_date: string;
  note: string | null;
  user_id: string;
};

const RELATIONSHIPS = ["Parent", "Spouse", "Child", "Sibling", "Other"];
const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const supabase = createClient();

function getMemberAvatar(name: string | null | undefined, relationship: string | null | undefined, avatarUrl?: string | null | undefined): string | null {
  if (avatarUrl && avatarUrl.trim().length > 0) return avatarUrl.trim();
  if (!name || !relationship) return null;
  const rel = relationship.toLowerCase();
  const nm = name.toLowerCase();
  if (rel === "parent") {
    if (nm.includes("mother") || nm.includes("mom") || nm.includes("mummy") || nm.includes("maa") || nm.includes("mrs")) {
      return "/avatar_mother.png";
    }
    if (nm.includes("father") || nm.includes("dad") || nm.includes("papa") || nm.includes("daddy") || nm.includes("mr")) {
      return "/avatar_father.png";
    }
    if (nm.length === 0) return "/avatar_father.png";
    return nm.charCodeAt(0) % 2 === 0 ? "/avatar_mother.png" : "/avatar_father.png";
  }
  if (rel === "spouse") {
    if (nm.includes("wife") || nm.includes("spouse (f)") || nm.includes("her") || nm.includes("mrs")) {
      return "/avatar_mother.png";
    }
    return "/avatar_father.png";
  }
  if (rel === "sibling") {
    if (nm.includes("sister") || nm.includes("didi") || nm.includes("her")) {
      return "/avatar_mother.png";
    }
    if (nm.includes("brother") || nm.includes("bhai") || nm.includes("him")) {
      return "/avatar_father.png";
    }
  }
  return null;
}

function formatTransferDate(dateValue: string | null | undefined): string {
  if (!dateValue) return "N/A";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return format(parsed, "MMM d, yyyy");
}

export default function FamilyClient() {
  const { data: { accounts } = { accounts: [] }, mutate: mutateFinance } = useFinanceData();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const [submitting, withLock] = useSubmitLock();

  /* ── SWR for family data ── */
  const { data: familyData, mutate } = useSWR("finance_family", async () => {
    const [membersRes, transfersRes] = await Promise.all([
      supabase.from("family_members").select("*").order("created_at", { ascending: false }),
      supabase.from("family_transfers").select("*").order("transfer_date", { ascending: false }),
    ]);
    return {
      members: (membersRes.data ?? []) as Member[],
      transfers: (transfersRes.data ?? []) as Transfer[],
    };
  }, {
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  /* ── Month & Year Filter State ── */
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [showAllTime, setShowAllTime] = useState(false);

  const members = useMemo(() => familyData?.members ?? [], [familyData?.members]);
  const transfers = useMemo(() => familyData?.transfers ?? [], [familyData?.transfers]);

  const totalFamilyNetWorth = useMemo(() => {
    return members.reduce((acc, m) => acc + Number(m.balance || 0), 0);
  }, [members]);

  const monthTransfers = useMemo(() => {
    if (showAllTime) return transfers;
    return transfers.filter((t) => {
      if (!t.transfer_date) return false;
      try {
        const d = parseISO(t.transfer_date);
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
      } catch {
        return false;
      }
    });
  }, [transfers, selectedMonth, selectedYear, showAllTime]);

  const totalSentSelectedPeriod = useMemo(() => {
    return monthTransfers.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [monthTransfers]);

  const avgTransferAmount = useMemo(() => {
    if (!monthTransfers.length) return 0;
    const total = monthTransfers.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    return total / monthTransfers.length;
  }, [monthTransfers]);

  const pieChartData = useMemo(() => {
    if (!members.length) return [];
    
    // Per-member support in selected month/period
    const memberSpendMap: Record<string, number> = {};
    monthTransfers.forEach((t) => {
      if (!t.family_member_id) return;
      memberSpendMap[t.family_member_id] = (memberSpendMap[t.family_member_id] || 0) + Number(t.amount || 0);
    });

    const hasPeriodTransfers = Object.values(memberSpendMap).some((v) => v > 0);

    return members
      .map((m, idx) => ({
        name: m.name,
        value: hasPeriodTransfers ? (memberSpendMap[m.id] || 0) : Number(m.balance || 0),
        fill: FAMILY_PALETTE[idx % FAMILY_PALETTE.length],
      }))
      .filter((d) => d.value > 0);
  }, [members, monthTransfers]);

  const monthlyTrendData = useMemo(() => {
    const monthsMap: Record<string, number> = {};
    const anchorDate = new Date(selectedYear, selectedMonth - 1, 1);
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(anchorDate, i);
      monthsMap[format(d, "MMM yy")] = 0;
    }
    transfers.forEach((t) => {
      if (!t.transfer_date) return;
      try {
        const key = format(parseISO(t.transfer_date), "MMM yy");
        if (monthsMap[key] !== undefined) {
          monthsMap[key] += Number(t.amount || 0);
        }
      } catch {
        // ignore parse error
      }
    });
    return Object.entries(monthsMap).map(([month, amount]) => ({ month, amount }));
  }, [transfers, selectedMonth, selectedYear]);

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<"directory" | "history">("directory");
  const [historySearch, setHistorySearch] = useState("");

  /* ── Modal state ── */
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  /* ── Form state ── */
  const [memberForm, setMemberForm] = useState<{ name: string; relationship: string; avatar_url: string }>({ name: "", relationship: RELATIONSHIPS[0], avatar_url: "" });
  const [transferForm, setTransferForm] = useState({ family_member_id: "", account_id: "", amount: "", note: "" });

  /* ── Auto-open from URL ── */
  useEffect(() => {
    const action = searchParams?.get("action");
    if (action === "new") {
      setTimeout(() => setShowMemberModal(true), 0);
    } else if (action === "send") {
      setTimeout(() => setShowTransferModal(true), 0);
    }
  }, [searchParams]);

  /* ── Pre-fill account defaults ── */
  useEffect(() => {
    if (accounts.length > 0 && !transferForm.account_id) {
      setTimeout(() => setTransferForm(prev => ({ ...prev, account_id: accounts[0].id })), 0);
    }
  }, [accounts, transferForm.account_id]);

  /* ── Helpers ── */
  const getMemberName = useCallback((id: string) => {
    return members.find(m => m.id === id)?.name ?? "Unknown";
  }, [members]);

  const filteredTransfers = useMemo(() => {
    const baseList = monthTransfers;
    if (!historySearch.trim()) return baseList;
    const q = historySearch.toLowerCase();
    return baseList.filter(t => {
      const memberName = getMemberName(t.family_member_id).toLowerCase();
      const note = (t.note || "").toLowerCase();
      return memberName.includes(q) || note.includes(q);
    });
  }, [monthTransfers, historySearch, getMemberName]);

  const resetMemberForm = () => {
    setMemberForm({ name: "", relationship: RELATIONSHIPS[0], avatar_url: "" });
    setEditingMember(null);
  };

  const openEditMember = (m: Member) => {
    setEditingMember(m);
    setMemberForm({ name: m.name, relationship: m.relationship, avatar_url: m.avatar_url || "" });
    setShowMemberModal(true);
  };

  const resetTransferForm = () => {
    setTransferForm({ family_member_id: "", account_id: accounts[0]?.id ?? "", amount: "", note: "" });
  };

  /* ── Handlers ── */
  async function handleAddEditMember() {
    await withLock(async () => {
      if (editingMember) {
        const res = await updateFamilyMember(editingMember.id, memberForm);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Family member updated successfully");
      } else {
        const res = await addFamilyMember(memberForm);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Family member added successfully");
      }
      resetMemberForm();
      setShowMemberModal(false);
      mutate();
      mutateFinance();
    });
  }

  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null);

  async function confirmDeleteMember() {
    if (!deletingMemberId) return;
    await withLock(async () => {
      const res = await deleteFamilyMember(deletingMemberId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Family member deleted successfully");
      setDeletingMemberId(null);
      mutate();
      mutateFinance();
    });
  }

  async function handleSendMoney() {
    await withLock(async () => {
      const res = await processFamilyTransfer({
        family_member_id: transferForm.family_member_id,
        account_id: transferForm.account_id,
        amount: Number(transferForm.amount),
        type: "gift",
        note: transferForm.note || undefined,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Transfer recorded successfully");
      resetTransferForm();
      setShowTransferModal(false);
      mutate();
      mutateFinance();
    });
  }

  function handleDeleteMember(id: string) {
    setDeletingMemberId(id);
  }

  async function confirmDeleteTransfer() {
    if (!deletingTransferId) return;
    await withLock(async () => {
      const res = await deleteFamilyTransfer(deletingTransferId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Transfer record deleted successfully");
      setDeletingTransferId(null);
      mutate();
      mutateFinance();
    });
  }

  function handleDeleteTransfer(transferId: string) {
    setDeletingTransferId(transferId);
  }

  function exportTransferCSV() {
    if (!filteredTransfers.length) {
      toast.error("No transfer records to export");
      return;
    }
    const headers = ["Date", "Recipient", "From Account", "Amount (INR)", "Note"];
    const rows = filteredTransfers.map(tr => [
      formatTransferDate(tr.transfer_date),
      `"${getMemberName(tr.family_member_id).replace(/"/g, '""')}"`,
      `"${(accounts.find(a => a.id === tr.account_id)?.name || "Unknown Account").replace(/"/g, '""')}"`,
      tr.amount,
      `"${(tr.note || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `family_transfers_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Family transfer statement exported to CSV");
  }




  function openSendMoney(memberId?: string) {
    if (accounts.length === 0) {
      toast.error("Add an account before sending money");
      return;
    }
    setTransferForm(prev => ({
      family_member_id: memberId ?? prev.family_member_id,
      account_id: prev.account_id || accounts[0]?.id || "",
      amount: "",
      note: "",
    }));
    setShowTransferModal(true);
  }

  function openSendAllowance(memberId: string, amount: string, note: string) {
    setTransferForm({
      family_member_id: memberId,
      account_id: accounts[0]?.id || "",
      amount,
      note
    });
    setShowTransferModal(true);
  }

  if (!mounted) return null;

  const isLoading = !familyData;

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card-static" style={{ height: 120, borderRadius: "var(--radius-xl)" }}>
              <div style={{ padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-elevated)", animation: "pulse 2s ease-in-out infinite" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ width: "60%", height: 14, borderRadius: 8, background: "var(--bg-elevated)", animation: "pulse 2s ease-in-out infinite" }} />
                  <div style={{ width: "30%", height: 10, borderRadius: 8, background: "var(--bg-elevated)", animation: "pulse 2s ease-in-out infinite" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in text-[#d1d4dc] max-w-7xl mx-auto w-full px-4 py-6">

      {/* ═══ PAGE HEADER & MONTH SWITCHER ═══ */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Family Tracker</h1>
          <p className="text-xs text-[--text-muted] font-black uppercase tracking-[0.3em] mt-1.5">
            Log and monitor money sent to family members
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Month Switcher Controls */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1.5 rounded-xl shadow-lg">
            <button
              type="button"
              onClick={() => {
                setShowAllTime(false);
                if (selectedMonth === 1) {
                  setSelectedMonth(12);
                  setSelectedYear((prev) => prev - 1);
                } else {
                  setSelectedMonth((prev) => prev - 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-black text-[--text-muted] hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
              aria-label="Previous month"
            >
              ◀
            </button>

            <div className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-pink-400 select-none min-w-[90px] text-center">
              {format(new Date(selectedYear, selectedMonth - 1, 1), "MMM yyyy")}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAllTime(false);
                if (selectedMonth === 12) {
                  setSelectedMonth(1);
                  setSelectedYear((prev) => prev + 1);
                } else {
                  setSelectedMonth((prev) => prev + 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-black text-[--text-muted] hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          <div className="flex gap-2">
            <button
              className="relative bg-gradient-to-r from-pink-500 to-rose-600 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_25px_rgba(236,72,153,0.5)] flex items-center gap-2 active:scale-95 cursor-pointer"
              onClick={() => openSendMoney()}
              disabled={members.length === 0}
            >
              <Send className="w-3.5 h-3.5" />
              Send Money
            </button>
            <button
              className="bg-[#1e1e1e] hover:bg-white/5 text-white border border-white/10 hover:border-white/20 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 active:scale-95 cursor-pointer"
              onClick={() => { resetMemberForm(); setShowMemberModal(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Member
            </button>
          </div>
        </div>
      </div>

      {/* ═══ STATS OVERVIEW ═══ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Support (All Time)",
            value: fmt.format(Number(totalFamilyNetWorth)),
            subtext: "Cumulative family transfers",
            color: "text-white",
          },
          {
            label: `Monthly Outflow (${format(new Date(selectedYear, selectedMonth - 1, 1), "MMM yyyy")})`,
            value: fmt.format(Number(totalSentSelectedPeriod)),
            subtext: `${format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM")} outflow`,
            color: "text-pink-400",
          },
          {
            label: "Active Members",
            value: members.length.toString(),
            subtext: members.length === 1 ? "Registered family member" : "Registered family members",
            color: "text-rose-400",
          },
          {
            label: "Avg. Transfer Size",
            value: monthTransfers.length > 0 ? fmt.format(avgTransferAmount) : "—",
            subtext: `${format(new Date(selectedYear, selectedMonth - 1, 1), "MMM yyyy")} average`,
            color: "text-fuchsia-400",
          },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-6 border-white/5 flex flex-col justify-between min-h-[120px]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">{s.label}</p>
            <p className={`text-2xl font-black tracking-tight truncate ${s.color} mt-2`} title={s.value}>
              {s.value}
            </p>
            <p className="text-xs font-medium text-[--text-secondary] mt-1 truncate">
              {s.subtext}
            </p>
          </div>
        ))}
      </section>

      {/* ═══ CHARTS & ANALYTICS ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Monthly Transfer Activity Area Chart */}
        <div className="glass-card-static p-6 lg:col-span-2 min-h-[360px] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-pink-400" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">6-Month Support Flow</h3>
              </div>
              <p className="text-xl font-black text-white mt-1">Monthly Family Cashflow Trend</p>
            </div>
          </div>
          <div className="w-full h-[240px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="familyFlowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
                    itemStyle={{ color: "#fff", fontWeight: "bold" }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, "Transferred"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#familyFlowGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Member Support Pie Breakdown */}
        <div className="glass-card-static p-6 flex flex-col justify-between min-h-[360px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Allocation Split</h3>
            </div>
          </div>
          <p className="text-xl font-black text-white">Support by Member</p>
          <div className="w-full h-[200px] my-auto">
            {mounted && pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                    itemStyle={{ color: "#fff", fontWeight: "bold" }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, "Total Received"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                <span className="text-2xl mb-1">👨‍👩‍👧‍👦</span>
                <span className="text-[0.6875rem] uppercase tracking-wider font-bold">No Transfer Data Yet</span>
              </div>
            )}
          </div>
          {pieChartData.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {pieChartData.slice(0, 4).map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span className="text-white font-bold">{entry.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ TABS SWITCHER ═══ */}
      <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-2xl mb-8 max-w-md">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "directory"
              ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]"
              : "text-[--text-muted] hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Family Directory
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "history"
              ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]"
              : "text-[--text-muted] hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Transfer History
        </button>
      </div>

      {activeTab === "directory" ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {members.length === 0 ? (
            <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[350px] border-white/5">
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/15 to-rose-600/15 border border-pink-500/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(236,72,153,0.3)]">
                  <span className="text-3xl">👥</span>
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">No family members registered</h3>
              <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">
                Add family members to keep track of allowances, support, and gifts.
              </p>
              <div className="mt-8 flex justify-center">
                <button onClick={() => { resetMemberForm(); setShowMemberModal(true); }} className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(236,72,153,0.3)] active:scale-95 cursor-pointer">Add Member</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {members.map((member) => {
                const balance = Number(member.balance || 0);
                const initials = member.name.trim().charAt(0).toUpperCase() || "?";
                const avatar = getMemberAvatar(member.name, member.relationship, member.avatar_url);
                const memberTransfers = transfers.filter(t => t.family_member_id === member.id);
                const lastTransfer = memberTransfers[0];
                const monthSent = monthTransfers.filter(t => t.family_member_id === member.id).reduce((acc, t) => acc + Number(t.amount || 0), 0);

                return (
                  <div 
                    key={member.id} 
                    className="glass-card rich-border flex flex-col min-h-[260px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1 group"
                    style={{
                      ['--hover-border-color' as any]: "#ec4899",
                      ['--hover-glow-shadow' as any]: "0 12px 30px -10px rgba(236, 72, 153, 0.25)"
                    }}
                  >
                    {/* Top 3px Accent Line matching Account cards */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500" />
                    
                    {/* Top Header: Badge, Avatar & Quick Edit */}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          {member.relationship ?? "Family Member"}
                        </span>
                        <div className="flex items-center gap-3 mt-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 via-rose-500/15 to-purple-500/20 border border-pink-500/30 flex items-center justify-center p-1 shadow-lg shadow-pink-500/10">
                             {avatar ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={avatar} alt={member.name} className="w-12 h-12 rounded-xl object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-rose-700 flex items-center justify-center text-white font-black text-lg">
                                {initials}
                              </div>
                            )}

                          </div>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => openEditMember(member)} 
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-white transition-all cursor-pointer"
                        title="Edit member"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Bottom Details Section matching Account card structure */}
                    <div className="mt-auto">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white truncate" title={member.name}>{member.name}</h3>
                        {member.relationship === "Child" && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openSendAllowance(member.id, "500", "Allowance Support"); }}
                            className="text-[9.5px] font-black uppercase text-pink-400 hover:text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md cursor-pointer transition-all active:scale-95 shrink-0"
                          >
                            👶 Allowance
                          </button>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-[--text-muted] truncate mt-0.5">
                        This Month: <span className="text-pink-400 font-bold">{fmt.format(monthSent)}</span>
                        {lastTransfer && (
                          <span className="opacity-75 ml-1">
                            • Last: {fmt.format(Number(lastTransfer.amount))}
                          </span>
                        )}
                      </p>
                      <div className="mt-2">
                        <span className="text-[0.5625rem] font-black uppercase tracking-widest text-[--text-muted]">Total Sent</span>
                        <p className="text-2xl font-black text-pink-400 mt-0.5">{fmt.format(balance)}</p>
                      </div>

                      {/* Action Buttons Row matching Account Cards */}
                      <div className="flex gap-2 mt-6">
                        <button
                          type="button"
                          className="flex-1 h-11 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:shadow-[0_0_25px_rgba(236,72,153,0.5)] active:scale-95 cursor-pointer"
                          onClick={() => openSendMoney(member.id)}
                        >
                          <Send className="w-4 h-4" />
                          Send Money
                        </button>
                        <button
                          type="button"
                          className="w-11 h-11 rounded-xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                          onClick={() => handleDeleteMember(member.id)}
                          disabled={submitting}
                          title="Delete member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card-static rounded-2xl overflow-hidden border border-white/5">
            <div className="p-4 md:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  placeholder="Search transfers..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="input-premium pl-9 py-2 text-sm w-full sm:w-64 !bg-black/20"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[--text-muted]">
                  Period: <span className="text-pink-400 font-extrabold">{showAllTime ? "All Time" : format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy")}</span>
                </span>
                {!showAllTime && (
                  <button
                    type="button"
                    onClick={() => setShowAllTime(true)}
                    className="text-[10px] font-black uppercase text-pink-400 hover:text-pink-300 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95"
                  >
                    View All Time
                  </button>
                )}
                <button
                  type="button"
                  onClick={exportTransferCSV}
                  className="text-[10px] font-black uppercase text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                  title="Export transfers statement as CSV"
                >
                  <Download className="w-3 h-3 text-pink-400" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/5 text-[0.5625rem] text-[--text-muted] uppercase font-black tracking-widest bg-black/40">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Recipient</th>
                    <th className="py-4 px-6">From Account</th>
                    <th className="py-4 px-6">Note</th>
                    <th className="py-4 px-6 text-right">Amount</th>
                    <th className="py-4 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransfers.map((tr) => {
                    const memberName = getMemberName(tr.family_member_id);
                    const accountName = accounts.find(a => a.id === tr.account_id)?.name || "Unknown Account";

                    return (
                      <tr key={tr.id} className="hover:bg-white/[0.01] transition-colors group">
                        <td className="py-4 px-6 text-[12px] font-bold text-white/80">
                          {formatTransferDate(tr.transfer_date)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[12px] font-bold text-white">{memberName}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[12px] font-medium text-[--text-secondary]">{accountName}</span>
                        </td>
                        <td className="py-4 px-6 max-w-xs truncate">
                          <span className="text-[12px] text-[--text-muted]" title={tr.note || ""}>{tr.note || "—"}</span>
                        </td>
                        <td className="py-4 px-6 text-right tabular-nums">
                          <span className="text-sm font-black text-rose-400">
                            -{fmt.format(Number(tr.amount))}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteTransfer(tr.id)}
                            className="p-1.5 text-[--text-muted] hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-all cursor-pointer rounded-lg hover:bg-rose-500/10"
                            title="Delete transfer record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransfers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs font-bold text-[--text-muted] uppercase tracking-[0.3em]">
                        {showAllTime 
                          ? "No historical records detected" 
                          : `No transfers recorded for ${format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy")}`}
                        {!showAllTime && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => setShowAllTime(true)}
                              className="text-[11px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 rounded-xl shadow-md hover:shadow-pink-500/25 transition-all cursor-pointer"
                            >
                              Show All Time Transfers
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Add/Edit Member Modal */}
      {showMemberModal && (
        <ModalOverlay onClose={() => { setShowMemberModal(false); resetMemberForm(); }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: "0 0 1.25rem" }}>
            {editingMember ? "Edit Member Details & Photo" : "Add Family Member"}
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); handleAddEditMember(); }} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Live Profile Photo Preview & Avatar Setting */}
            <div className="flex items-center gap-4 p-3 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 via-rose-500/15 to-purple-500/20 border border-pink-500/30 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-lg shadow-pink-500/10">
                {memberForm.avatar_url ? (
                  <img src={memberForm.avatar_url} alt="Profile preview" className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-rose-700 flex items-center justify-center text-white font-black text-lg">
                    {memberForm.name.trim().charAt(0).toUpperCase() || "👤"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white uppercase tracking-wider">Profile Representation</p>
                <p className="text-[0.625rem] text-[--text-muted] mt-0.5">Select a preset avatar or upload image below</p>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Name</label>
              <input
                className="input-premium"
                placeholder="Enter member name"
                value={memberForm.name}
                onChange={e => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
                autoFocus
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={labelStyle}>Relationship</label>
              <select
                className="input-premium"
                value={memberForm.relationship}
                onChange={e => setMemberForm(prev => ({ ...prev, relationship: e.target.value }))}
                style={{ width: "100%" }}
              >
                {RELATIONSHIPS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Profile Photo Settings */}
            <div>
              <label style={labelStyle}>Profile Photo / Avatar Settings</label>
              <div className="space-y-2">
                {/* Preset Avatars */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    { label: "👨 Father", url: "/avatar_father.png" },
                    { label: "👩 Mother", url: "/avatar_mother.png" },
                    { label: "👦 Son", url: "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=150&auto=format&fit=crop&q=80" },
                    { label: "👧 Daughter", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
                    { label: "👴 Grandpa", url: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80" },
                    { label: "👵 Grandma", url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setMemberForm(prev => ({ ...prev, avatar_url: preset.url }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        memberForm.avatar_url === preset.url
                          ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                          : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Photo URL Input & File Upload */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input-premium text-xs flex-1"
                    placeholder="Paste image URL (https://...) or upload photo"
                    value={memberForm.avatar_url}
                    onChange={e => setMemberForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                  />
                  <label className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 border border-pink-400/30 rounded-xl text-xs font-bold text-white cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-md active:scale-95">
                    <span>📷 Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const dataUrl = event.target?.result as string;
                            if (!dataUrl) return;

                            const img = document.createElement("img");
                            img.onload = () => {
                              try {
                                const canvas = document.createElement("canvas");
                                const MAX_SIZE = 300;
                                let width = img.width;
                                let height = img.height;
                                if (width > height) {
                                  if (width > MAX_SIZE) {
                                    height = Math.round((height * MAX_SIZE) / width);
                                    width = MAX_SIZE;
                                  }
                                } else {
                                  if (height > MAX_SIZE) {
                                    width = Math.round((width * MAX_SIZE) / height);
                                    height = MAX_SIZE;
                                  }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext("2d");
                                if (ctx) {
                                  ctx.drawImage(img, 0, 0, width, height);
                                  const compressed = canvas.toDataURL("image/jpeg", 0.85);
                                  setMemberForm(prev => ({ ...prev, avatar_url: compressed }));
                                } else {
                                  setMemberForm(prev => ({ ...prev, avatar_url: dataUrl }));
                                }
                              } catch {
                                setMemberForm(prev => ({ ...prev, avatar_url: dataUrl }));
                              }
                            };
                            img.onerror = () => {
                              setMemberForm(prev => ({ ...prev, avatar_url: dataUrl }));
                            };
                            img.src = dataUrl;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {memberForm.avatar_url && (
                    <button
                      type="button"
                      onClick={() => setMemberForm(prev => ({ ...prev, avatar_url: "" }))}
                      className="px-2.5 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 cursor-pointer transition-all"
                      title="Clear photo"
                    >
                      Clear ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(236,72,153,0.3)] active:scale-95 cursor-pointer disabled:opacity-50"
                disabled={submitting || !memberForm.name.trim()}
                style={{ flex: 1 }}
              >
                {submitting ? "Saving..." : editingMember ? "Update Member" : "Add Member"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowMemberModal(false); resetMemberForm(); }}
                style={{ fontWeight: 700 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* Send Money Modal */}
      {showTransferModal && (
        <ModalOverlay onClose={() => { setShowTransferModal(false); resetTransferForm(); }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: "0 0 1.25rem" }}>
            💸 Send Money
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Family Member</label>
              <select
                className="input-premium"
                value={transferForm.family_member_id}
                onChange={e => setTransferForm(prev => ({ ...prev, family_member_id: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="">Select member</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>From Account</label>
              <select
                className="input-premium"
                value={transferForm.account_id}
                onChange={e => setTransferForm(prev => ({ ...prev, account_id: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="">Select account</option>
                {accounts.map(a => {
                  const symbol = a.currency === "USD" ? "$" : "₹";
                  const nameLabel = a.bank_name && a.bank_name.trim().toLowerCase() !== a.name.trim().toLowerCase()
                    ? `${a.bank_name} (${a.name})`
                    : a.name;
                  return (
                    <option key={a.id} value={a.id}>
                      {nameLabel} — {symbol}{Number(a.balance).toLocaleString()}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input
                className="input-premium"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={transferForm.amount}
                onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ width: "100%" }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[500, 1000, 2500, 5000, 10000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTransferForm(prev => ({ ...prev, amount: amt.toString() }))}
                    className="text-[10px] font-black uppercase text-pink-400 hover:text-white bg-pink-500/10 hover:bg-pink-500/30 border border-pink-500/20 px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95"
                  >
                    +₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Note <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
              <input
                className="input-premium"
                placeholder="E.g., pocket money, birthday gift..."
                value={transferForm.note}
                onChange={e => setTransferForm(prev => ({ ...prev, note: e.target.value }))}
                style={{ width: "100%" }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  "🎁 Pocket Money / Gift",
                  "🛒 Groceries & Household",
                  "💊 Medical & Health",
                  "📚 Fees & Education",
                  "🎉 Birthday / Festival",
                  "💸 Monthly Allowance"
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTransferForm(prev => ({ ...prev, note: preset }))}
                    className="text-[10px] font-bold text-[--text-secondary] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-lg cursor-pointer transition-all active:scale-95"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(236,72,153,0.3)] active:scale-95 cursor-pointer disabled:opacity-50"
                onClick={handleSendMoney}
                disabled={submitting || !transferForm.family_member_id || !transferForm.account_id || !transferForm.amount}
                style={{ flex: 1 }}
              >
                {submitting ? "Sending..." : "Send Money"}
              </button>
              <button className="btn-secondary" onClick={() => { setShowTransferModal(false); resetTransferForm(); }} style={{ fontWeight: 700 }}>
                Cancel
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Member Custom Modal */}
      {deletingMemberId && (
        <ModalOverlay onClose={() => setDeletingMemberId(null)}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Delete Family Member?</h3>
          </div>
          <p className="text-xs text-[--text-muted] leading-relaxed mb-6">
            Are you sure you want to delete this family member? This action will also purge their transfer history.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeletingMemberId(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={confirmDeleteMember} className="btn-danger flex-1" disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Transfer Custom Modal */}
      {deletingTransferId && (
        <ModalOverlay onClose={() => setDeletingTransferId(null)}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Delete Transfer Record?</h3>
          </div>
          <p className="text-xs text-[--text-muted] leading-relaxed mb-6">
            Are you sure you want to delete this family transfer record? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeletingTransferId(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={confirmDeleteTransfer} className="btn-danger flex-1" disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ── Modal Overlay Component ── */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="animate-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "1rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-card-static animate-scale-in"
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: "var(--radius-xl)",
          padding: "1.75rem",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Shared label styles ── */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--text-muted)",
  marginBottom: 6,
};
