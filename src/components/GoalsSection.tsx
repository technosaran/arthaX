"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Trophy,
  Plus,
  Trash2,
  Pencil,
  Search,
  CheckCircle2,
  ShieldCheck,
  Plane,
  Home,
  Car,
  Laptop,
  GraduationCap,
  HeartPulse,
  Flame,
  Coins,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Play,
  Pause,
  X,
  Target,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/cacheKeys";
import { saveToCache, invalidateCacheKeys, getFromLocalCache } from "@/utils/cacheClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";

// ==========================================
// Types & Metadata
// ==========================================

export interface GoalItem {
  id: string;
  user_id?: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  category: string;
  icon: string;
  assigned_members?: any;
  status: "active" | "completed" | "paused";
  notes?: string | null;
  created_at?: string;
}

export interface GoalCategoryPreset {
  name: string;
  iconName: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  defaultTarget: number;
}

export const GOAL_CATEGORIES: GoalCategoryPreset[] = [
  { name: "Emergency Fund", iconName: "ShieldCheck", color: "#10B981", icon: ShieldCheck, defaultTarget: 300000 },
  { name: "Vacation & Travel", iconName: "Plane", color: "#0EA5E9", icon: Plane, defaultTarget: 150000 },
  { name: "Home & Real Estate", iconName: "Home", color: "#F59E0B", icon: Home, defaultTarget: 1000000 },
  { name: "Vehicle & Transport", iconName: "Car", color: "#8B5CF6", icon: Car, defaultTarget: 250000 },
  { name: "Gadgets & Tech", iconName: "Laptop", color: "#6366F1", icon: Laptop, defaultTarget: 120000 },
  { name: "Child Education", iconName: "GraduationCap", color: "#3B82F6", icon: GraduationCap, defaultTarget: 500000 },
  { name: "Health & Medical", iconName: "HeartPulse", color: "#EC4899", icon: HeartPulse, defaultTarget: 200000 },
  { name: "Retirement & FIRE", iconName: "Flame", color: "#F97316", icon: Flame, defaultTarget: 2500000 },
  { name: "Wealth & Investment", iconName: "Coins", color: "#14B8A6", icon: Coins, defaultTarget: 500000 },
  { name: "General Milestone", iconName: "Trophy", color: "#EAB308", icon: Trophy, defaultTarget: 100000 },
];

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  ShieldCheck,
  Plane,
  Home,
  Car,
  Laptop,
  GraduationCap,
  HeartPulse,
  Flame,
  Coins,
  Trophy,
  Target,
  TrendingUp,
};

export function getCategoryTheme(categoryName?: string): GoalCategoryPreset {
  if (!categoryName) return GOAL_CATEGORIES[9]; // General Milestone
  const match = GOAL_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
  );
  if (match) return match;
  const lower = categoryName.toLowerCase();
  if (lower.includes("travel") || lower.includes("vacation") || lower.includes("flight") || lower.includes("trip"))
    return GOAL_CATEGORIES[1];
  if (lower.includes("home") || lower.includes("house") || lower.includes("flat") || lower.includes("real estate") || lower.includes("property"))
    return GOAL_CATEGORIES[2];
  if (lower.includes("car") || lower.includes("bike") || lower.includes("vehicle") || lower.includes("transport") || lower.includes("auto"))
    return GOAL_CATEGORIES[3];
  if (lower.includes("gadget") || lower.includes("tech") || lower.includes("laptop") || lower.includes("phone") || lower.includes("pc"))
    return GOAL_CATEGORIES[4];
  if (lower.includes("child") || lower.includes("education") || lower.includes("college") || lower.includes("school") || lower.includes("study") || lower.includes("kid"))
    return GOAL_CATEGORIES[5];
  if (lower.includes("health") || lower.includes("med") || lower.includes("hospital") || lower.includes("doctor"))
    return GOAL_CATEGORIES[6];
  if (lower.includes("retire") || lower.includes("fire") || lower.includes("pension"))
    return GOAL_CATEGORIES[7];
  if (lower.includes("wealth") || lower.includes("invest") || lower.includes("gold") || lower.includes("fund") || lower.includes("mutual"))
    return GOAL_CATEGORIES[8];
  if (lower.includes("emergency") || lower.includes("safety") || lower.includes("contingency") || lower.includes("shield"))
    return GOAL_CATEGORIES[0];
  return {
    name: categoryName,
    iconName: "Trophy",
    color: "#0EA5E9",
    icon: Trophy,
    defaultTarget: 100000,
  };
}

export function getProgressGradient(color: string, isCompleted: boolean, isPaused: boolean) {
  if (isCompleted) {
    return {
      gradient: "linear-gradient(90deg, #059669 0%, #10B981 60%, #34D399 100%)",
      glow: "rgba(16, 185, 129, 0.4)",
    };
  }
  if (isPaused) {
    return {
      gradient: "linear-gradient(90deg, #64748B 0%, #94A3B8 100%)",
      glow: "rgba(148, 163, 184, 0.2)",
    };
  }

  const colorMap: Record<string, { gradient: string; glow: string }> = {
    "#10B981": {
      gradient: "linear-gradient(90deg, #059669 0%, #10B981 60%, #34D399 100%)",
      glow: "rgba(16, 185, 129, 0.4)",
    },
    "#0EA5E9": {
      gradient: "linear-gradient(90deg, #0284C7 0%, #0EA5E9 60%, #38BDF8 100%)",
      glow: "rgba(14, 165, 233, 0.4)",
    },
    "#F59E0B": {
      gradient: "linear-gradient(90deg, #D97706 0%, #F59E0B 60%, #FBBF24 100%)",
      glow: "rgba(245, 158, 11, 0.4)",
    },
    "#8B5CF6": {
      gradient: "linear-gradient(90deg, #7C3AED 0%, #8B5CF6 60%, #A78BFA 100%)",
      glow: "rgba(139, 92, 246, 0.4)",
    },
    "#6366F1": {
      gradient: "linear-gradient(90deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%)",
      glow: "rgba(99, 102, 241, 0.4)",
    },
    "#3B82F6": {
      gradient: "linear-gradient(90deg, #1D4ED8 0%, #3B82F6 60%, #60A5FA 100%)",
      glow: "rgba(59, 130, 246, 0.4)",
    },
    "#EC4899": {
      gradient: "linear-gradient(90deg, #DB2777 0%, #EC4899 60%, #F472B6 100%)",
      glow: "rgba(236, 72, 153, 0.4)",
    },
    "#F97316": {
      gradient: "linear-gradient(90deg, #EA580C 0%, #F97316 60%, #FB923C 100%)",
      glow: "rgba(249, 115, 22, 0.4)",
    },
    "#14B8A6": {
      gradient: "linear-gradient(90deg, #0D9488 0%, #14B8A6 60%, #2DD4BF 100%)",
      glow: "rgba(20, 184, 166, 0.4)",
    },
    "#EAB308": {
      gradient: "linear-gradient(90deg, #CA8A04 0%, #EAB308 60%, #FDE047 100%)",
      glow: "rgba(234, 179, 8, 0.4)",
    },
  };

  if (colorMap[color]) return colorMap[color];

  return {
    gradient: `linear-gradient(90deg, ${color}CC 0%, ${color} 100%)`,
    glow: `${color}66`,
  };
}

export default function GoalsSection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const redisGoalsKey = getUserCacheKey(user?.id, CACHE_KEYS.GOALS);

  // Synchronous local cache load for instant 0ms mount
  const initialGoals = useMemo(() => {
    return getFromLocalCache<GoalItem[]>(redisGoalsKey) || [];
  }, [redisGoalsKey]);

  const [goals, setGoals] = useState<GoalItem[]>(initialGoals);
  const [loading, setLoading] = useState<boolean>(initialGoals.length === 0);
  const inFlightRef = useRef<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "completed" | "paused">("ALL");
  const [sortBy, setSortBy] = useState<"date" | "progress" | "amount" | "newest">("date");

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositTargetGoal, setDepositTargetGoal] = useState<GoalItem | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositType, setDepositType] = useState<"add" | "withdraw">("add");
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState(GOAL_CATEGORIES[0].name);
  const [formIcon, setFormIcon] = useState(GOAL_CATEGORIES[0].iconName);
  const [formTargetAmount, setFormTargetAmount] = useState("");
  const [formCurrentAmount, setFormCurrentAmount] = useState("0");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "completed" | "paused">("active");
  const [formNotes, setFormNotes] = useState("");

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // 1. Fetch Goals from Supabase
  const fetchGoals = useCallback(
    async (skipCache: boolean = false) => {
      if (!user || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        if (!skipCache) {
          const cached = getFromLocalCache<GoalItem[]>(redisGoalsKey);
          if (cached && cached.length > 0) {
            setGoals(cached);
            setLoading(false);
          }
        }

        const supabase = createClient();
        const { data, error } = await supabase
          .from("family_goals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const normalized: GoalItem[] = (data || []).map((row) => ({
          ...row,
          target_amount: Number(row.target_amount) || 0,
          current_amount: Number(row.current_amount) || 0,
          status:
            Number(row.current_amount) >= Number(row.target_amount) && Number(row.target_amount) > 0
              ? "completed"
              : row.status || "active",
        }));

        setGoals(normalized);
        saveToCache(redisGoalsKey, normalized);
      } catch (err: any) {
        console.error("[Goals] Fetch Error:", err);
        showToast(err?.message || "Failed to load financial goals.", "error");
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [user, redisGoalsKey, showToast]
  );

  // 2. Initial Fetch & Realtime Subscription
  useEffect(() => {
    fetchGoals();
    if (!user) return;

    const supabase = createClient();
    const channel = supabase
      .channel("public:family_goals:realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_goals",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchGoals(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchGoals]);

  // Handle Category selection change in Form
  const handleCategorySelect = (categoryName: string) => {
    setFormCategory(categoryName);
    const preset = GOAL_CATEGORIES.find((c) => c.name === categoryName);
    if (preset) {
      setFormIcon(preset.iconName);
      if (!editingGoal && !formTargetAmount) {
        setFormTargetAmount(preset.defaultTarget.toString());
      }
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingGoal(null);
    setFormTitle("");
    const defaultCat = GOAL_CATEGORIES[0];
    setFormCategory(defaultCat.name);
    setFormIcon(defaultCat.iconName);
    setFormTargetAmount(defaultCat.defaultTarget.toString());
    setFormCurrentAmount("0");
    // Default target date: 6 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    setFormTargetDate(d.toISOString().split("T")[0]);
    setFormStatus("active");
    setFormNotes("");
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (goal: GoalItem) => {
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormCategory(goal.category);
    setFormIcon(goal.icon || "Trophy");
    setFormTargetAmount(goal.target_amount.toString());
    setFormCurrentAmount(goal.current_amount.toString());
    setFormTargetDate(goal.target_date || "");
    setFormStatus(goal.status);
    setFormNotes(goal.notes || "");
    setIsFormModalOpen(true);
  };

  // Open Deposit / Withdraw Funds Modal
  const openDepositModal = (goal: GoalItem, type: "add" | "withdraw" = "add") => {
    setDepositTargetGoal(goal);
    setDepositType(type);
    setDepositAmount("");
    setIsDepositModalOpen(true);
  };

  // Submit Create or Edit Goal
  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const targetVal = parseFloat(formTargetAmount);
    const currentVal = parseFloat(formCurrentAmount) || 0;

    if (!formTitle.trim()) {
      showToast("Goal Title Required", "Please enter a descriptive title for your financial goal.", "warning");
      return;
    }
    if (isNaN(targetVal) || targetVal <= 0) {
      showToast("Invalid Target Amount", "Please enter a valid target savings amount greater than ₹0.", "warning");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const computedStatus: "active" | "completed" | "paused" =
        currentVal >= targetVal ? "completed" : formStatus;

      const payload = {
        user_id: user.id,
        title: formTitle.trim(),
        category: formCategory,
        icon: formIcon,
        target_amount: targetVal,
        current_amount: currentVal,
        target_date: formTargetDate || null,
        status: computedStatus,
        notes: formNotes.trim() || null,
      };

      if (editingGoal) {
        const { error } = await supabase
          .from("family_goals")
          .update(payload)
          .eq("id", editingGoal.id)
          .eq("user_id", user.id);

        if (error) throw error;
        showToast("Goal Updated", `"${formTitle.trim()}" milestones and details have been saved.`, "success");
      } else {
        const { error } = await supabase.from("family_goals").insert([payload]);
        if (error) throw error;
        showToast("Goal Created", `New goal "${formTitle.trim()}" (${formatINR(targetVal)}) established!`, "success");
      }

      setIsFormModalOpen(false);
      setEditingGoal(null);
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      console.error("[Goals] Save error:", err);
      showToast("Goal Save Failed", err.message || "Failed to save goal.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Deposit / Withdraw Amount
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !depositTargetGoal) return;

    const delta = parseFloat(depositAmount);
    if (isNaN(delta) || delta <= 0) {
      showToast("Invalid Amount", "Please enter a valid contribution amount greater than ₹0.", "warning");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const newAmount =
        depositType === "add"
          ? depositTargetGoal.current_amount + delta
          : Math.max(0, depositTargetGoal.current_amount - delta);

      const targetAmount = depositTargetGoal.target_amount;
      const isNowCompleted = newAmount >= targetAmount && targetAmount > 0;
      const newStatus = isNowCompleted
        ? "completed"
        : depositTargetGoal.status === "completed"
        ? "active"
        : depositTargetGoal.status;

      const { error } = await supabase
        .from("family_goals")
        .update({
          current_amount: newAmount,
          status: newStatus,
        })
        .eq("id", depositTargetGoal.id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (depositType === "add") {
        if (isNowCompleted && depositTargetGoal.status !== "completed") {
          showToast("Goal Achieved! 🎉", `Congratulations! You reached 100% of "${depositTargetGoal.title}"!`, "success");
        } else {
          showToast("Funds Contributed", `Saved ${formatINR(delta)} towards "${depositTargetGoal.title}".`, "success");
        }
      } else {
        showToast("Funds Withdrawn", `Withdrew ${formatINR(delta)} from "${depositTargetGoal.title}".`, "info");
      }

      setIsDepositModalOpen(false);
      setDepositTargetGoal(null);
      setDepositAmount("");
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      console.error("[Goals] Deposit error:", err);
      showToast("Update Failed", err.message || "Failed to update goal balance.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Status Toggle (e.g. Pause / Resume)
  const handleToggleStatus = async (goal: GoalItem) => {
    if (!user) return;
    const nextStatus = goal.status === "paused" ? "active" : "paused";
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("family_goals")
        .update({ status: nextStatus })
        .eq("id", goal.id)
        .eq("user_id", user.id);

      if (error) throw error;
      showToast(
        nextStatus === "paused" ? "Goal Paused" : "Goal Resumed",
        nextStatus === "paused"
          ? `Tracking for "${goal.title}" is paused.`
          : `"${goal.title}" is now active and tracking progress.`,
        nextStatus === "paused" ? "info" : "success"
      );
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      showToast("Status Update Failed", err.message || "Failed to update status", "error");
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (id: string) => {
    if (!user) return;
    setSubmitting(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("family_goals")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      showToast("Goal Removed", "Financial goal and milestones have been permanently removed.", "info");
      setDeleteConfirmationId(null);
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      console.error("[Goals] Delete error:", err);
      showToast("Deletion Failed", err.message || "Failed to delete goal.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Sort Goals
  const filteredGoals = useMemo(() => {
    let result = [...goals];

    // Status Filter
    if (statusFilter !== "ALL") {
      result = result.filter((g) => g.status === statusFilter);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q) ||
          (g.notes && g.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "date") {
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
      }
      if (sortBy === "progress") {
        const progA = a.target_amount > 0 ? a.current_amount / a.target_amount : 0;
        const progB = b.target_amount > 0 ? b.current_amount / b.target_amount : 0;
        return progB - progA;
      }
      if (sortBy === "amount") {
        return b.target_amount - a.target_amount;
      }
      // newest
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return result;
  }, [goals, statusFilter, searchQuery, sortBy]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalTarget = goals.reduce((acc, g) => acc + g.target_amount, 0);
    const totalSaved = goals.reduce((acc, g) => acc + g.current_amount, 0);
    const completedCount = goals.filter((g) => g.status === "completed" || g.current_amount >= g.target_amount).length;
    const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
    const remainingToSave = Math.max(0, totalTarget - totalSaved);

    return {
      totalTarget,
      totalSaved,
      completedCount,
      overallProgress,
      remainingToSave,
      totalCount: goals.length,
    };
  }, [goals]);

  // Helper to compute deadline info with human-friendly units
  const getDeadlineInfo = (targetDateStr?: string | null, targetAmount: number = 0, currentAmount: number = 0) => {
    if (!targetDateStr) return null;
    const target = new Date(targetDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.max(1, Math.round(diffDays / 30.4));

    const remaining = Math.max(0, targetAmount - currentAmount);
    const requiredPerMonth = remaining > 0 ? Math.ceil(remaining / diffMonths) : 0;

    // Friendly display: "1.6 yrs left" or "20 mos left" or "35 days left"
    let friendlyRemaining = `${diffDays} days left`;
    if (diffDays > 365) {
      const years = (diffDays / 365).toFixed(1);
      friendlyRemaining = `${years} yrs left (${diffDays}d)`;
    } else if (diffDays > 60) {
      friendlyRemaining = `~${diffMonths} mos left (${diffDays}d)`;
    }

    return {
      diffDays,
      diffMonths,
      friendlyRemaining,
      isOverdue: diffDays < 0,
      requiredPerMonth,
      formattedDate: target.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };
  };

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none space-y-5 sm:space-y-6"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* 1. Universal Page Header */}
      <PageHeader
        title="Financial Goals & Milestones"
        icon={<Trophy className="text-amber-400" size={24} />}
        description="Set targets, track savings velocity, and achieve personal & family milestones."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={openCreateModal}
          >
            Create Goal
          </Button>
        }
      />

      {/* 2. Stat Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <StatCard
            label="Total Goal Target"
            value={formatINR(stats.totalTarget)}
            icon={<Target size={18} />}
            iconColor="sky"
            subtitle={`${stats.totalCount} active targets declared`}
          />
          <StatCard
            label="Total Capital Saved"
            value={formatINR(stats.totalSaved)}
            icon={<Coins size={18} />}
            iconColor="emerald"
            progress={{
              value: stats.overallProgress,
              color: stats.overallProgress >= 70 ? "#10B981" : "#0EA5E9",
            }}
            subtitle={`${stats.overallProgress}% overall completion rate`}
          />
          <StatCard
            label="Remaining Deficit"
            value={formatINR(stats.remainingToSave)}
            icon={<TrendingUp size={18} />}
            iconColor="amber"
            subtitle="To fully complete all targets"
          />
          <StatCard
            label="Milestones Achieved"
            value={`${stats.completedCount} / ${stats.totalCount}`}
            icon={<Trophy size={18} />}
            iconColor="violet"
            subtitle={stats.completedCount > 0 ? "🎉 Goals unlocked & funded!" : "Keep investing consistently"}
          />
        </div>
      )}

      {/* 3. Filter Bar & Controls with Embedded Create Button */}
      <div
        className="p-3 sm:p-4 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs"
        style={{
          borderColor: "var(--app-border)",
          backgroundColor: "var(--app-card)",
        }}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          {/* Status Tabs */}
          <SegmentedControl
            options={[
              { value: "ALL", label: "All" },
              { value: "active", label: "In Progress" },
              { value: "completed", label: "Achieved" },
              { value: "paused", label: "Paused" },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            size="sm"
          />

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search goals by title, category, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] text-[var(--app-fg)] placeholder-[var(--app-muted)] focus:outline-hidden focus:border-[var(--app-accent)] transition-colors h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] hover:text-[var(--app-fg)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right side: Sort Dropdown */}
        <div className="flex items-center gap-1.5 self-end md:self-center flex-shrink-0 text-xs text-[var(--app-muted)]">
          <span className="hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] text-[var(--app-fg)] cursor-pointer focus:outline-hidden focus:border-[var(--app-accent)] h-9"
          >
            <option value="date">Target Date (Soonest)</option>
            <option value="progress">Highest Progress (%)</option>
            <option value="amount">Largest Target (₹)</option>
            <option value="newest">Recently Created</option>
          </select>
        </div>
      </div>

      {/* 4. Goals Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <CardSkeleton rows={5} />
          <CardSkeleton rows={5} />
          <CardSkeleton rows={5} />
        </div>
      ) : filteredGoals.length === 0 ? (
        <EmptyState
          icon={<Trophy size={28} className="text-amber-400" />}
          title={searchQuery || statusFilter !== "ALL" ? "No matching goals found" : "No financial goals created yet"}
          description={
            searchQuery || statusFilter !== "ALL"
              ? "Try adjusting your search query or switching the status filter tab."
              : "Create your first goal to visualize target amounts, track savings velocity, and hit key life milestones."
          }
          action={
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={openCreateModal} className="mt-3 cursor-pointer">
              Create Goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredGoals.map((goal) => {
            const catTheme = getCategoryTheme(goal.category);
            const IconComponent = ICON_MAP[goal.icon] || catTheme.icon || Trophy;
            const progress =
              goal.target_amount > 0
                ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                : 0;
            const isCompleted = goal.status === "completed" || progress >= 100;
            const isPaused = goal.status === "paused";
            const deadline = getDeadlineInfo(goal.target_date, goal.target_amount, goal.current_amount);
            const remaining = Math.max(0, goal.target_amount - goal.current_amount);

            // Progress Bar & Ambient Glow styling derived from category theme
            const progressTheme = getProgressGradient(catTheme.color, isCompleted, isPaused);
            const accentColor = isCompleted ? "#10B981" : catTheme.color;

            return (
              <div
                key={goal.id}
                className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:border-[var(--app-border-hover)] hover:-translate-y-1 overflow-hidden"
                style={{
                  borderColor: isCompleted
                    ? "rgba(16, 185, 129, 0.4)"
                    : "var(--app-border)",
                  backgroundColor: "var(--app-card)",
                }}
              >
                {/* Luminous Top-Edge Gradient Accent Line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-40 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: isCompleted
                      ? "linear-gradient(90deg, transparent, #10B981, transparent)"
                      : `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
                  }}
                />

                {/* Ambient Radial Glow Orb in Top Corner */}
                <div
                  className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 opacity-20 group-hover:opacity-35"
                  style={{ backgroundColor: accentColor }}
                />

                {/* Top Section */}
                <div className="relative z-10">
                  {/* Top Row: Category Icon + Titles + Percentage / Status Pill */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Category-themed Squircle Icon */}
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs transition-transform duration-300 group-hover:scale-105"
                        style={{
                          backgroundColor: `${accentColor}18`,
                          color: accentColor,
                          border: `1px solid ${accentColor}35`,
                          boxShadow: `0 4px 14px ${accentColor}15`,
                        }}
                      >
                        <IconComponent size={22} />
                      </div>

                      {/* Category Label + Title */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: accentColor }}
                          />
                          <span
                            className="text-[10.5px] font-bold uppercase tracking-wider block truncate"
                            style={{ color: accentColor }}
                          >
                            {goal.category}
                          </span>
                        </div>
                        <h3
                          className="text-base sm:text-lg font-bold text-[var(--app-fg)] tracking-tight leading-snug line-clamp-2 break-words"
                          title={goal.title}
                        >
                          {goal.title}
                        </h3>
                      </div>
                    </div>

                    {/* Status / Percentage Badge (Top Right) */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                      {isCompleted ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Achieved</span>
                        </span>
                      ) : isPaused ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30 shadow-xs">
                          <Pause size={12} />
                          <span>Paused</span>
                        </span>
                      ) : (
                        <span
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold shadow-xs border"
                          style={{
                            backgroundColor: `${accentColor}14`,
                            borderColor: `${accentColor}30`,
                            color: accentColor,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{ backgroundColor: accentColor }}
                          />
                          {progress}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notes / Description */}
                  {goal.notes && (
                    <p className="text-xs text-[var(--app-muted)] line-clamp-2 mb-3.5 leading-relaxed">
                      {goal.notes}
                    </p>
                  )}

                  {/* Amounts & Visual Progress Section */}
                  <div className="space-y-2.5 my-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--app-muted)] block mb-0.5">
                          Saved so far
                        </span>
                        <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--app-fg)] tracking-tight">
                          {formatINR(goal.current_amount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--app-muted)] block mb-0.5">
                          Target Goal
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-[var(--app-muted)]">
                          {formatINR(goal.target_amount)}
                        </span>
                        <div className="mt-0.5">
                          {remaining > 0 ? (
                            <span className="text-[11px] font-mono text-[var(--app-muted)]">
                              <span className="text-amber-400 font-semibold">{formatINR(remaining)}</span> to go
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono font-semibold text-emerald-400">
                              100% funded!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress Track with Milestone Ticks & Glossy Sheen */}
                    <div className="relative w-full h-3 rounded-full bg-[var(--app-card-subtle)] border border-[var(--app-border)] p-0.5 overflow-hidden shadow-inner">
                      {/* Milestone Ticks (25%, 50%, 75%) */}
                      <div className="absolute left-1/4 top-0 bottom-0 w-[1px] bg-white/10 z-10 pointer-events-none" />
                      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/10 z-10 pointer-events-none" />
                      <div className="absolute left-3/4 top-0 bottom-0 w-[1px] bg-white/10 z-10 pointer-events-none" />

                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                        style={{
                          width: `${progress}%`,
                          background: progressTheme.gradient,
                          boxShadow: `0 0 10px ${progressTheme.glow}`,
                        }}
                      >
                        {/* Glossy top sheen highlight */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/10 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Deadline & Velocity Split Insights Capsule */}
                  <div
                    className="grid grid-cols-2 gap-2 p-3 rounded-xl border text-xs mb-5 shadow-xs"
                    style={{
                      borderColor: "var(--app-border)",
                      backgroundColor: "var(--app-card-subtle)",
                    }}
                  >
                    {/* Left Tile: Deadline */}
                    <div className="flex flex-col justify-between space-y-1 min-w-0 pr-2 border-r border-[var(--app-border)]">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                        <Calendar size={12} className="text-[var(--app-muted)] flex-shrink-0" />
                        <span className="truncate">Target Date</span>
                      </div>
                      {deadline ? (
                        <>
                          <span
                            className={`font-semibold font-mono text-xs sm:text-sm truncate ${
                              deadline.isOverdue && !isCompleted ? "text-rose-400" : "text-[var(--app-fg)]"
                            }`}
                          >
                            {deadline.formattedDate}
                          </span>
                          <div>
                            {deadline.isOverdue && !isCompleted ? (
                              <span className="text-[10px] font-medium text-rose-400 flex items-center gap-1">
                                <AlertTriangle size={11} /> Overdue
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-block ${
                                  deadline.diffDays <= 30
                                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                    : "bg-[var(--app-card)] text-[var(--app-muted)] border border-[var(--app-border)]"
                                }`}
                              >
                                {deadline.friendlyRemaining}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-[var(--app-muted)]">Open milestone</span>
                      )}
                    </div>

                    {/* Right Tile: Monthly Velocity */}
                    <div className="flex flex-col justify-between space-y-1 min-w-0 pl-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                        <TrendingUp
                          size={12}
                          className={isCompleted ? "text-emerald-400" : "text-[var(--app-accent)]"}
                        />
                        <span className="truncate">{isCompleted ? "Status" : "Monthly Pace"}</span>
                      </div>
                      {isCompleted ? (
                        <>
                          <span className="font-bold text-xs sm:text-sm text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={13} /> Fully Funded
                          </span>
                          <span className="text-[10px] text-[var(--app-muted)]">Goal achieved! 🎉</span>
                        </>
                      ) : deadline && !deadline.isOverdue && deadline.requiredPerMonth > 0 ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-400 truncate">
                              {formatINR(deadline.requiredPerMonth)}
                            </span>
                            <span className="text-[10px] font-semibold text-[var(--app-muted)]">/mo</span>
                          </div>
                          <span className="text-[10px] text-[var(--app-muted)]">Needed to hit date</span>
                        </>
                      ) : deadline?.isOverdue ? (
                        <>
                          <span className="text-xs sm:text-sm font-bold text-rose-400">Date Passed</span>
                          <span className="text-[10px] text-[var(--app-muted)]">Update deadline</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-mono font-medium text-[var(--app-muted)]">
                            Flexible
                          </span>
                          <span className="text-[10px] text-[var(--app-muted)]">Save at your own pace</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer with Clean Framed Toolcapsules */}
                <div className="pt-3 border-t border-[var(--app-border)] flex items-center justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openDepositModal(goal, "add")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95"
                    >
                      <Plus size={14} />
                      <span>Add Funds</span>
                    </button>
                    {goal.current_amount > 0 && (
                      <button
                        type="button"
                        onClick={() => openDepositModal(goal, "withdraw")}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[var(--app-border)] bg-[var(--app-card-subtle)] hover:bg-[var(--app-card-hover)] text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Withdraw or adjust saved funds"
                      >
                        Adjust
                      </button>
                    )}
                  </div>

                  {/* Unified Micro Icon Toolbar */}
                  <div className="flex items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(goal)}
                      title={isPaused ? "Resume Goal tracking" : "Pause Goal tracking"}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)] transition-all cursor-pointer active:scale-95"
                    >
                      {isPaused ? <Play size={14} className="text-emerald-400" /> : <Pause size={14} />}
                    </button>
                    <div className="w-[1px] h-3.5 bg-[var(--app-border)]" />
                    <button
                      type="button"
                      onClick={() => openEditModal(goal)}
                      title="Edit Goal milestones & details"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)] transition-all cursor-pointer active:scale-95"
                    >
                      <Pencil size={14} />
                    </button>
                    <div className="w-[1px] h-3.5 bg-[var(--app-border)]" />
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmationId(goal.id)}
                      title="Delete Goal"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--app-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer active:scale-95"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* "+ Add Another Goal" Ghost Card (Fills grid gap nicely when few goals exist) */}
          {filteredGoals.length > 0 && filteredGoals.length < 6 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="group relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-card-subtle)] transition-all duration-300 cursor-pointer min-h-[300px] text-center overflow-hidden"
            >
              <div
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-[var(--app-accent)]"
              />
              <div className="w-12 h-12 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] flex items-center justify-center text-[var(--app-muted)] group-hover:text-[var(--app-accent)] group-hover:scale-110 group-hover:border-[var(--app-accent-border)] transition-all duration-300 mb-3 shadow-xs">
                <Plus size={22} />
              </div>
              <span className="text-sm font-bold text-[var(--app-fg)] group-hover:text-[var(--app-accent)] transition-colors">
                Add Another Goal
              </span>
              <span className="text-xs text-[var(--app-muted)] mt-1.5 max-w-[220px] leading-relaxed">
                Set milestones for vehicles, education, gadgets, or emergency reserves.
              </span>
            </button>
          )}
        </div>
      )}

      {/* 5. Create / Edit Goal Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingGoal ? "Edit Financial Goal" : "Create Financial Goal"}
        description="Set your savings target, deadline, and category to track milestone progress."
        size="md"
      >
        <form onSubmit={handleSubmitGoal} className="space-y-2.5">
          {/* Row 1: Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Goal Title *"
              placeholder="e.g. Emergency Fund, New Car"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              autoFocus
            />

            <Select
              label="Category"
              value={formCategory}
              onChange={(e) => handleCategorySelect(e.target.value)}
              options={GOAL_CATEGORIES.map((c) => ({
                value: c.name,
                label: c.name,
              }))}
            />
          </div>

          {/* Row 2: Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Target Amount (₹) *"
              type="number"
              placeholder="100000"
              value={formTargetAmount}
              onChange={(e) => setFormTargetAmount(e.target.value)}
              min="1"
              step="any"
              required
            />

            <Input
              label="Initial Saved Amount (₹)"
              type="number"
              placeholder="0"
              value={formCurrentAmount}
              onChange={(e) => setFormCurrentAmount(e.target.value)}
              min="0"
              step="any"
            />
          </div>

          {/* Row 3: Deadline & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Target Deadline"
              type="date"
              value={formTargetDate}
              onChange={(e) => setFormTargetDate(e.target.value)}
            />

            {editingGoal ? (
              <Select
                label="Goal Status"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                options={[
                  { value: "active", label: "In Progress (Active)" },
                  { value: "completed", label: "Completed (Goal Achieved)" },
                  { value: "paused", label: "Paused" },
                ]}
              />
            ) : (
              <div />
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsFormModalOpen(false)}
              disabled={submitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
            >
              {editingGoal ? "Save Changes" : "Create Goal"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. Deposit / Withdraw Funds Modal */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        title={
          depositType === "add"
            ? `Add Funds to "${depositTargetGoal?.title}"`
            : `Withdraw Funds from "${depositTargetGoal?.title}"`
        }
        description={
          depositType === "add"
            ? `Current progress: ${formatINR(depositTargetGoal?.current_amount || 0)} / ${formatINR(
                depositTargetGoal?.target_amount || 0
              )}`
            : "Adjust balance if you transferred or spent funds from this goal."
        }
        size="md"
      >
        <form onSubmit={handleDepositSubmit} className="space-y-2.5">
          <Input
            label={depositType === "add" ? "Deposit Amount (₹) *" : "Withdraw Amount (₹) *"}
            type="number"
            placeholder="5000"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            min="1"
            step="any"
            autoFocus
            required
          />

          {/* Quick Preset Amount Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] text-[var(--app-muted)] font-mono">Quick:</span>
            {[1000, 5000, 10000, 25000, 50000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDepositAmount(preset.toString())}
                className="px-2 py-0.5 text-xs font-mono font-semibold rounded-lg border border-[var(--app-border)] bg-[var(--app-card-subtle)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] transition-colors cursor-pointer"
              >
                +{formatINR(preset)}
              </button>
            ))}
          </div>

          {/* New Expected Total Preview */}
          {depositAmount && !isNaN(parseFloat(depositAmount)) && depositTargetGoal && (
            <div
              className="p-2.5 rounded-xl border text-xs space-y-1"
              style={{
                borderColor: "var(--app-border)",
                backgroundColor: "var(--app-card-subtle)",
              }}
            >
              <div className="flex items-center justify-between text-[var(--app-muted)]">
                <span>New Balance Preview:</span>
                <span className="font-mono font-bold text-sm text-[var(--app-fg)]">
                  {formatINR(
                    depositType === "add"
                      ? depositTargetGoal.current_amount + parseFloat(depositAmount)
                      : Math.max(0, depositTargetGoal.current_amount - parseFloat(depositAmount))
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--app-muted)]">
                <span>New Progress:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {Math.min(
                    100,
                    Math.round(
                      ((depositType === "add"
                        ? depositTargetGoal.current_amount + parseFloat(depositAmount)
                        : Math.max(0, depositTargetGoal.current_amount - parseFloat(depositAmount))) /
                        depositTargetGoal.target_amount) *
                        100
                    )
                  )}
                  %
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDepositModalOpen(false)}
              disabled={submitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
            >
              {depositType === "add" ? "Confirm Deposit" : "Confirm Withdrawal"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteConfirmationId)}
        onClose={() => setDeleteConfirmationId(null)}
        title="Delete Financial Goal"
        description="Are you sure you want to permanently delete this goal? This action cannot be undone."
        size="sm"
      >
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--app-border)]">
          <Button
            variant="secondary"
            onClick={() => setDeleteConfirmationId(null)}
            disabled={submitting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmationId && handleDeleteGoal(deleteConfirmationId)}
            loading={submitting}
          >
            Delete Permanently
          </Button>
        </div>
      </Modal>
    </main>
  );
}
