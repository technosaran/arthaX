"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  UserPlus,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  X,
  Phone,
  Mail,
  Send,
  RotateCcw,
  FileText,
  Coins,
  Wallet,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutGrid,
  List,
  Search,
  Filter,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getFromLocalCache, saveToLocalCache, invalidateCacheKeys } from "@/utils/cacheClient";
import { CACHE_KEYS, getUserCacheKey } from "@/utils/redis";
import { isFamilyTransfer } from "@/utils/expenseFilter";
import BankLogo from "@/components/BankLogo";
import InteractiveLineChart, { LinePoint } from "@/components/charts/InteractiveLineChart";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import {
  getCurrentMonthYear,
  formatMonthDisplay,
  getEarliestDataMonth,
  computeNextMonth,
  computePrevMonth,
} from "@/utils/monthUtils";

// ==========================================
// TypeScript Interfaces
// ==========================================

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  avatar_color: string;
  monthly_allowance: number; // Target monthly support
  current_spending: number;  // Total money sent this cycle
  role: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface FamilyExpenseItem {
  id: string;
  amount: number;
  expense_date: string;
  title?: string | null;
  notes?: string | null;
  account_id?: string | null;
  tags?: string[];
  created_at?: string;
}

// ==========================================
// Constants & Options
// ==========================================

const RELATIONSHIPS = [
  "Parent",
  "Spouse",
  "Child",
  "Sibling",
  "Grandparent",
  "In-law",
  "Relative",
  "Other Dependent",
];

function getRelationshipBadge(rel: string) {
  const r = (rel || "").toLowerCase();
  if (r.includes("child") || r.includes("kid") || r.includes("son") || r.includes("daughter")) {
    return {
      label: rel,
      bg: "rgba(16, 185, 129, 0.12)",
      text: "#34d399",
      border: "rgba(16, 185, 129, 0.3)",
    };
  }
  if (r.includes("spouse") || r.includes("wife") || r.includes("husband") || r.includes("partner")) {
    return {
      label: rel,
      bg: "rgba(244, 63, 94, 0.12)",
      text: "#fb7185",
      border: "rgba(244, 63, 94, 0.3)",
    };
  }
  if (r.includes("parent") || r.includes("mother") || r.includes("father") || r.includes("dad") || r.includes("mom")) {
    return {
      label: rel,
      bg: "rgba(245, 158, 11, 0.12)",
      text: "#fbbf24",
      border: "rgba(245, 158, 11, 0.3)",
    };
  }
  if (r.includes("sibling") || r.includes("brother") || r.includes("sister")) {
    return {
      label: rel,
      bg: "rgba(139, 92, 246, 0.12)",
      text: "#a78bfa",
      border: "rgba(139, 92, 246, 0.3)",
    };
  }
  return {
    label: rel || "Family",
    bg: "rgba(56, 189, 248, 0.12)",
    text: "#38bdf8",
    border: "rgba(56, 189, 248, 0.3)",
  };
}

const AVATAR_COLORS = [
  "#10B981", // Modern Vibrant Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#F43F5E", // Modern Rose / Red
  "#14B8A6", // Teal
  "#E11D48", // Rose
];

export default function FamilySection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Multi-tier cache keys
  const membersKey = getUserCacheKey(user?.id, CACHE_KEYS.FAMILY_MEMBERS);

  // Active month in YYYY-MM format with strict boundary constraints
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => getCurrentMonthYear());
  const [isAllTime, setIsAllTime] = useState<boolean>(false);

  // States initialized from 0ms Tier 1/2 Local Cache
  const [members, setMembers] = useState<FamilyMember[]>(() => getFromLocalCache<FamilyMember[]>(membersKey) || []);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [familyExpenses, setFamilyExpenses] = useState<FamilyExpenseItem[]>([]);
  const [chartMode, setChartMode] = useState<"spending" | "allowance">("spending");
  const [activeTab, setActiveTab] = useState<"members" | "history">("members");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyMemberFilter, setHistoryMemberFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(() => members.length === 0);
  const [submitting, setSubmitting] = useState(false);

  // Add / Edit Member Modal
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  // Send Money / Log Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferMember, setTransferMember] = useState<FamilyMember | null>(null);
  const [transferAmountInput, setTransferAmountInput] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [transferAccountId, setTransferAccountId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  // Reset Spending Cycle Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetMember, setResetMember] = useState<FamilyMember | null>(null);

  // Currency Formatter
  const formatINR = useCallback((val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  }, []);

  // ==========================================
  // Fetch Family Members & Accounts
  // ==========================================
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = createClient();

      const [mRes, aRes, expRes] = await Promise.all([
        supabase.from("family_members").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("accounts").select("id, name, type, balance").eq("user_id", user.id).order("name", { ascending: true }),
        supabase
          .from("expenses")
          .select("id, amount, expense_date, title, notes, account_id, tags, created_at")
          .eq("user_id", user.id)
          .or("category.eq.Family & Child Care,title.ilike.%Money sent to%")
          .order("expense_date", { ascending: false }),
      ]);

      if (mRes.data) {
        const mappedMembers: FamilyMember[] = mRes.data.map((item: any) => ({
          ...item,
          monthly_allowance: Number(item.monthly_allowance) || 0,
          current_spending: Number(item.current_spending) || 0,
        }));
        setMembers(mappedMembers);
        saveToLocalCache(membersKey, mappedMembers, 3600);
      }

      if (aRes.data) {
        setAccounts(
          aRes.data.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            balance: Number(acc.balance) || 0,
          }))
        );
      }

      if (expRes.data) {
        setFamilyExpenses(
          expRes.data
            .filter((e: any) => isFamilyTransfer(e) || e.category === "Family & Child Care")
            .map((e: any) => ({
              id: e.id,
              amount: Number(e.amount) || 0,
              expense_date: e.expense_date,
              title: e.title,
              notes: e.notes,
              account_id: e.account_id,
              tags: e.tags || [],
              created_at: e.created_at,
            }))
        );
      }
    } catch (err) {
      console.error("[FamilySection] Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [user, membersKey]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel("family_realtime_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "family_members" }, () => fetchAllData())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => fetchAllData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAllData]);

  // ==========================================
  // Month Stepper Constraints & Navigation
  // ==========================================
  const earliestMonthYear = useMemo(() => {
    const dates = [
      ...familyExpenses.map((e) => e.expense_date).filter(Boolean),
      ...members.map((m) => m.created_at?.substring(0, 10)).filter(Boolean) as string[],
    ];
    return getEarliestDataMonth(dates, currentMonthYear);
  }, [familyExpenses, members, currentMonthYear]);

  // Clamp selectedMonthYear so it cannot be in the future or before earliest data
  useEffect(() => {
    if (selectedMonthYear > currentMonthYear) {
      setSelectedMonthYear(currentMonthYear);
    } else if (earliestMonthYear && selectedMonthYear < earliestMonthYear) {
      setSelectedMonthYear(earliestMonthYear);
    }
  }, [selectedMonthYear, currentMonthYear, earliestMonthYear]);

  const canGoPrev = selectedMonthYear > earliestMonthYear;
  const canGoNext = selectedMonthYear < currentMonthYear;
  const isCurrentMonth = selectedMonthYear === currentMonthYear;

  const monthDisplayTitle = useMemo(() => {
    return formatMonthDisplay(selectedMonthYear);
  }, [selectedMonthYear]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setIsAllTime(false);
    setSelectedMonthYear((prev) => computePrevMonth(prev, earliestMonthYear));
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setIsAllTime(false);
    setSelectedMonthYear((prev) => computeNextMonth(prev, currentMonthYear));
  };

  const handleResetToCurrentMonth = () => {
    setIsAllTime(false);
    setSelectedMonthYear(currentMonthYear);
  };

  // ==========================================
  // Calculated Metrics by Selected Month
  // ==========================================

  // Calculate spending for a specific member according to selected month or all-time
  const getMemberSpendingForMonth = useCallback(
    (member: FamilyMember) => {
      const memberName = (member.name || "").trim().toLowerCase();
      const matchingExpenses = familyExpenses.filter((e) => {
        const t = (e.title || "").toLowerCase();
        const n = (e.notes || "").toLowerCase();
        return t.includes(memberName) || n.includes(memberName);
      });

      if (isAllTime) {
        const expSum = matchingExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return Math.max(expSum, Number(member.current_spending) || 0);
      }

      const monthExpenses = matchingExpenses.filter(
        (e) => e.expense_date && e.expense_date.startsWith(selectedMonthYear)
      );
      const expSum = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      // If viewing current month, ensure it reflects at least member.current_spending counter
      if (isCurrentMonth) {
        return Math.max(expSum, Number(member.current_spending) || 0);
      }

      return expSum;
    },
    [familyExpenses, isAllTime, selectedMonthYear, isCurrentMonth]
  );

  const displayedFamilyExpenses = useMemo(() => {
    if (isAllTime) return familyExpenses;
    return familyExpenses.filter((e) => e.expense_date && e.expense_date.startsWith(selectedMonthYear));
  }, [familyExpenses, isAllTime, selectedMonthYear]);

  const filteredFamilyHistory = useMemo(() => {
    let list = displayedFamilyExpenses;

    if (historyMemberFilter !== "all") {
      const q = historyMemberFilter.toLowerCase();
      list = list.filter((item) => {
        const t = (item.title || "").toLowerCase();
        const n = (item.notes || "").toLowerCase();
        return t.includes(q) || n.includes(q);
      });
    }

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter((item) => {
        const t = (item.title || "").toLowerCase();
        const n = (item.notes || "").toLowerCase();
        const acc = accounts.find((a) => a.id === item.account_id);
        const accName = (acc?.name || "").toLowerCase();
        return t.includes(q) || n.includes(q) || accName.includes(q) || String(item.amount).includes(q);
      });
    }

    return [...list].sort((a, b) => {
      const dateA = a.expense_date ? new Date(a.expense_date).getTime() : 0;
      const dateB = b.expense_date ? new Date(b.expense_date).getTime() : 0;
      return dateB - dateA;
    });
  }, [displayedFamilyExpenses, historyMemberFilter, historySearch, accounts]);

  const historyStats = useMemo(() => {
    const totalSent = filteredFamilyHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const count = filteredFamilyHistory.length;
    const avg = count > 0 ? Math.round(totalSent / count) : 0;
    return { totalSent, count, avg };
  }, [filteredFamilyHistory]);

  const formatHistoryDate = useCallback((dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }, []);

  const getRelativeDateTag = useCallback((dateStr: string) => {
    if (!dateStr) return "";
    try {
      const target = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays > 1 && diffDays <= 7) return `${diffDays}d ago`;
      return "";
    } catch {
      return "";
    }
  }, []);

  const totalCurrentSpending = useMemo(() => {
    if (members.length > 0) {
      const membersSum = members.reduce((sum, m) => sum + getMemberSpendingForMonth(m), 0);
      const expenseSum = displayedFamilyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      return Math.max(membersSum, expenseSum);
    }
    return displayedFamilyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [members, getMemberSpendingForMonth, displayedFamilyExpenses]);

  const totalMonthlyAllowance = useMemo(
    () => members.reduce((sum, m) => sum + (Number(m.monthly_allowance) || 0), 0),
    [members]
  );

  const overallPercent = useMemo(
    () => (totalMonthlyAllowance > 0 ? Math.round((totalCurrentSpending / totalMonthlyAllowance) * 100) : 0),
    [totalMonthlyAllowance, totalCurrentSpending]
  );

  const remainingBudget = useMemo(
    () => totalMonthlyAllowance - totalCurrentSpending,
    [totalMonthlyAllowance, totalCurrentSpending]
  );

  const avgSpendingPerMember = useMemo(
    () => (members.length > 0 ? Math.round(totalCurrentSpending / members.length) : 0),
    [members.length, totalCurrentSpending]
  );

  const avgTargetPerMember = useMemo(
    () => (members.length > 0 ? Math.round(totalMonthlyAllowance / members.length) : 0),
    [members.length, totalMonthlyAllowance]
  );

  const activeRecipientsCount = useMemo(
    () => members.filter((m) => getMemberSpendingForMonth(m) > 0).length,
    [members, getMemberSpendingForMonth]
  );

  // ==========================================
  // Visual Charts Calculations (Pie & Line)
  // ==========================================

  // 1. Pie / Donut Chart: Member Support Allocation
  const donutSegments: DonutSegment[] = useMemo(() => {
    if (members.length === 0) return [];

    const isSpending = chartMode === "spending";

    return members
      .map((m) => {
        const val = isSpending
          ? getMemberSpendingForMonth(m)
          : (Number(m.monthly_allowance) || 0);

        return {
          label: m.name,
          value: val,
          color: m.avatar_color || "#10B981",
          subtitle: `${m.relationship} • ${formatINR(val)}`,
        };
      })
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [members, chartMode, getMemberSpendingForMonth, formatINR]);

  const donutTotal = useMemo(() => {
    return chartMode === "spending" ? totalCurrentSpending : totalMonthlyAllowance;
  }, [chartMode, totalCurrentSpending, totalMonthlyAllowance]);

  // 2. Line Chart: 6-Month Timeline Trajectory of Family Support
  const lineChartData: LinePoint[] = useMemo(() => {
    const months: { key: string; label: string; fullLabel: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      const fullLabel = d.toLocaleString("default", { month: "long", year: "numeric" });
      months.push({ key, label, fullLabel, value: 0 });
    }

    if (familyExpenses && familyExpenses.length > 0) {
      familyExpenses.forEach((item) => {
        if (item.expense_date) {
          const itemKey = item.expense_date.substring(0, 7);
          const target = months.find((m) => m.key === itemKey);
          if (target) {
            target.value += Number(item.amount) || 0;
          }
        }
      });
    }

    // Ensure current month displays at least current cycle spending
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthObj = months.find((m) => m.key === currentKey);
    if (currentMonthObj && currentMonthObj.value < totalCurrentSpending && isCurrentMonth) {
      currentMonthObj.value = totalCurrentSpending;
    }

    return months;
  }, [familyExpenses, totalCurrentSpending, isCurrentMonth]);

  // ==========================================
  // Member Operations
  // ==========================================
  const handleSaveMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name")?.toString().trim() || "";
    const relationship = formData.get("relationship")?.toString() || "Parent";
    const monthly_allowance = parseFloat(formData.get("monthly_allowance")?.toString() || "0") || 0;
    const avatar_color = formData.get("avatar_color")?.toString() || "#10B981";
    const phone = formData.get("phone")?.toString().trim() || null;
    const email = formData.get("email")?.toString().trim() || null;
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!name) {
      showToast("Please enter the family member's name", "error");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();

      if (editingMember) {
        const { error } = await supabase
          .from("family_members")
          .update({
            name,
            relationship,
            monthly_allowance,
            avatar_color,
            phone,
            email,
            notes,
          })
          .eq("id", editingMember.id)
          .eq("user_id", user.id);

        if (error) throw error;
        showToast("Family member updated successfully", "success");
      } else {
        const { error } = await supabase.from("family_members").insert({
          user_id: user.id,
          name,
          relationship,
          role: "member",
          monthly_allowance,
          current_spending: 0,
          avatar_color,
          phone,
          email,
          notes,
        });

        if (error) throw error;
        showToast("New family member added", "success");
      }

      setMemberModalOpen(false);
      setEditingMember(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to save family member", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from your family tracker?`)) return;
    if (!user) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from("family_members").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      showToast(`${name} removed`, "success");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete member", "error");
    }
  };

  // ==========================================
  // Log Money Sent / Transfer Operation
  // ==========================================
  const handleLogTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !transferMember) return;
    setSubmitting(true);

    const val = parseFloat(transferAmountInput) || 0;
    if (val <= 0) {
      showToast("Please enter a valid transfer amount", "error");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      const newSpending = Number((Number(transferMember.current_spending || 0) + val).toFixed(2));

      // 1. Update family member's current spending / total sent
      const { error: memberError } = await supabase
        .from("family_members")
        .update({ current_spending: newSpending })
        .eq("id", transferMember.id)
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      // 2. Atomically record as a family support transfer (deducts from account, managed in Family)
      const { error: expError } = await supabase.rpc("fn_record_expense_atomic", {
        p_user_id: user.id,
        p_title: `Money sent to ${transferMember.name}`,
        p_amount: val,
        p_category: "Family & Child Care",
        p_account_id: transferAccountId || null,
        p_expense_date: transferDate || new Date().toISOString().split("T")[0],
        p_notes: transferNotes || `Family support transfer to ${transferMember.name} (${transferMember.relationship})`,
        p_tags: ["family", "transfer"],
      });

      if (expError) throw expError;

      showToast(`Recorded ${formatINR(val)} sent to ${transferMember.name}`, "success");

      setTransferModalOpen(false);
      setTransferMember(null);
      setTransferAmountInput("");
      setTransferNotes("");
      setTransferAccountId("");

      await invalidateCacheKeys([
        membersKey,
        getUserCacheKey(user.id, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(user.id, CACHE_KEYS.EXPENSES),
        getUserCacheKey(user.id, CACHE_KEYS.LEDGER),
      ]);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to record money transfer", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // Reset Spending Cycle to ₹0
  // ==========================================
  const handleResetSpending = async () => {
    if (!user || !resetMember) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("family_members")
        .update({ current_spending: 0 })
        .eq("id", resetMember.id)
        .eq("user_id", user.id);

      if (error) throw error;
      showToast(`Spending cycle reset to ₹0 for ${resetMember.name}`, "success");

      setResetModalOpen(false);
      setResetMember(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to reset spending cycle", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // Delete / Reverse Transfer Record from History
  // ==========================================
  const handleDeleteTransfer = async (expenseId: string, itemTitle?: string | null, itemAmount?: number) => {
    if (!confirm(`Are you sure you want to reverse this transfer record${itemAmount ? ` of ${formatINR(itemAmount)}` : ""}? The debited amount will be refunded to your account balance.`)) return;
    if (!user) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      // Atomically delete expense and refund balance to account
      const { error } = await supabase.rpc("fn_delete_expense_atomic", {
        p_expense_id: expenseId,
        p_user_id: user.id,
      });
      if (error) throw error;

      if (itemTitle && itemAmount) {
        const titleLower = itemTitle.toLowerCase();
        const matchedMember = members.find((m) => titleLower.includes(m.name.toLowerCase()));
        if (matchedMember) {
          const updatedSpending = Math.max(0, Number(matchedMember.current_spending || 0) - itemAmount);
          await supabase
            .from("family_members")
            .update({ current_spending: updatedSpending })
            .eq("id", matchedMember.id)
            .eq("user_id", user.id);
        }
      }

      showToast("Transfer Reversed", `${formatINR(itemAmount || 0)} refunded to your account.`, "success");
      await invalidateCacheKeys([
        membersKey,
        getUserCacheKey(user.id, CACHE_KEYS.ACCOUNTS),
        getUserCacheKey(user.id, CACHE_KEYS.EXPENSES),
        getUserCacheKey(user.id, CACHE_KEYS.LEDGER),
      ]);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete transfer record", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <main
        className="flex-1 h-full p-4 sm:p-8 flex items-center justify-center select-none"
        style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
          <p className="text-xs font-mono opacity-60">Synchronizing family support tracker...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex-1 h-full p-3.5 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* =========================================================================
          Top Header Bar with Month Stepper & Action Buttons
          ========================================================================= */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Family Money Tracker</h1>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold"
              style={{
                backgroundColor: "var(--app-accent-subtle)",
                color: "var(--app-accent)",
                borderColor: "var(--app-border-subtle)",
              }}
            >
              Support & Transfers
            </span>
          </div>
          <p className="text-xs opacity-70 mt-1">
            Track monthly allowances, financial support, and money sent to family members.
          </p>
        </div>

        {/* Action Buttons & Month Stepper on Top Right */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Month Stepper */}
          <div
            className="flex items-center rounded-xl border p-0.5 text-xs font-mono"
            style={{
              borderColor: "var(--app-border-subtle)",
              backgroundColor: "var(--app-card)",
            }}
          >
            <button
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              title={!canGoPrev ? "No earlier transfer records" : "Previous Month"}
              className={`p-1.5 rounded-lg transition-all ${
                !canGoPrev
                  ? "opacity-25 cursor-not-allowed"
                  : "opacity-70 hover:opacity-100 cursor-pointer"
              }`}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 font-semibold min-w-[110px] text-center">
              {monthDisplayTitle}
            </span>
            <button
              onClick={handleNextMonth}
              disabled={!canGoNext}
              title={!canGoNext ? "Future months are not yet available" : "Next Month"}
              className={`p-1.5 rounded-lg transition-all ${
                !canGoNext
                  ? "opacity-25 cursor-not-allowed"
                  : "opacity-70 hover:opacity-100 cursor-pointer"
              }`}
            >
              <ChevronRight size={14} />
            </button>
            {!isCurrentMonth && !isAllTime && (
              <button
                onClick={handleResetToCurrentMonth}
                className="ml-1 px-2 py-1 text-[10px] uppercase font-bold rounded-md border cursor-pointer opacity-70 hover:opacity-100"
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                Today
              </button>
            )}
          </div>

          {/* All Time Toggle */}
          <button
            onClick={() => setIsAllTime(!isAllTime)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
              isAllTime ? "shadow-sm font-bold" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: isAllTime ? "var(--app-fg)" : "var(--app-card)",
              color: isAllTime ? "var(--app-bg)" : "var(--app-fg)",
              borderColor: isAllTime ? "var(--app-fg)" : "var(--app-border-subtle)",
            }}
          >
            All Time
          </button>

          <button
            onClick={() => {
              setEditingMember(null);
              setMemberModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
            style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
          >
            <UserPlus size={14} />
            Add Member
          </button>
        </div>
      </div>

      {/* =========================================================================
          Top 4 KPI Metric Summary Cards
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Family Members */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">Family Members</span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-accent-subtle)" }}
            >
              <Users size={14} style={{ color: "var(--app-accent)" }} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono">{members.length} Members</div>
            <div className="text-xs opacity-60 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{members.filter((m) => m.relationship === "Parent").length} Parents</span>
              <span>•</span>
              <span>{members.filter((m) => m.relationship === "Spouse").length} Spouse</span>
              <span>•</span>
              <span>{members.filter((m) => m.relationship === "Child").length} Children</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Money Sent This Cycle / Selected Month */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">
              {isAllTime ? "All-Time Money Sent" : `Total Money Sent (${monthDisplayTitle})`}
            </span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-emerald-400"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "rgba(16, 185, 129, 0.12)" }}
            >
              <Send size={14} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono text-emerald-400">
              {formatINR(totalCurrentSpending)}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {isAllTime
                ? `Transferred across all recorded months`
                : `Transferred across ${activeRecipientsCount} of ${members.length} members`}
            </div>
          </div>
        </div>

        {/* Card 3: Monthly Support Target / Budget */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">Monthly Support Target</span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-amber-400"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "rgba(245, 158, 11, 0.12)" }}
            >
              <Coins size={14} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono">
              {formatINR(totalMonthlyAllowance)}
            </div>
            <div className="flex items-center justify-between text-xs opacity-60 mt-1">
              <span>{overallPercent}% fulfilled</span>
              <span className="font-mono font-medium" style={{ color: remainingBudget <= 0 ? "var(--app-accent)" : "#F59E0B" }}>
                {remainingBudget <= 0 ? "Target Met ✓" : `${formatINR(remainingBudget)} Remaining`}
              </span>
            </div>
            {/* Progress Bar */}
            <div
              className="w-full h-1.5 rounded-full mt-2 overflow-hidden"
              style={{ backgroundColor: "var(--app-track-bg)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, overallPercent)}%`,
                  backgroundColor:
                    totalCurrentSpending > totalMonthlyAllowance
                      ? "var(--app-loss)"
                      : totalCurrentSpending >= totalMonthlyAllowance * 0.8
                      ? "#F59E0B"
                      : "var(--app-accent)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Average Support Per Member */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">Avg Support / Member</span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-sky-400"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "rgba(56, 189, 248, 0.12)" }}
            >
              <Wallet size={14} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono text-sky-400">
              {formatINR(avgSpendingPerMember)}
            </div>
            <div className="flex items-center justify-between text-xs opacity-60 mt-1">
              <span>Target: {formatINR(avgTargetPerMember)}/mo</span>
              <span className="font-mono">
                {activeRecipientsCount} of {members.length} active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: VISUAL CHARTS (LINE CHART + PIE / DONUT CHART SIDE BY SIDE)
          ========================================================================= */}
      {members.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
          {/* Left Card: 6-Month Support Line Chart */}
          <div
            className="lg:col-span-7 rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <InteractiveLineChart
              title="Family Support Trajectory"
              subtitle="6-Month Monthly Outflow & Transfers Trend"
              data={lineChartData}
              color="#10B981"
              gradientId="familySupportGradient"
              formatter={formatINR}
              type="expense"
              emptyMessage="No family transfers recorded in the last 6 months."
            />
          </div>

          {/* Right Card: Member Allocation Pie / Donut Chart */}
          <div
            className="lg:col-span-5 rounded-2xl p-6 border transition-colors shadow-sm flex flex-col justify-between"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div
              className="flex items-center justify-between pb-3 border-b flex-wrap gap-2"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <div className="flex items-center gap-1.5">
                <PieChartIcon size={14} className="text-emerald-400" />
                <h3 className="text-sm font-bold tracking-tight">Support Allocation</h3>
              </div>

              {/* Mode Toggle: Spending vs Allowance */}
              <div
                className="flex items-center p-0.5 rounded-lg border text-[11px] font-mono"
                style={{
                  borderColor: "var(--app-border-subtle)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setChartMode("spending")}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    chartMode === "spending"
                      ? "bg-[var(--app-card)] font-bold text-emerald-400 shadow-sm border border-[var(--app-border)]"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  Sent
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("allowance")}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    chartMode === "allowance"
                      ? "bg-[var(--app-card)] font-bold text-amber-400 shadow-sm border border-[var(--app-border)]"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  Target
                </button>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-center">
              <InteractiveDonutChart
                title="Member Breakdown"
                totalLabel={
                  chartMode === "spending"
                    ? isAllTime
                      ? "All-Time Sent"
                      : `Sent in ${monthDisplayTitle}`
                    : "Monthly Target"
                }
                totalValue={donutTotal}
                segments={donutSegments}
                formatter={formatINR}
                emptyMessage="No spending recorded yet"
                emptySubMessage="Switch to 'Target' view or record transfers to populate."
                size={160}
                strokeWidth={14}
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FAMILY DATA SECTION: TABS (MEMBERS / HISTORY) & CONTROLS
          ========================================================================= */}
      <div className="space-y-4">
        {/* Navigation Tabs Bar & Right Controls Header */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b"
          style={{ borderColor: "var(--app-border)" }}
        >
          {/* Left: Tab Switcher (Family Members vs Transfer History) */}
          <div
            className="inline-flex items-center p-1 rounded-2xl border gap-1 self-start sm:self-auto"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "members"
                  ? "shadow-sm bg-[var(--app-fg)] text-[var(--app-bg)]"
                  : "opacity-60 hover:opacity-100 text-[var(--app-fg)]"
              }`}
            >
              <Users size={14} />
              <span>Family Members</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                  activeTab === "members"
                    ? "bg-[var(--app-bg)] text-[var(--app-fg)] border-transparent"
                    : "opacity-80"
                }`}
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                {members.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "history"
                  ? "shadow-sm bg-[var(--app-fg)] text-[var(--app-bg)]"
                  : "opacity-60 hover:opacity-100 text-[var(--app-fg)]"
              }`}
            >
              <History size={14} />
              <span>Transfer History</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                  activeTab === "history"
                    ? "bg-[var(--app-bg)] text-[var(--app-fg)] border-transparent"
                    : "opacity-80"
                }`}
                style={{ borderColor: "var(--app-border-subtle)" }}
              >
                {displayedFamilyExpenses.length}
              </span>
            </button>
          </div>

          {/* Right Top of Table: Controls & The User's Requested Badge! */}
          <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto">
            {activeTab === "members" ? (
              <>
                {/* Grid / Table View Mode Toggle */}
                <div
                  className="flex items-center rounded-xl border p-0.5"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-card)",
                  }}
                >
                  <button
                    onClick={() => setViewMode("grid")}
                    title="Grid / Cards View"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === "grid" ? "shadow-sm" : "opacity-40 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: viewMode === "grid" ? "var(--app-fg)" : "transparent",
                      color: viewMode === "grid" ? "var(--app-bg)" : "var(--app-fg)",
                    }}
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    title="Table View"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === "table" ? "shadow-sm" : "opacity-40 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: viewMode === "table" ? "var(--app-fg)" : "transparent",
                      color: viewMode === "table" ? "var(--app-bg)" : "var(--app-fg)",
                    }}
                  >
                    <List size={13} />
                  </button>
                </div>

                {/* RIGHT TOP OF TABLE BADGE */}
                <span
                  className="text-xs font-mono px-3 py-1 rounded-xl border font-semibold flex items-center gap-1.5"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-card)",
                  }}
                >
                  {members.length} Members • {isAllTime ? "All Time" : monthDisplayTitle}
                </span>
              </>
            ) : (
              <>
                {/* Search in History */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search transfers..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-7 pr-7 py-1 text-xs rounded-xl border font-sans focus:outline-none w-36 sm:w-48 transition-all"
                    style={{
                      borderColor: "var(--app-border-subtle)",
                      backgroundColor: "var(--app-card)",
                      color: "var(--app-fg)",
                    }}
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Filter by Member Dropdown */}
                {members.length > 0 && (
                  <select
                    value={historyMemberFilter}
                    onChange={(e) => setHistoryMemberFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-xl border font-sans cursor-pointer focus:outline-none"
                    style={{
                      borderColor: "var(--app-border-subtle)",
                      backgroundColor: "var(--app-card)",
                      color: "var(--app-fg)",
                    }}
                  >
                    <option value="all">All Members ({members.length})</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* RIGHT TOP OF TABLE BADGE FOR HISTORY */}
                <span
                  className="text-xs font-mono px-3 py-1 rounded-xl border font-semibold flex items-center gap-1.5"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-card)",
                  }}
                >
                  {filteredFamilyHistory.length} Transfers • {isAllTime ? "All Time" : monthDisplayTitle}
                </span>
              </>
            )}
          </div>
        </div>

        {/* =========================================================================
            TAB 1 CONTENT: FAMILY MEMBERS (GRID OR TABLE VIEW)
            ========================================================================= */}
        {activeTab === "members" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {members.length === 0 ? (
              <div
                className="rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-4"
                style={{ backgroundColor: "var(--app-card)", borderColor: "var(--app-border)" }}
              >
                <div
                  className="w-14 h-14 rounded-2xl border flex items-center justify-center"
                  style={{ backgroundColor: "var(--app-accent-subtle)", borderColor: "var(--app-border-subtle)" }}
                >
                  <Users size={28} style={{ color: "var(--app-accent)" }} />
                </div>
                <div className="max-w-md">
                  <h3 className="text-base font-bold">No Family Members Tracked Yet</h3>
                  <p className="text-xs opacity-70 mt-1">
                    Add your parents, spouse, children, or relatives to track regular financial support, allowances, and money sent to them.
                  </p>
                </div>
                <div className="flex items-center justify-center pt-2">
                  <button
                    onClick={() => {
                      setEditingMember(null);
                      setMemberModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
                  >
                    <UserPlus size={15} />
                    Add First Member
                  </button>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              /* GRID / CARDS VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {members.map((member) => {
                  const cleanName = member.name.replace(/[\(\)\[\]\{\}\.,_-]/g, " ").trim();
                  const initials =
                    cleanName
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || member.name.slice(0, 2).toUpperCase();

                  const displayName = member.name.replace(/\s*\([^)]*\)/g, "").trim() || member.name;
                  const relBadge = getRelationshipBadge(member.relationship);

                  const allowance = Number(member.monthly_allowance) || 0;
                  const spending = getMemberSpendingForMonth(member);
                  const remaining = allowance - spending;
                  const percentSpent = allowance > 0 ? Math.round((spending / allowance) * 100) : 0;

                  return (
                    <div
                      key={member.id}
                      className="group relative rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                      style={{
                        backgroundColor: "var(--app-card)",
                        borderColor: "var(--app-border)",
                      }}
                    >
                      <div
                        className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none opacity-10 blur-3xl transition-opacity group-hover:opacity-25"
                        style={{ backgroundColor: member.avatar_color || "#10B981" }}
                      />

                      <div className="relative z-10">
                        {/* Member Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-md flex-shrink-0 ring-1 ring-white/20 transition-transform group-hover:scale-105"
                              style={{
                                background: `linear-gradient(135deg, ${member.avatar_color || "#10B981"}ee, ${member.avatar_color || "#10B981"}88)`,
                                boxShadow: `0 4px 14px -2px ${(member.avatar_color || "#10B981")}40`,
                              }}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-extrabold tracking-tight truncate capitalize" title={member.name}>
                                {displayName}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border"
                                  style={{
                                    backgroundColor: relBadge.bg,
                                    color: relBadge.text,
                                    borderColor: relBadge.border,
                                  }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: relBadge.text }} />
                                  {relBadge.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => {
                                setEditingMember(member);
                                setMemberModalOpen(true);
                              }}
                              className="w-8 h-8 rounded-xl border flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer"
                              style={{ borderColor: "var(--app-border-subtle)" }}
                              title="Edit Member"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteMember(member.id, member.name)}
                              className="w-8 h-8 rounded-xl border flex items-center justify-center opacity-60 hover:opacity-100 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all cursor-pointer text-rose-400"
                              style={{ borderColor: "var(--app-border-subtle)" }}
                              title="Remove Member"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Financial Box */}
                        <div
                          className="mt-4 p-4 rounded-xl border space-y-3 shadow-xs"
                          style={{
                            backgroundColor: "var(--app-bg)",
                            borderColor: "var(--app-border-subtle)",
                          }}
                        >
                          <div className="flex items-end justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {isAllTime ? "Total Sent" : `Sent in ${monthDisplayTitle}`}
                              </span>
                              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-400 mt-0.5">
                                {formatINR(spending)}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider opacity-60 block">
                                Target Support
                              </span>
                              <div className="text-sm sm:text-base font-extrabold font-mono tracking-tight opacity-90 mt-0.5">
                                {allowance > 0 ? formatINR(allowance) : "None"}
                              </div>
                            </div>
                          </div>

                          <div className="w-full h-2 rounded-full overflow-hidden bg-white/5 ring-1 ring-white/10">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, percentSpent)}%`,
                                background:
                                  spending > allowance && allowance > 0
                                    ? "linear-gradient(90deg, #f43f5e, #e11d48)"
                                    : percentSpent >= 80
                                    ? "linear-gradient(90deg, #10b981, #059669)"
                                    : `linear-gradient(90deg, ${member.avatar_color || "#3b82f6"}, #10b981)`,
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border"
                              style={{
                                borderColor: "var(--app-border-subtle)",
                                backgroundColor: "var(--app-card)",
                                color: "var(--app-fg)",
                              }}
                            >
                              {percentSpent}% fulfilled
                            </span>
                            <span
                              className="font-mono text-[11px] font-bold"
                              style={{
                                color:
                                  allowance === 0
                                    ? "inherit"
                                    : remaining <= 0
                                    ? "#10b981"
                                    : "#f59e0b",
                              }}
                            >
                              {allowance === 0
                                ? "Flexible Support"
                                : remaining <= 0
                                ? "Target Met ✓"
                                : `${formatINR(remaining)} Left`}
                            </span>
                          </div>
                        </div>

                        {/* Notes */}
                        {member.notes && (
                          <div
                            className="mt-3 px-3 py-2 rounded-xl border flex items-start gap-2 text-xs"
                            style={{
                              borderColor: "var(--app-border-subtle)",
                              backgroundColor: "var(--app-bg)",
                            }}
                          >
                            <FileText size={13} className="text-sky-400 flex-shrink-0 mt-0.5 opacity-80" />
                            <span className="opacity-80 line-clamp-2 leading-relaxed italic text-[11px]">
                              &ldquo;{member.notes}&rdquo;
                            </span>
                          </div>
                        )}

                        {/* Contact Chips */}
                        {(member.phone || member.email) && (
                          <div className="flex flex-wrap items-center gap-2 mt-2.5">
                            {member.phone && (
                              <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono opacity-70"
                                style={{
                                  borderColor: "var(--app-border-subtle)",
                                  backgroundColor: "var(--app-bg)",
                                }}
                              >
                                <Phone size={10} className="text-emerald-400" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                            {member.email && (
                              <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono opacity-70"
                                style={{
                                  borderColor: "var(--app-border-subtle)",
                                  backgroundColor: "var(--app-bg)",
                                }}
                              >
                                <Mail size={10} className="text-sky-400" />
                                <span>{member.email}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Send Money & Counter Reset */}
                      <div
                        className="relative z-10 pt-3.5 mt-3.5 border-t flex items-center justify-between gap-2"
                        style={{ borderColor: "var(--app-border-subtle)" }}
                      >
                        <button
                          onClick={() => {
                            setTransferMember(member);
                            setTransferAmountInput("");
                            setTransferDate(new Date().toISOString().split("T")[0]);
                            setTransferNotes("");
                            setTransferAccountId(accounts[0]?.id || "");
                            setTransferModalOpen(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md bg-white text-black hover:bg-neutral-100 hover:scale-[1.01] active:scale-[0.98]"
                        >
                          <Send size={13} className="text-emerald-600" />
                          <span>Send Money</span>
                        </button>

                        <button
                          onClick={() => {
                            setResetMember(member);
                            setResetModalOpen(true);
                          }}
                          className="w-9 h-9 rounded-xl border flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                          style={{
                            borderColor: "var(--app-border-subtle)",
                            backgroundColor: "var(--app-bg)",
                          }}
                          title="Reset monthly spending counter to ₹0"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABULAR VIEW FOR FAMILY MEMBERS */
              <div
                className="rounded-2xl border overflow-hidden shadow-sm transition-colors"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                  color: "var(--app-fg)",
                }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className="border-b text-[11px] font-bold uppercase tracking-wider select-none font-mono opacity-60"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-bg)",
                          color: "var(--app-fg)",
                        }}
                      >
                        <th className="py-3.5 px-4 font-semibold">Member</th>
                        <th className="py-3.5 px-4 font-semibold">Relationship</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Target Support</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Sent This Month</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Remaining</th>
                        <th className="py-3.5 px-4 font-semibold">Progress</th>
                        <th className="py-3.5 px-4 font-semibold">Details / Notes</th>
                        <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--app-border-subtle)" }}>
                      {members.map((member) => {
                        const cleanName = member.name.replace(/[\(\)\[\]\{\}\.,_-]/g, " ").trim();
                        const initials =
                          cleanName
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || member.name.slice(0, 2).toUpperCase();
                        const displayName = member.name.replace(/\s*\([^)]*\)/g, "").trim() || member.name;
                        const relBadge = getRelationshipBadge(member.relationship);
                        const allowance = Number(member.monthly_allowance) || 0;
                        const spending = getMemberSpendingForMonth(member);
                        const remaining = allowance - spending;
                        const percentSpent = allowance > 0 ? Math.round((spending / allowance) * 100) : 0;

                        return (
                          <tr
                            key={member.id}
                            className="group transition-colors hover:bg-[var(--app-card-hover)]"
                          >
                            {/* Member Name + Avatar */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: member.avatar_color || "#10B981",
                                  }}
                                >
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm tracking-tight truncate capitalize">
                                    {displayName}
                                  </div>
                                  {(member.phone || member.email) && (
                                    <div className="text-[11px] font-mono opacity-50 truncate">
                                      {member.phone || member.email}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Relationship Badge */}
                            <td className="py-3 px-4">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border"
                                style={{
                                  backgroundColor: relBadge.bg,
                                  color: relBadge.text,
                                  borderColor: relBadge.border,
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: relBadge.text }} />
                                {relBadge.label}
                              </span>
                            </td>

                            {/* Monthly Target */}
                            <td className="py-3 px-4 text-right font-mono font-semibold">
                              {allowance > 0 ? formatINR(allowance) : <span className="opacity-40">Flexible</span>}
                            </td>

                            {/* Sent This Month */}
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                              {formatINR(spending)}
                            </td>

                            {/* Remaining */}
                            <td className="py-3 px-4 text-right font-mono text-[11px]">
                              {allowance === 0 ? (
                                <span className="opacity-40">—</span>
                              ) : remaining <= 0 ? (
                                <span className="font-bold text-emerald-400">Target Met ✓</span>
                              ) : (
                                <span className="font-bold text-amber-400">{formatINR(remaining)}</span>
                              )}
                            </td>

                            {/* Progress Bar */}
                            <td className="py-3 px-4">
                              <div className="w-28 space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
                                  <span>{percentSpent}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, percentSpent)}%`,
                                      backgroundColor:
                                        spending > allowance && allowance > 0
                                          ? "var(--app-loss)"
                                          : percentSpent >= 80
                                          ? "#10B981"
                                          : member.avatar_color || "#3B82F6",
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Notes / Memo */}
                            <td className="py-3 px-4 max-w-[180px] truncate text-xs opacity-70">
                              {member.notes || <span className="opacity-30">—</span>}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setTransferMember(member);
                                    setTransferAmountInput("");
                                    setTransferDate(new Date().toISOString().split("T")[0]);
                                    setTransferNotes("");
                                    setTransferAccountId(accounts[0]?.id || "");
                                    setTransferModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-xs bg-white text-black hover:bg-neutral-100"
                                  title="Send Money"
                                >
                                  <Send size={11} className="text-emerald-600" />
                                  <span>Send</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMember(member);
                                    setMemberModalOpen(true);
                                  }}
                                  className="w-7 h-7 rounded-lg border flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer"
                                  style={{ borderColor: "var(--app-border-subtle)" }}
                                  title="Edit Member"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    setResetMember(member);
                                    setResetModalOpen(true);
                                  }}
                                  className="w-7 h-7 rounded-lg border flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer"
                                  style={{ borderColor: "var(--app-border-subtle)" }}
                                  title="Reset spending cycle"
                                >
                                  <RotateCcw size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMember(member.id, member.name)}
                                  className="w-7 h-7 rounded-lg border flex items-center justify-center opacity-60 hover:opacity-100 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                  style={{ borderColor: "var(--app-border-subtle)" }}
                                  title="Remove Member"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2 CONTENT: TRANSFER HISTORY
            ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* History Mini Metric Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="p-3.5 rounded-xl border flex items-center justify-between"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Total Support Outflow</span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    {formatINR(historyStats.totalSent)}
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-emerald-400"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.2)" }}
                >
                  <Send size={14} />
                </div>
              </div>

              <div
                className="p-3.5 rounded-xl border flex items-center justify-between"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Transfers Recorded</span>
                  <div className="text-lg font-bold font-mono mt-0.5">
                    {historyStats.count} Transactions
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center opacity-70"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border-subtle)" }}
                >
                  <FileText size={14} />
                </div>
              </div>

              <div
                className="p-3.5 rounded-xl border flex items-center justify-between"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Average Transfer</span>
                  <div className="text-lg font-bold font-mono mt-0.5">
                    {formatINR(historyStats.avg)}
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-amber-400"
                  style={{ backgroundColor: "rgba(245, 158, 11, 0.1)", borderColor: "rgba(245, 158, 11, 0.2)" }}
                >
                  <Coins size={14} />
                </div>
              </div>
            </div>

            {/* Transfer History Table */}
            {filteredFamilyHistory.length === 0 ? (
              <div
                className="rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-3"
                style={{ backgroundColor: "var(--app-card)", borderColor: "var(--app-border)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl border flex items-center justify-center opacity-40"
                  style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)" }}
                >
                  <History size={22} />
                </div>
                <h3 className="text-base font-bold">No Transfer History Found</h3>
                <p className="text-xs opacity-60 max-w-sm mx-auto">
                  {historySearch || historyMemberFilter !== "all"
                    ? "No transfers match your current filter criteria."
                    : `No family support transfers recorded for ${isAllTime ? "all time" : monthDisplayTitle}.`}
                </p>
                {members.length > 0 && (
                  <button
                    onClick={() => {
                      setTransferMember(members[0]);
                      setTransferAmountInput("");
                      setTransferDate(new Date().toISOString().split("T")[0]);
                      setTransferNotes("");
                      setTransferAccountId(accounts[0]?.id || "");
                      setTransferModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs cursor-pointer bg-white text-black hover:bg-neutral-100 mt-2"
                  >
                    <Send size={13} className="text-emerald-600" />
                    <span>Send Money Now</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                className="rounded-2xl border overflow-hidden shadow-sm transition-colors"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                  color: "var(--app-fg)",
                }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className="border-b text-[11px] font-bold uppercase tracking-wider select-none font-mono opacity-60"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-bg)",
                          color: "var(--app-fg)",
                        }}
                      >
                        <th className="py-3.5 px-4 font-semibold">Date</th>
                        <th className="py-3.5 px-4 font-semibold">Recipient Member</th>
                        <th className="py-3.5 px-4 font-semibold">Payment Source</th>
                        <th className="py-3.5 px-4 font-semibold">Purpose / Memo</th>
                        <th className="py-3.5 px-4 font-semibold">Category</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Amount Sent</th>
                        <th className="py-3.5 px-4 font-semibold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--app-border-subtle)" }}>
                      {filteredFamilyHistory.map((item) => {
                        // Match to registered member
                        const matchedMember = members.find((m) => {
                          const t = (item.title || "").toLowerCase();
                          const n = (item.notes || "").toLowerCase();
                          const mName = m.name.toLowerCase();
                          return t.includes(mName) || n.includes(mName);
                        });

                        const cleanName = (matchedMember?.name || item.title || "Family Member")
                          .replace(/^Money sent to\s*/i, "")
                          .replace(/[\(\)\[\]\{\}\.,_-]/g, " ")
                          .trim();

                        const initials =
                          cleanName
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "FM";

                        const recipientName =
                          matchedMember?.name ||
                          item.title?.replace(/^Money sent to\s*/i, "") ||
                          "Family Support";

                        const relBadge = matchedMember ? getRelationshipBadge(matchedMember.relationship) : null;
                        const account = accounts.find((a) => a.id === item.account_id);
                        const relDateTag = getRelativeDateTag(item.expense_date);

                        return (
                          <tr
                            key={item.id}
                            className="group transition-colors hover:bg-[var(--app-card-hover)]"
                          >
                            {/* Date Column */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-mono text-xs font-semibold">
                                {formatHistoryDate(item.expense_date)}
                              </div>
                              {relDateTag && (
                                <span
                                  className="inline-block mt-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded border opacity-60"
                                  style={{ borderColor: "var(--app-border-subtle)" }}
                                >
                                  {relDateTag}
                                </span>
                              )}
                            </td>

                            {/* Recipient Member */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: matchedMember?.avatar_color || "#10B981",
                                  }}
                                >
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm tracking-tight truncate capitalize">
                                    {recipientName}
                                  </div>
                                  {relBadge && (
                                    <div className="mt-0.5">
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase border"
                                        style={{
                                          backgroundColor: relBadge.bg,
                                          color: relBadge.text,
                                          borderColor: relBadge.border,
                                        }}
                                      >
                                        {relBadge.label}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Payment Source Account */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <BankLogo name={account?.name || "Cash in Hand"} size={20} />
                                <div>
                                  <div className="font-semibold text-xs truncate max-w-[150px]">
                                    {account?.name || "Direct / Cash"}
                                  </div>
                                  <div className="text-[10px] font-mono opacity-50 uppercase">
                                    {account?.type || "Cash"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Purpose / Notes */}
                            <td className="py-3.5 px-4 max-w-[220px]">
                              <p className="text-xs truncate font-sans" title={item.notes || item.title || ""}>
                                {item.notes || item.title || "Family support transfer"}
                              </p>
                            </td>

                            {/* Category */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border"
                                style={{
                                  backgroundColor: "rgba(251, 146, 60, 0.1)",
                                  color: "#fb923c",
                                  borderColor: "rgba(251, 146, 60, 0.25)",
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                Family & Child Care
                              </span>
                            </td>

                            {/* Amount Sent */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="font-mono font-bold text-sm text-emerald-400">
                                {formatINR(item.amount)}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteTransfer(item.id, item.title, item.amount)}
                                className="w-7 h-7 rounded-lg border inline-flex items-center justify-center opacity-50 hover:opacity-100 text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-all"
                                style={{ borderColor: "var(--app-border-subtle)" }}
                                title="Delete transfer record"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          POPUP MODAL 1: ADD / EDIT FAMILY MEMBER
          ========================================================================= */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 sm:p-7 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center"
                  style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-bg)" }}
                >
                  <Users size={16} style={{ color: "var(--app-accent)" }} />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {editingMember ? "Edit Family Member" : "Add Family Member"}
                  </h3>
                  <p className="text-xs opacity-60">Set relationship, monthly support target, and notes.</p>
                </div>
              </div>
              <button
                onClick={() => setMemberModalOpen(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Amma / Mom, Dad, Priya"
                  defaultValue={editingMember?.name || ""}
                  className="w-full rounded-lg px-3.5 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Relationship</label>
                <select
                  name="relationship"
                  defaultValue={editingMember?.relationship || "Parent"}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                >
                  {RELATIONSHIPS.map((rel) => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Monthly Support Target / Allowance (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono opacity-60">₹</span>
                  <input
                    type="number"
                    name="monthly_allowance"
                    step="100"
                    min="0"
                    placeholder="0"
                    defaultValue={editingMember?.monthly_allowance || ""}
                    className="w-full rounded-lg pl-7 pr-3 py-2 text-xs font-mono border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Avatar Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {AVATAR_COLORS.map((col) => (
                    <label key={col} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="avatar_color"
                        value={col}
                        defaultChecked={(editingMember?.avatar_color || "#10B981") === col}
                        className="peer sr-only"
                      />
                      <div
                        className="w-6 h-6 rounded-full border-2 peer-checked:ring-2 peer-checked:ring-white transition-all"
                        style={{ backgroundColor: col, borderColor: "rgba(255,255,255,0.2)" }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Phone / UPI Number</label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+91 98765 43210"
                    defaultValue={editingMember?.phone || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Email (Optional)</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    defaultValue={editingMember?.email || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Notes / Bank / Transfer Details</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Monthly medical support, HDFC UPI transfer, or bank account number"
                  defaultValue={editingMember?.notes || ""}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors resize-none"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border transition-opacity cursor-pointer opacity-70 hover:opacity-100"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP MODAL 2: SEND MONEY / LOG TRANSFER
          ========================================================================= */}
      {transferModalOpen && transferMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border p-5 sm:p-6 space-y-5 shadow-2xl relative"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-emerald-400"
                  style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-bg)" }}
                >
                  <Send size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    Log Money Sent to {transferMember.name}
                  </h3>
                  <p className="text-xs opacity-60">
                    Target: {formatINR(transferMember.monthly_allowance)} • Sent: {formatINR(transferMember.current_spending)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="p-1 rounded opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLogTransfer} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Amount Sent (₹ INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono opacity-60">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="0"
                    value={transferAmountInput}
                    onChange={(e) => setTransferAmountInput(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-lg pl-7 pr-3 py-2 text-sm font-mono font-bold border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Transfer Date
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Payment Account
                </label>
                <select
                  value={transferAccountId}
                  onChange={(e) => setTransferAccountId(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                >
                  <option value="">Unlinked / Direct Cash</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) — {formatINR(acc.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Purpose / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly maintenance, Medical support, Gift"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div
                className="p-3 rounded-xl border flex items-start gap-2.5 text-xs"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  borderColor: "rgba(16, 185, 129, 0.2)",
                  color: "var(--app-fg)",
                }}
              >
                <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px] leading-relaxed">
                  <span className="font-semibold text-emerald-400 block">Managed Exclusively in Family Support</span>
                  <span className="opacity-70">
                    This transfer will deduct from your chosen payment account and be tracked directly under Transfer History, keeping your personal Expenses ledger clean.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border opacity-70 hover:opacity-100 cursor-pointer"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  Record Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP MODAL 3: RESET SPENDING CYCLE
          ========================================================================= */}
      {resetModalOpen && resetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-2xl relative"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <h3 className="text-sm font-bold tracking-tight">Reset Monthly Cycle</h3>
              <button
                onClick={() => setResetModalOpen(false)}
                className="p-1 rounded opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs opacity-70 leading-relaxed">
              Resetting will set <strong>{resetMember.name}&apos;s</strong> current monthly spending counter from{" "}
              <strong>{formatINR(resetMember.current_spending)}</strong> back to <strong>₹0</strong> for the new billing cycle.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border opacity-70 hover:opacity-100 cursor-pointer"
                style={{ borderColor: "var(--app-border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetSpending}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm cursor-pointer disabled:opacity-50 text-white bg-rose-600 hover:bg-rose-700"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                Reset to ₹0
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
