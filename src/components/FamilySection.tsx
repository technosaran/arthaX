"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Pencil,
  Loader2,
  Phone,
  Mail,
  Send,
  RotateCcw,
  CheckCircle2,
  FileText,
  Coins,
  Wallet,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutGrid,
  List,
  Search,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getFromLocalCache, saveToLocalCache, invalidateCacheKeys, invalidateAllFinancialCache } from "@/utils/cacheClient";
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
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";

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

function getRelationshipBadgeVariant(rel: string): { variant: BadgeVariant; label: string } {
  const r = (rel || "").toLowerCase();
  if (r.includes("child") || r.includes("kid") || r.includes("son") || r.includes("daughter")) {
    return { variant: "emerald", label: rel };
  }
  if (r.includes("spouse") || r.includes("wife") || r.includes("husband") || r.includes("partner")) {
    return { variant: "rose", label: rel };
  }
  if (r.includes("parent") || r.includes("mother") || r.includes("father") || r.includes("dad") || r.includes("mom")) {
    return { variant: "amber", label: rel };
  }
  if (r.includes("sibling") || r.includes("brother") || r.includes("sister")) {
    return { variant: "violet", label: rel };
  }
  return { variant: "sky", label: rel || "Family" };
}

const AVATAR_COLORS = [
  "#10B981", // Modern Vibrant Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#F43F5E", // Modern Rose
  "#14B8A6", // Teal
  "#E11D48", // Crimson
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
  const inFlightRef = useRef<boolean>(false);

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
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;
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
      inFlightRef.current = false;
    }
  }, [user, membersKey]);

  useEffect(() => {
    fetchAllData();
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

  // Synchronize family data whenever financial data is updated in any tab
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchAllData();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("arthax:financial_data_updated", handleDataUpdated);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("arthax:financial_data_updated", handleDataUpdated);
      }
    };
  }, [fetchAllData]);

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

  // Charts
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

    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthObj = months.find((m) => m.key === currentKey);
    if (currentMonthObj && currentMonthObj.value < totalCurrentSpending && isCurrentMonth) {
      currentMonthObj.value = totalCurrentSpending;
    }

    return months;
  }, [familyExpenses, totalCurrentSpending, isCurrentMonth]);

  // Member Operations
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
      showToast("Name Required", "Please enter the family member's full name.", "warning");
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
        showToast("Member Updated", `${name} (${relationship}) has been updated successfully.`, "success");
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
        showToast("Family Member Added", `${name} (${relationship}) has been enrolled in family tracking.`, "success");
      }

      setMemberModalOpen(false);
      setEditingMember(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Save Failed", "Could not save family member details. Please try again.", "error");
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
      showToast("Member Removed", `${name} has been removed from family tracking.`, "info");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Removal Failed", `Could not remove ${name}. Please try again.`, "error");
    }
  };

  // Log Money Sent / Transfer Operation
  const handleLogTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !transferMember) return;
    setSubmitting(true);

    const val = parseFloat(transferAmountInput) || 0;
    if (val <= 0) {
      showToast("Invalid Transfer Amount", "Please enter a transfer amount greater than ₹0.", "warning");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      const newSpending = Number((Number(transferMember.current_spending || 0) + val).toFixed(2));

      // 1. Update family member's current spending counter
      const { error: memberError } = await supabase
        .from("family_members")
        .update({ current_spending: newSpending })
        .eq("id", transferMember.id)
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      // 2. Atomically record as a family support transfer
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

      showToast("Transfer Logged", `Recorded ${formatINR(val)} sent to ${transferMember.name} and adjusted balances.`, "success");

      setTransferModalOpen(false);
      setTransferMember(null);
      setTransferAmountInput("");
      setTransferNotes("");
      setTransferAccountId("");

      await invalidateAllFinancialCache(user.id);
      await invalidateCacheKeys([membersKey]);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Transfer Failed", "Could not record money transfer to family member.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset Spending Cycle to ₹0
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
      showToast("Cycle Reset", `Monthly spending cycle reset to ₹0 for ${resetMember.name}.`, "success");

      setResetModalOpen(false);
      setResetMember(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Reset Failed", "Could not reset family spending cycle.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Reverse Transfer Record from History
  const handleDeleteTransfer = async (expenseId: string, itemTitle?: string | null, itemAmount?: number) => {
    if (!confirm(`Are you sure you want to reverse this transfer record${itemAmount ? ` of ${formatINR(itemAmount)}` : ""}? The debited amount will be refunded to your account balance.`)) return;
    if (!user) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
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

      showToast("Transfer Reversed", `${formatINR(itemAmount || 0)} refunded to your account balance.`, "success");
      await invalidateAllFinancialCache(user.id);
      await invalidateCacheKeys([membersKey]);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Reversal Failed", "Could not reverse transfer record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state with Skeletons
  if (loading) {
    return (
      <main className="flex-1 h-full p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between pb-6 border-b border-[var(--app-border)]">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex-1 h-full p-3.5 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Page Header */}
      <PageHeader
        title="Family Money Tracker"
        description="Track monthly allowances, financial support, and money sent to family members."
        badge={
          <Badge variant="emerald" dot>
            Support & Transfers
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Stepper */}
            <div
              className="flex items-center rounded-xl border p-0.5 text-xs font-mono"
              style={{
                borderColor: "var(--app-border)",
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
            <Button
              variant={isAllTime ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIsAllTime(!isAllTime)}
            >
              All Time
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus size={14} />}
              onClick={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
            >
              Add Member
            </Button>
          </div>
        }
      />

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Family Members"
          value={`${members.length} Members`}
          subtitle={`${members.filter((m) => m.relationship === "Parent").length} Parents • ${members.filter((m) => m.relationship === "Spouse").length} Spouse • ${members.filter((m) => m.relationship === "Child").length} Children`}
          icon={<Users size={16} />}
          iconColor="emerald"
        />

        <StatCard
          title={isAllTime ? "All-Time Sent" : `Total Sent (${monthDisplayTitle})`}
          value={formatINR(totalCurrentSpending)}
          subtitle={
            isAllTime
              ? `Transferred across all recorded months`
              : `Transferred across ${activeRecipientsCount} of ${members.length} members`
          }
          icon={<Send size={16} />}
          iconColor="emerald"
        />

        <StatCard
          title="Monthly Support Target"
          value={formatINR(totalMonthlyAllowance)}
          subtitle={remainingBudget <= 0 ? "Target Met ✓" : `${formatINR(remainingBudget)} Remaining (${overallPercent}%)`}
          icon={<Coins size={16} />}
          iconColor="amber"
          progress={{
            value: Math.min(100, overallPercent),
            color:
              totalCurrentSpending > totalMonthlyAllowance
                ? "bg-rose-500"
                : totalCurrentSpending >= totalMonthlyAllowance * 0.8
                ? "bg-amber-400"
                : "bg-emerald-400",
          }}
        />

        <StatCard
          title="Avg Support / Member"
          value={formatINR(avgSpendingPerMember)}
          subtitle={`Target: ${formatINR(avgTargetPerMember)}/mo • ${activeRecipientsCount} active`}
          icon={<Wallet size={16} />}
          iconColor="sky"
        />
      </div>

      {/* Row 2: Charts (Line Chart + Donut Chart) */}
      {members.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
          {/* Left: 6-Month Timeline Trajectory */}
          <Card className="lg:col-span-7 flex flex-col justify-between">
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
          </Card>

          {/* Right: Support Allocation Donut */}
          <Card className="lg:col-span-5 flex flex-col justify-between">
            <div
              className="flex items-center justify-between pb-3 border-b flex-wrap gap-2"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <div className="flex items-center gap-1.5">
                <PieChartIcon size={14} className="text-emerald-400" />
                <h3 className="text-sm font-bold tracking-tight">Support Allocation</h3>
              </div>

              {/* Mode Toggle: Spending vs Allowance */}
              <SegmentedControl
                options={[
                  { value: "spending", label: "Sent" },
                  { value: "allowance", label: "Target" },
                ]}
                value={chartMode}
                onChange={(val) => setChartMode(val as "spending" | "allowance")}
                size="sm"
              />
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
          </Card>
        </div>
      )}

      {/* Family Data Tabs (Members vs History) */}
      <div className="space-y-4">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b"
          style={{ borderColor: "var(--app-border)" }}
        >
          {/* Left: Tab Switcher */}
          <SegmentedControl
            options={[
              {
                value: "members",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Users size={13} />
                    <span>Family Members</span>
                    <Badge variant="neutral" className="ml-1">
                      {members.length}
                    </Badge>
                  </span>
                ),
              },
              {
                value: "history",
                label: (
                  <span className="flex items-center gap-1.5">
                    <History size={13} />
                    <span>Transfer History</span>
                    <Badge variant="neutral" className="ml-1">
                      {displayedFamilyExpenses.length}
                    </Badge>
                  </span>
                ),
              },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as "members" | "history")}
          />

          {/* Right Controls Header */}
          <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto">
            {activeTab === "members" ? (
              <>
                {/* View Mode Toggle */}
                <SegmentedControl
                  options={[
                    { value: "grid", label: <LayoutGrid size={13} /> },
                    { value: "table", label: <List size={13} /> },
                  ]}
                  value={viewMode}
                  onChange={(val) => setViewMode(val as "grid" | "table")}
                  size="sm"
                />

                <Badge variant="outline" className="font-mono">
                  {members.length} Members • {isAllTime ? "All Time" : monthDisplayTitle}
                </Badge>
              </>
            ) : (
              <>
                {/* Search in History */}
                <div className="w-36 sm:w-48">
                  <Input
                    placeholder="Search transfers..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    leftIcon={<Search size={13} />}
                  />
                </div>

                {/* Filter by Member Dropdown */}
                {members.length > 0 && (
                  <select
                    value={historyMemberFilter}
                    onChange={(e) => setHistoryMemberFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border font-sans cursor-pointer focus:outline-none"
                    style={{
                      borderColor: "var(--app-border)",
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

                <Badge variant="outline" className="font-mono">
                  {filteredFamilyHistory.length} Transfers • {isAllTime ? "All Time" : monthDisplayTitle}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Members (Grid or Table) */}
        {activeTab === "members" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {members.length === 0 ? (
              <EmptyState
                icon={<Users size={28} className="text-emerald-400" />}
                title="No Family Members Tracked Yet"
                description="Add your parents, spouse, children, or relatives to track regular financial support, allowances, and money sent to them."
                action={
                  <Button
                    variant="primary"
                    size="md"
                    icon={<UserPlus size={15} />}
                    onClick={() => {
                      setEditingMember(null);
                      setMemberModalOpen(true);
                    }}
                  >
                    Add First Member
                  </Button>
                }
              />
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
                  const relBadge = getRelationshipBadgeVariant(member.relationship);

                  const allowance = Number(member.monthly_allowance) || 0;
                  const spending = getMemberSpendingForMonth(member);
                  const remaining = allowance - spending;
                  const percentSpent = allowance > 0 ? Math.round((spending / allowance) * 100) : 0;

                  return (
                    <div
                      key={member.id}
                      className="group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border transition-all duration-300 p-5 sm:p-6 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                      style={{
                        backgroundColor: "var(--app-card)",
                        borderColor: "var(--app-border)",
                      }}
                    >
                      {/* Ambient dynamic glow reflecting member's avatar color */}
                      <div
                        className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-35"
                        style={{
                          background: `radial-gradient(circle, ${member.avatar_color || "#10B981"} 0%, transparent 70%)`,
                        }}
                      />
                      {/* Top rim highlight line */}
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                      <div className="relative z-10 space-y-4">
                        {/* Member Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold font-mono text-sm text-white shadow-md flex-shrink-0 ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105"
                              style={{
                                background: `linear-gradient(135deg, ${member.avatar_color || "#10B981"}, ${member.avatar_color || "#10B981"}aa)`,
                                boxShadow: `0 8px 18px -4px ${(member.avatar_color || "#10B981")}45`,
                              }}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h3
                                className="text-base sm:text-lg font-bold tracking-tight truncate capitalize text-[var(--app-fg)]"
                                title={member.name}
                              >
                                {displayName}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={relBadge.variant} dot size="xs">
                                  {relBadge.label}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Header Action: Discreet Edit */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              title="Edit Member"
                              onClick={() => {
                                setEditingMember(member);
                                setMemberModalOpen(true);
                              }}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--app-fg-subtle)] hover:text-[var(--app-fg)] hover:bg-white/[0.08] border border-[var(--app-border-subtle)] transition-all cursor-pointer"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Financial Box */}
                        <div
                          className="p-4 rounded-2xl border space-y-3.5 transition-colors"
                          style={{
                            backgroundColor: "var(--app-card-subtle)",
                            borderColor: "var(--app-border-subtle)",
                          }}
                        >
                          <div className="flex items-end justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--app-fg-subtle)] flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                                {isAllTime ? "Total Sent" : `Sent in ${monthDisplayTitle}`}
                              </span>
                              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-400 mt-1 tabular-nums">
                                {formatINR(spending)}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--app-fg-subtle)] block">
                                Target Support
                              </span>
                              <div className="text-sm sm:text-base font-bold font-mono tracking-tight text-[var(--app-fg)] opacity-90 mt-1 tabular-nums">
                                {allowance > 0 ? formatINR(allowance) : "None"}
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-2 rounded-full overflow-hidden bg-white/5 ring-1 ring-white/10 p-[1px]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${allowance > 0 ? Math.min(100, percentSpent) : 0}%`,
                                background:
                                  allowance > 0 && spending >= allowance
                                    ? "linear-gradient(90deg, #10b981, #34d399)"
                                    : percentSpent >= 75
                                    ? "linear-gradient(90deg, #10b981, #059669)"
                                    : `linear-gradient(90deg, ${member.avatar_color || "#3b82f6"}, #10b981)`,
                                boxShadow:
                                  allowance > 0 && spending >= allowance
                                    ? "0 0 10px rgba(16, 185, 129, 0.4)"
                                    : "none",
                              }}
                            />
                          </div>

                          {/* Status & Progress Info (Clean, Non-Redundant) */}
                          <div className="flex items-center justify-between text-xs pt-0.5">
                            {allowance === 0 ? (
                              <>
                                <span className="text-[11px] font-mono text-[var(--app-fg-subtle)]">
                                  Flexible Support
                                </span>
                                <span className="text-[11px] font-mono text-[var(--app-fg-subtle)]">
                                  No target cap
                                </span>
                              </>
                            ) : spending >= allowance ? (
                              <>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                  <CheckCircle2 size={11} className="text-emerald-400" />
                                  Target Met
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-[var(--app-fg-subtle)]">
                                  {spending > allowance
                                    ? `+${formatINR(spending - allowance)} above target (${percentSpent}%)`
                                    : "100% fulfilled"}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-[11px] text-[var(--app-fg-subtle)]">
                                  {percentSpent}% fulfilled
                                </span>
                                <span className="font-mono text-[11px] font-bold text-amber-400">
                                  {formatINR(remaining)} Left
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Notes (Minimal & Clean, No Heavy Box) */}
                        {member.notes && (
                          <div
                            className="px-1 flex items-center gap-2 text-xs text-[var(--app-fg-subtle)]"
                            title={member.notes}
                          >
                            <FileText size={12} className="text-sky-400/80 flex-shrink-0" />
                            <span className="text-[11px] italic truncate opacity-85">
                              &ldquo;{member.notes}&rdquo;
                            </span>
                          </div>
                        )}

                        {/* Contact Chips */}
                        {(member.phone || member.email) && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {member.phone && (
                              <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono opacity-70"
                                style={{
                                  borderColor: "var(--app-border-subtle)",
                                  backgroundColor: "var(--app-card-subtle)",
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
                                  backgroundColor: "var(--app-card-subtle)",
                                }}
                              >
                                <Mail size={10} className="text-sky-400" />
                                <span>{member.email}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Send Money (Full width, No Refresh Button) */}
                      <div
                        className="relative z-10 pt-4 mt-4 border-t flex items-center"
                        style={{ borderColor: "var(--app-border-subtle)" }}
                      >
                        <Button
                          variant="primary"
                          size="md"
                          className="w-full font-bold shadow-md shadow-emerald-500/15 hover:shadow-emerald-500/25 transition-all justify-center"
                          icon={<Send size={14} className="text-emerald-200" />}
                          onClick={() => {
                            setTransferMember(member);
                            setTransferAmountInput("");
                            setTransferDate(new Date().toISOString().split("T")[0]);
                            setTransferNotes("");
                            setTransferAccountId(accounts[0]?.id || "");
                            setTransferModalOpen(true);
                          }}
                        >
                          Send Money
                        </Button>
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
                        const relBadge = getRelationshipBadgeVariant(member.relationship);
                        const allowance = Number(member.monthly_allowance) || 0;
                        const spending = getMemberSpendingForMonth(member);
                        const remaining = allowance - spending;
                        const percentSpent = allowance > 0 ? Math.round((spending / allowance) * 100) : 0;

                        return (
                          <tr
                            key={member.id}
                            className="group transition-colors hover:bg-[var(--app-card-hover)]"
                          >
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

                            <td className="py-3 px-4">
                              <Badge variant={relBadge.variant} dot>
                                {relBadge.label}
                              </Badge>
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-semibold">
                              {allowance > 0 ? formatINR(allowance) : <span className="opacity-40">Flexible</span>}
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                              {formatINR(spending)}
                            </td>

                            <td className="py-3 px-4 text-right font-mono text-[11px]">
                              {allowance === 0 ? (
                                <span className="opacity-40">—</span>
                              ) : remaining <= 0 ? (
                                <span className="font-bold text-emerald-400">Target Met ✓</span>
                              ) : (
                                <span className="font-bold text-amber-400">{formatINR(remaining)}</span>
                              )}
                            </td>

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

                            <td className="py-3 px-4 max-w-[180px] truncate text-xs opacity-70">
                              {member.notes || <span className="opacity-30">—</span>}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="primary"
                                  size="xs"
                                  icon={<Send size={11} className="text-emerald-400" />}
                                  onClick={() => {
                                    setTransferMember(member);
                                    setTransferAmountInput("");
                                    setTransferDate(new Date().toISOString().split("T")[0]);
                                    setTransferNotes("");
                                    setTransferAccountId(accounts[0]?.id || "");
                                    setTransferModalOpen(true);
                                  }}
                                >
                                  Send
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Edit Member"
                                  onClick={() => {
                                    setEditingMember(member);
                                    setMemberModalOpen(true);
                                  }}
                                >
                                  <Pencil size={12} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Reset spending cycle"
                                  onClick={() => {
                                    setResetMember(member);
                                    setResetModalOpen(true);
                                  }}
                                >
                                  <RotateCcw size={12} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Remove Member"
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                  onClick={() => handleDeleteMember(member.id, member.name)}
                                >
                                  <Trash2 size={12} />
                                </Button>
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

        {/* Tab 2: Transfer History */}
        {activeTab === "history" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* History Mini KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                title="Total Support Outflow"
                value={formatINR(historyStats.totalSent)}
                subtitle="Aggregated transfer volume"
                icon={<Send size={14} />}
                iconColor="emerald"
              />

              <StatCard
                title="Transfers Recorded"
                value={`${historyStats.count} Transactions`}
                subtitle="Reconciled ledger vouchers"
                icon={<FileText size={14} />}
                iconColor="sky"
              />

              <StatCard
                title="Average Transfer"
                value={formatINR(historyStats.avg)}
                subtitle="Mean outflow per transaction"
                icon={<Coins size={14} />}
                iconColor="amber"
              />
            </div>

            {/* Transfer History Table */}
            {filteredFamilyHistory.length === 0 ? (
              <EmptyState
                icon={<History size={24} className="text-muted-foreground" />}
                title="No Transfer History Found"
                description={
                  historySearch || historyMemberFilter !== "all"
                    ? "No transfers match your current filter criteria."
                    : `No family support transfers recorded for ${isAllTime ? "all time" : monthDisplayTitle}.`
                }
                action={
                  members.length > 0 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Send size={13} className="text-emerald-400" />}
                      onClick={() => {
                        setTransferMember(members[0]);
                        setTransferAmountInput("");
                        setTransferDate(new Date().toISOString().split("T")[0]);
                        setTransferNotes("");
                        setTransferAccountId(accounts[0]?.id || "");
                        setTransferModalOpen(true);
                      }}
                    >
                      Send Money Now
                    </Button>
                  ) : undefined
                }
              />
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

                        const relBadge = matchedMember ? getRelationshipBadgeVariant(matchedMember.relationship) : null;
                        const account = accounts.find((a) => a.id === item.account_id);
                        const relDateTag = getRelativeDateTag(item.expense_date);

                        return (
                          <tr
                            key={item.id}
                            className="group transition-colors hover:bg-[var(--app-card-hover)]"
                          >
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
                                      <Badge variant={relBadge.variant}>
                                        {relBadge.label}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

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

                            <td className="py-3.5 px-4 max-w-[220px]">
                              <p className="text-xs truncate font-sans" title={item.notes || item.title || ""}>
                                {item.notes || item.title || "Family support transfer"}
                              </p>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <Badge variant="warning" dot>
                                Family & Child Care
                              </Badge>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="font-mono font-bold text-sm text-emerald-400">
                                {formatINR(item.amount)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Reverse transfer record"
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                onClick={() => handleDeleteTransfer(item.id, item.title, item.amount)}
                              >
                                <Trash2 size={12} />
                              </Button>
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

      {/* MODAL 1: ADD / EDIT FAMILY MEMBER */}
      <Modal
        isOpen={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        title={editingMember ? "Edit Family Member" : "Add Family Member"}
        size="md"
      >
        <form onSubmit={handleSaveMember} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Full Name *"
              name="name"
              required
              placeholder="e.g. Mom, Dad, Aarav"
              defaultValue={editingMember?.name || ""}
            />

            <Select
              label="Relationship"
              name="relationship"
              defaultValue={editingMember?.relationship || "Parent"}
              options={RELATIONSHIPS.map((rel) => ({ value: rel, label: rel }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Monthly Allowance (₹ INR)"
              type="number"
              name="monthly_allowance"
              step="100"
              min="0"
              placeholder="0"
              defaultValue={editingMember?.monthly_allowance || ""}
              leftIcon={<span className="font-mono text-xs">₹</span>}
            />

            <Input
              label="Phone / UPI Number"
              type="tel"
              name="phone"
              placeholder="+91 98765 43210"
              defaultValue={editingMember?.phone || ""}
              leftIcon={<Phone size={12} />}
            />
          </div>

          {/* Compact Avatar Color Selector */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
            <span className="text-[11px] font-semibold text-[var(--app-muted)] select-none">
              Avatar Color
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
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
                    className="w-5 h-5 rounded-full border peer-checked:ring-2 peer-checked:ring-emerald-400 peer-checked:scale-110 transition-all"
                    style={{ backgroundColor: col, borderColor: "rgba(255,255,255,0.2)" }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--app-border-subtle)]">
            {editingMember ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                icon={<Trash2 size={12} />}
                onClick={() => {
                  const toDelete = editingMember;
                  setMemberModalOpen(false);
                  handleDeleteMember(toDelete.id, toDelete.name);
                }}
              >
                Delete Member
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMemberModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={submitting}
              >
                Save Member
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: SEND MONEY / LOG TRANSFER */}
      <Modal
        isOpen={transferModalOpen && !!transferMember}
        onClose={() => setTransferModalOpen(false)}
        title={`Send Money to ${transferMember?.name || ""}`}
        size="md"
      >
        <form onSubmit={handleLogTransfer} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Amount Sent (₹ INR) *"
              type="number"
              step="1"
              min="1"
              placeholder="0"
              value={transferAmountInput}
              onChange={(e) => setTransferAmountInput(e.target.value)}
              required
              autoFocus
              leftIcon={<span className="font-mono text-xs">₹</span>}
            />

            <Input
              label="Transfer Date"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              leftIcon={<Calendar size={12} />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Select
              label="Payment Account"
              value={transferAccountId}
              onChange={(e) => setTransferAccountId(e.target.value)}
              options={[
                { value: "", label: "Unlinked / Direct Cash" },
                ...accounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.name} (${formatINR(acc.balance)})`,
                })),
              ]}
            />

            <Input
              label="Purpose / Notes"
              type="text"
              placeholder="e.g. Maintenance, Medical, Gift"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTransferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
            >
              Record Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: RESET SPENDING CYCLE */}
      <Modal
        isOpen={resetModalOpen && !!resetMember}
        onClose={() => setResetModalOpen(false)}
        title="Reset Monthly Cycle"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs opacity-75 leading-relaxed">
            Reset <strong>{resetMember?.name}&apos;s</strong> monthly spending counter from{" "}
            <strong className="text-emerald-400">{formatINR(resetMember?.current_spending || 0)}</strong> back to{" "}
            <strong>₹0</strong> for the new billing cycle.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={submitting}
              onClick={handleResetSpending}
            >
              Reset to ₹0
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
