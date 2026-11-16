"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Trophy,
  Plus,
  Trash2,
  Pencil,
  Loader2,
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
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Play,
  Pause,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Target,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/redis";
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
import { Skeleton, StatCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton";

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
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      if (!user) return;
      setErrorMsg(null);
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
        setErrorMsg(err.message || "Failed to load financial goals.");
      } finally {
        setLoading(false);
      }
    },
    [user, redisGoalsKey]
  );

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // 2. Realtime Subscription
  useEffect(() => {
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
      showToast("Please enter a goal title.", "error");
      return;
    }
    if (isNaN(targetVal) || targetVal <= 0) {
      showToast("Please enter a valid target amount greater than zero.", "error");
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
        showToast("Goal updated successfully!", "success");
      } else {
        const { error } = await supabase.from("family_goals").insert([payload]);
        if (error) throw error;
        showToast("New financial goal created!", "success");
      }

      setIsFormModalOpen(false);
      setEditingGoal(null);
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      console.error("[Goals] Save error:", err);
      showToast(err.message || "Failed to save goal.", "error");
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
      showToast("Please enter a valid positive amount.", "error");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      let newAmount =
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
          showToast(`🎉 Congratulations! You reached 100% of "${depositTargetGoal.title}"!`, "success");
        } else {
          showToast(`Saved ${formatINR(delta)} towards "${depositTargetGoal.title}"!`, "success");
        }
      } else {
        showToast(`Withdrew ${formatINR(delta)} from "${depositTargetGoal.title}".`, "info");
      }

      setIsDepositModalOpen(false);
      setDepositTargetGoal(null);
      setDepositAmount("");
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      console.error("[Goals] Deposit error:", err);
      showToast(err.message || "Failed to update goal balance.", "error");
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
      showToast(nextStatus === "paused" ? "Goal paused." : "Goal resumed!", "info");
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
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
      showToast("Goal removed successfully.", "success");
      setDeleteConfirmationId(null);
      invalidateCacheKeys([redisGoalsKey]);
      await fetchGoals(true);
    } catch (err: any) {
      console.error("[Goals] Delete error:", err);
      showToast(err.message || "Failed to delete goal.", "error");
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
        badge={
          <Badge variant="accent" className="font-mono text-xs">
            {stats.completedCount}/{stats.totalCount} Achieved
          </Badge>
        }
        actions={
          <Button
            variant="primary"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl shadow-xs cursor-pointer font-semibold text-xs sm:text-sm"
          >
            <Plus size={16} />
            <span>Create Goal</span>
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
            <Button variant="primary" onClick={openCreateModal} className="mt-3 cursor-pointer">
              <Plus size={16} className="mr-1.5" /> Create Goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredGoals.map((goal) => {
            const IconComponent = ICON_MAP[goal.icon] || Trophy;
            const progress =
              goal.target_amount > 0
                ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                : 0;
            const isCompleted = goal.status === "completed" || progress >= 100;
            const isPaused = goal.status === "paused";
            const deadline = getDeadlineInfo(goal.target_date, goal.target_amount, goal.current_amount);

            // Harmonious Theme Colors matching progress bar and badge
            let progressBg = "bg-sky-500";
            let badgeVariant: "success" | "info" | "warning" | "neutral" = "info";
            let accentTextColor = "text-sky-400";

            if (isCompleted) {
              progressBg = "bg-emerald-500";
              badgeVariant = "success";
              accentTextColor = "text-emerald-400";
            } else if (isPaused) {
              progressBg = "bg-slate-500";
              badgeVariant = "neutral";
              accentTextColor = "text-[var(--app-muted)]";
            } else if (progress >= 70) {
              progressBg = "bg-emerald-400";
              badgeVariant = "success";
              accentTextColor = "text-emerald-400";
            } else if (progress < 30) {
              progressBg = "bg-amber-400";
              badgeVariant = "warning";
              accentTextColor = "text-amber-400";
            }

            return (
              <div
                key={goal.id}
                className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl border transition-all duration-200 hover:shadow-md hover:border-[var(--app-border-hover)]"
                style={{
                  borderColor: isCompleted ? "rgba(16, 185, 129, 0.35)" : "var(--app-border)",
                  backgroundColor: "var(--app-card)",
                }}
              >
                {/* Top Row: Icon + Category + Title + Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs"
                        style={{
                          backgroundColor: isCompleted
                            ? "rgba(16, 185, 129, 0.15)"
                            : "var(--app-card-subtle)",
                          color: isCompleted ? "#10B981" : "var(--app-fg)",
                          border: "1px solid var(--app-border)",
                        }}
                      >
                        <IconComponent size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)] block truncate mb-0.5">
                          {goal.category}
                        </span>
                        <h3
                          className="text-base sm:text-lg font-bold text-[var(--app-fg)] tracking-tight line-clamp-1 break-words"
                          title={goal.title}
                        >
                          {goal.title}
                        </h3>
                      </div>
                    </div>

                    {/* Status / Percentage Badge */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                      {isCompleted ? (
                        <Badge variant="success" className="flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5">
                          <CheckCircle2 size={12} /> Achieved
                        </Badge>
                      ) : isPaused ? (
                        <Badge variant="neutral" className="flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5">
                          <Pause size={12} /> Paused
                        </Badge>
                      ) : (
                        <Badge variant={badgeVariant} className="font-mono text-[11px] px-2 py-0.5 font-bold">
                          {progress}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Notes / Description */}
                  {goal.notes && (
                    <p className="text-xs text-[var(--app-muted)] line-clamp-2 mb-4 leading-relaxed">
                      {goal.notes}
                    </p>
                  )}

                  {/* Amounts & Progress Track */}
                  <div className="space-y-2.5 my-4">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[var(--app-muted)]">Saved so far</span>
                      <span className="text-[var(--app-muted)]">Target Goal</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl sm:text-2xl font-extrabold font-mono text-[var(--app-fg)] tracking-tight">
                        {formatINR(goal.current_amount)}
                      </span>
                      <span className="text-sm sm:text-base font-semibold font-mono text-[var(--app-muted)]">
                        {formatINR(goal.target_amount)}
                      </span>
                    </div>

                    {/* Visual Progress Track */}
                    <div className="w-full h-2.5 rounded-full bg-[var(--app-card-subtle)] border border-[var(--app-border)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Deadline & Velocity Insights Box */}
                  <div
                    className="p-3 rounded-xl border text-xs space-y-1.5 mb-5 shadow-xs"
                    style={{
                      borderColor: "var(--app-border)",
                      backgroundColor: "var(--app-card-subtle)",
                    }}
                  >
                    {deadline ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[var(--app-muted)]">
                            <Calendar size={13} /> Target Date:
                          </span>
                          <span
                            className={`font-semibold ${
                              deadline.isOverdue && !isCompleted ? "text-rose-400" : "text-[var(--app-fg)]"
                            }`}
                          >
                            {deadline.formattedDate}
                          </span>
                        </div>
                        {!isCompleted && (
                          <div className="flex items-center justify-between pt-1.5 border-t border-[var(--app-border)]">
                            <span className="text-[var(--app-muted)]">
                              {deadline.isOverdue ? (
                                <span className="text-rose-400 flex items-center gap-1 font-medium">
                                  <AlertTriangle size={12} /> Target date passed
                                </span>
                              ) : (
                                <span>{deadline.friendlyRemaining}</span>
                              )}
                            </span>
                            {!deadline.isOverdue && deadline.requiredPerMonth > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-[var(--app-muted)]">Need:</span>
                                <span className="text-emerald-400 font-mono font-bold">
                                  {formatINR(deadline.requiredPerMonth)}/mo
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-[var(--app-muted)]">
                        <span>No fixed deadline set</span>
                        <span>Open milestone</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer with Clean Framed Toolcapsules */}
                <div className="pt-3 border-t border-[var(--app-border)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openDepositModal(goal, "add")}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl cursor-pointer font-semibold shadow-xs"
                    >
                      <Plus size={14} /> Add Funds
                    </Button>
                    {goal.current_amount > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openDepositModal(goal, "withdraw")}
                        className="text-xs px-2.5 py-1.5 rounded-xl cursor-pointer text-[var(--app-muted)] hover:text-[var(--app-fg)] border-[var(--app-border)]"
                        title="Withdraw or adjust saved funds"
                      >
                        Adjust
                      </Button>
                    )}
                  </div>

                  {/* Micro Icon Toolbar with Framed Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(goal)}
                      title={isPaused ? "Resume Goal" : "Pause Goal"}
                      className="w-8 h-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] hover:bg-[var(--app-card-hover)] text-[var(--app-muted)] hover:text-[var(--app-fg)] flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      {isPaused ? <Play size={14} className="text-emerald-400" /> : <Pause size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(goal)}
                      title="Edit Goal"
                      className="w-8 h-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] hover:bg-[var(--app-card-hover)] text-[var(--app-muted)] hover:text-[var(--app-fg)] flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmationId(goal.id)}
                      title="Delete Goal"
                      className="w-8 h-8 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
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
              className="group flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-card-subtle)] transition-all duration-200 cursor-pointer min-h-[260px] text-center"
            >
              <div className="w-12 h-12 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] flex items-center justify-center text-[var(--app-muted)] group-hover:text-[var(--app-accent)] group-hover:scale-110 transition-all mb-3 shadow-xs">
                <Plus size={22} />
              </div>
              <span className="text-sm font-bold text-[var(--app-fg)] group-hover:text-[var(--app-accent)] transition-colors">
                Add Another Goal
              </span>
              <span className="text-xs text-[var(--app-muted)] mt-1 max-w-[210px] leading-relaxed">
                Set milestones for vehicles, education, gadgets, or emergency funds.
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
        size="lg"
      >
        <form onSubmit={handleSubmitGoal} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
              Goal Title *
            </label>
            <Input
              placeholder="e.g. 6 Months Emergency Fund, New Car, Goa Vacation"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Category Select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
                Category
              </label>
              <Select
                value={formCategory}
                onChange={(e) => handleCategorySelect(e.target.value)}
                options={GOAL_CATEGORIES.map((c) => ({
                  value: c.name,
                  label: c.name,
                }))}
              />
            </div>

            {/* Target Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
                Target Deadline
              </label>
              <Input
                type="date"
                value={formTargetDate}
                onChange={(e) => setFormTargetDate(e.target.value)}
              />
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
                Target Amount (₹) *
              </label>
              <Input
                type="number"
                placeholder="100000"
                value={formTargetAmount}
                onChange={(e) => setFormTargetAmount(e.target.value)}
                min="1"
                step="any"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
                Initial Saved Amount (₹)
              </label>
              <Input
                type="number"
                placeholder="0"
                value={formCurrentAmount}
                onChange={(e) => setFormCurrentAmount(e.target.value)}
                min="0"
                step="any"
              />
            </div>
          </div>

          {/* Visual Icon Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
              Card Icon
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 p-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)]">
              {Object.keys(ICON_MAP).map((iconKey) => {
                const IconComp = ICON_MAP[iconKey];
                const isSelected = formIcon === iconKey;
                return (
                  <button
                    key={iconKey}
                    type="button"
                    onClick={() => setFormIcon(iconKey)}
                    className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--app-accent)] text-white shadow-xs scale-105"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[var(--app-card-hover)]"
                    }`}
                  >
                    <IconComp size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Selection (only if editing) */}
          {editingGoal && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
                Status
              </label>
              <Select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                options={[
                  { value: "active", label: "In Progress (Active)" },
                  { value: "completed", label: "Completed (Goal Achieved)" },
                  { value: "paused", label: "Paused" },
                ]}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
              Notes & Motivation (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Invest in Parag Parikh Flexi Cap every month; aim to book flights by Diwali."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] text-[var(--app-fg)] focus:outline-hidden focus:border-[var(--app-accent)] transition-colors resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--app-border)]">
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
              disabled={submitting}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              <span>{editingGoal ? "Save Changes" : "Create Goal"}</span>
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
        <form onSubmit={handleDepositSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--app-muted)] uppercase tracking-wider">
              {depositType === "add" ? "Deposit Amount (₹) *" : "Withdraw Amount (₹) *"}
            </label>
            <Input
              type="number"
              placeholder="5000"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              min="1"
              step="any"
              autoFocus
              required
            />
          </div>

          {/* Quick Preset Amount Chips */}
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--app-muted)]">Quick add amount:</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[1000, 5000, 10000, 25000, 50000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDepositAmount(preset.toString())}
                  className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg border border-[var(--app-border)] bg-[var(--app-card-subtle)] hover:bg-[var(--app-card-hover)] text-[var(--app-fg)] transition-colors cursor-pointer"
                >
                  +{formatINR(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* New Expected Total Preview */}
          {depositAmount && !isNaN(parseFloat(depositAmount)) && depositTargetGoal && (
            <div
              className="p-3 rounded-xl border text-xs space-y-1"
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--app-border)]">
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
              disabled={submitting}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              <span>{depositType === "add" ? "Confirm Deposit" : "Confirm Withdrawal"}</span>
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
            disabled={submitting}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            <span>Delete Permanently</span>
          </Button>
        </div>
      </Modal>
    </main>
  );
}
