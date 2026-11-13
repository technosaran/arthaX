"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  UserPlus,
  HeartHandshake,
  Home,
  ShieldCheck,
  Target,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  X,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Calendar,
  Phone,
  Mail,
  FileText,
  Sparkles,
  Copy,
  Check,
  Share2,
  PiggyBank,
  Car,
  Plane,
  GraduationCap,
  Building,
  HeartPulse,
  Key,
  ShieldAlert,
  ArrowRight,
  Send,
  RefreshCw,
  Coins,
  ChevronRight,
  Info,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getFromLocalCache, saveToLocalCache } from "@/utils/cacheClient";
import { CACHE_KEYS, getUserCacheKey } from "@/utils/redis";

// ==========================================
// TypeScript Interfaces
// ==========================================

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  avatar_color: string;
  monthly_allowance: number;
  current_spending: number;
  role: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface FamilyGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  category: string;
  icon: string;
  assigned_members: string[]; // member names or IDs
  status: "active" | "completed" | "paused";
  notes?: string | null;
  created_at?: string;
}

export interface FamilyResponsibility {
  id: string;
  user_id: string;
  title: string;
  assigned_to?: string | null;
  amount: number;
  frequency: string;
  due_date?: string | null;
  category: string;
  is_completed: boolean;
  notes?: string | null;
  created_at?: string;
}

export interface EmergencyVaultItem {
  id: string;
  user_id: string;
  title: string;
  type: "insurance" | "medical" | "contact" | "home" | "financial" | "other";
  provider_or_name: string;
  reference_number?: string | null;
  contact_number?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
}

// ==========================================
// Constants & Options
// ==========================================

const RELATIONSHIPS = [
  "Spouse",
  "Partner",
  "Child",
  "Parent",
  "Sibling",
  "Household Staff",
  "Other Dependent",
];

const ROLES = [
  { value: "co-manager", label: "Co-Manager (Full Access)" },
  { value: "member", label: "Member (Standard)" },
  { value: "dependent", label: "Dependent / Child" },
];

const AVATAR_COLORS = [
  "#4bb473", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#df514c", // Red
  "#14B8A6", // Teal
  "#E11D48", // Rose
];

const GOAL_CATEGORIES = [
  { label: "Vacation & Travel", icon: Plane, color: "#3B82F6" },
  { label: "House & Property", icon: Building, color: "#8B5CF6" },
  { label: "Child Education", icon: GraduationCap, color: "#EC4899" },
  { label: "Vehicle & Car", icon: Car, color: "#F59E0B" },
  { label: "Emergency Buffer", icon: ShieldCheck, color: "#4bb473" },
  { label: "Festive & Shopping", icon: PiggyBank, color: "#06B6D4" },
  { label: "General Milestone", icon: HeartHandshake, color: "#14B8A6" },
];

const RESPONSIBILITY_CATEGORIES = [
  "Society & Rent",
  "Bills & Utilities",
  "Groceries & Food",
  "Tuition & Education",
  "Domestic Staff",
  "Medical & Health",
  "Vehicle & Fuel",
  "Other Household",
];

const VAULT_TYPES = [
  { value: "insurance", label: "Health & Life Insurance", icon: ShieldAlert },
  { value: "medical", label: "Doctor & Hospital SOS", icon: HeartPulse },
  { value: "home", label: "Home Security & Services", icon: Home },
  { value: "contact", label: "Emergency Contact / Family SOS", icon: Phone },
  { value: "financial", label: "CA / Banking / Locker", icon: Key },
  { value: "other", label: "Other Document / Policy", icon: FileText },
];

// Starter template for new users
const STARTER_MEMBERS: Omit<FamilyMember, "id" | "user_id">[] = [
  {
    name: "Priya (Spouse)",
    relationship: "Spouse",
    avatar_color: "#EC4899",
    monthly_allowance: 25000,
    current_spending: 14200,
    role: "co-manager",
    email: "priya@example.com",
    phone: "+91 98765 43210",
    notes: "Manages household groceries and utilities",
  },
  {
    name: "Aarav (Kid)",
    relationship: "Child",
    avatar_color: "#3B82F6",
    monthly_allowance: 5000,
    current_spending: 2800,
    role: "dependent",
    email: null,
    phone: null,
    notes: "School stationery, hobbies, and sports activities",
  },
];

const STARTER_GOALS: Omit<FamilyGoal, "id" | "user_id">[] = [
  {
    title: "Annual Family Vacation to Goa",
    target_amount: 150000,
    current_amount: 85000,
    target_date: "2026-12-20",
    category: "Vacation & Travel",
    icon: "Plane",
    assigned_members: ["Priya (Spouse)", "Self"],
    status: "active",
    notes: "Flights, beach resort booking, and local activities fund",
  },
  {
    title: "Kid's Higher Education Fund",
    target_amount: 500000,
    current_amount: 240000,
    target_date: "2028-06-30",
    category: "Child Education",
    icon: "GraduationCap",
    assigned_members: ["Priya (Spouse)", "Self"],
    status: "active",
    notes: "Long term college and competitive coaching reserve",
  },
];

const STARTER_RESPONSIBILITIES: Omit<FamilyResponsibility, "id" | "user_id">[] = [
  {
    title: "Apartment Society Maintenance",
    assigned_to: "Self",
    amount: 5200,
    frequency: "monthly",
    due_date: "05th of every month",
    category: "Society & Rent",
    is_completed: true,
    notes: "Pay via MyGate app before the 10th to avoid late penalty",
  },
  {
    title: "Electricity & Water Bill (BESCOM)",
    assigned_to: "Priya (Spouse)",
    amount: 3800,
    frequency: "monthly",
    due_date: "14th of every month",
    category: "Bills & Utilities",
    is_completed: false,
    notes: "Auto-pay debit linked to HDFC account",
  },
  {
    title: "House Cook & Housekeeping Salary",
    assigned_to: "Priya (Spouse)",
    amount: 12000,
    frequency: "monthly",
    due_date: "01st of every month",
    category: "Domestic Staff",
    is_completed: true,
    notes: "Direct UPI transfer on 1st morning",
  },
];

const STARTER_VAULT: Omit<EmergencyVaultItem, "id" | "user_id">[] = [
  {
    title: "Family Floater Health Insurance",
    type: "insurance",
    provider_or_name: "Star Health & Allied Insurance",
    reference_number: "P/211112/01/2026/004928",
    contact_number: "1800-425-2255",
    notes: "₹25 Lakhs cover for self, spouse, and child. Cashless TPA card in cabinet.",
  },
  {
    title: "Pediatrician & Family Clinic",
    type: "medical",
    provider_or_name: "Dr. Rajesh Kulkarni (Apollo Cradle)",
    reference_number: "Reg # 48291-KA",
    contact_number: "+91 98450 11223",
    notes: "Available 24x7 for urgent child emergencies and vaccinations.",
  },
  {
    title: "Apartment 24/7 Security & Maintenance Desk",
    type: "home",
    provider_or_name: "Palm Meadows Society Security Gate",
    reference_number: "Intercom Ext: 101",
    contact_number: "+91 80 4123 9999",
    notes: "Emergency electrician, plumber, and main water valve cutoff.",
  },
];

export default function FamilySection() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<"members" | "goals" | "planning" | "safety">("members");

  // Multi-tier cache keys
  const membersKey = getUserCacheKey(user?.id, CACHE_KEYS.FAMILY_MEMBERS);
  const goalsKey = getUserCacheKey(user?.id, CACHE_KEYS.FAMILY_GOALS);
  const responsibilitiesKey = getUserCacheKey(user?.id, CACHE_KEYS.FAMILY_RESPONSIBILITIES);
  const vaultKey = getUserCacheKey(user?.id, CACHE_KEYS.FAMILY_VAULT);
  const accountsKey = getUserCacheKey(user?.id, CACHE_KEYS.ACCOUNTS);

  // States initialized from 0ms Tier 1/2 Local Cache
  const [members, setMembers] = useState<FamilyMember[]>(() => getFromLocalCache<FamilyMember[]>(membersKey) || []);
  const [goals, setGoals] = useState<FamilyGoal[]>(() => getFromLocalCache<FamilyGoal[]>(goalsKey) || []);
  const [responsibilities, setResponsibilities] = useState<FamilyResponsibility[]>(() => getFromLocalCache<FamilyResponsibility[]>(responsibilitiesKey) || []);
  const [vaultItems, setVaultItems] = useState<EmergencyVaultItem[]>(() => getFromLocalCache<EmergencyVaultItem[]>(vaultKey) || []);
  const [accounts, setAccounts] = useState<AccountItem[]>(() => getFromLocalCache<AccountItem[]>(accountsKey) || []);

  const [loading, setLoading] = useState<boolean>(() => members.length === 0 && goals.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [seedingTemplate, setSeedingTemplate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter for Household Planning
  const [planningFilter, setPlanningFilter] = useState<"all" | "pending" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  const [spendModalOpen, setSpendModalOpen] = useState(false);
  const [spendMember, setSpendMember] = useState<FamilyMember | null>(null);
  const [spendAmountInput, setSpendAmountInput] = useState("");
  const [spendActionType, setSpendActionType] = useState<"add" | "reset">("add");

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FamilyGoal | null>(null);

  const [contributeModalOpen, setContributeModalOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<FamilyGoal | null>(null);
  const [contributeAmountInput, setContributeAmountInput] = useState("");

  const [respModalOpen, setRespModalOpen] = useState(false);
  const [editingResp, setEditingResp] = useState<FamilyResponsibility | null>(null);

  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [editingVault, setEditingVault] = useState<EmergencyVaultItem | null>(null);

  // Currency Formatter
  const formatINR = useCallback((val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  }, []);

  // ==========================================
  // Fetch All Family Data
  // ==========================================
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    try {
      const supabase = createClient();

      const [mRes, gRes, rRes, vRes, aRes] = await Promise.all([
        supabase.from("family_members").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("family_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("family_responsibilities").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("family_emergency_vault").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("accounts").select("id, name, type, balance").eq("user_id", user.id),
      ]);

      if (mRes.data) {
        const mappedMembers: FamilyMember[] = mRes.data.map((item) => ({
          ...item,
          monthly_allowance: Number(item.monthly_allowance) || 0,
          current_spending: Number(item.current_spending) || 0,
        }));
        setMembers(mappedMembers);
        saveToLocalCache(membersKey, mappedMembers, 3600);
      }

      if (gRes.data) {
        const mappedGoals: FamilyGoal[] = gRes.data.map((item) => ({
          ...item,
          target_amount: Number(item.target_amount) || 0,
          current_amount: Number(item.current_amount) || 0,
          assigned_members: Array.isArray(item.assigned_members) ? item.assigned_members : [],
        }));
        setGoals(mappedGoals);
        saveToLocalCache(goalsKey, mappedGoals, 3600);
      }

      if (rRes.data) {
        const mappedResp: FamilyResponsibility[] = rRes.data.map((item) => ({
          ...item,
          amount: Number(item.amount) || 0,
          is_completed: !!item.is_completed,
        }));
        setResponsibilities(mappedResp);
        saveToLocalCache(responsibilitiesKey, mappedResp, 3600);
      }

      if (vRes.data) {
        setVaultItems(vRes.data);
        saveToLocalCache(vaultKey, vRes.data, 3600);
      }

      if (aRes.data) {
        const mappedAccounts: AccountItem[] = aRes.data.map((item) => ({
          ...item,
          balance: Number(item.balance) || 0,
        }));
        setAccounts(mappedAccounts);
        saveToLocalCache(accountsKey, mappedAccounts, 3600);
      }
    } catch (err) {
      console.error("[FamilySection] Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [user, membersKey, goalsKey, responsibilitiesKey, vaultKey, accountsKey]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "family_goals" }, () => fetchAllData())
      .on("postgres_changes", { event: "*", schema: "public", table: "family_responsibilities" }, () => fetchAllData())
      .on("postgres_changes", { event: "*", schema: "public", table: "family_emergency_vault" }, () => fetchAllData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAllData]);

  // ==========================================
  // Calculated Metrics
  // ==========================================
  const totalMonthlyAllowance = useMemo(
    () => members.reduce((sum, m) => sum + (Number(m.monthly_allowance) || 0), 0),
    [members]
  );

  const totalCurrentSpending = useMemo(
    () => members.reduce((sum, m) => sum + (Number(m.current_spending) || 0), 0),
    [members]
  );

  const totalGoalsTarget = useMemo(
    () => goals.reduce((sum, g) => sum + (Number(g.target_amount) || 0), 0),
    [goals]
  );

  const totalGoalsSaved = useMemo(
    () => goals.reduce((sum, g) => sum + (Number(g.current_amount) || 0), 0),
    [goals]
  );

  const goalsProgressPercent = useMemo(() => {
    if (totalGoalsTarget <= 0) return 0;
    return Math.min(100, Math.round((totalGoalsSaved / totalGoalsTarget) * 100));
  }, [totalGoalsSaved, totalGoalsTarget]);

  const totalHouseholdBills = useMemo(
    () => responsibilities.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [responsibilities]
  );

  const paidHouseholdBills = useMemo(
    () =>
      responsibilities
        .filter((r) => r.is_completed)
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [responsibilities]
  );

  const pendingHouseholdBillsCount = useMemo(
    () => responsibilities.filter((r) => !r.is_completed).length,
    [responsibilities]
  );

  // Total Liquid Capital (Savings accounts + Cash)
  const totalLiquidCash = useMemo(() => {
    return accounts
      .filter((a) => {
        const t = (a.type || "").toLowerCase();
        return (
          t.includes("savings") ||
          t.includes("cash") ||
          t.includes("current") ||
          t.includes("checking") ||
          t.includes("liquid")
        );
      })
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  // Monthly Family Burn Rate = Household Responsibilities + Member Allowances
  const monthlyBurnRate = useMemo(
    () => Math.max(1, totalHouseholdBills + totalMonthlyAllowance),
    [totalHouseholdBills, totalMonthlyAllowance]
  );

  // Emergency runway in months
  const emergencyRunwayMonths = useMemo(() => {
    if (monthlyBurnRate <= 0) return 0;
    return Number((totalLiquidCash / monthlyBurnRate).toFixed(1));
  }, [totalLiquidCash, monthlyBurnRate]);

  // ==========================================
  // Quick Copy Helper
  // ==========================================
  const handleCopy = (text: string, id: string) => {
    if (typeof window !== "undefined" && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast("Copied to clipboard", "success");
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // ==========================================
  // Seed Starter Template
  // ==========================================
  const handleSeedTemplate = async () => {
    if (!user) return;
    setSeedingTemplate(true);
    try {
      const supabase = createClient();

      const memberPayloads = STARTER_MEMBERS.map((m) => ({ ...m, user_id: user.id }));
      const goalPayloads = STARTER_GOALS.map((g) => ({ ...g, user_id: user.id }));
      const respPayloads = STARTER_RESPONSIBILITIES.map((r) => ({ ...r, user_id: user.id }));
      const vaultPayloads = STARTER_VAULT.map((v) => ({ ...v, user_id: user.id }));

      await Promise.all([
        supabase.from("family_members").insert(memberPayloads),
        supabase.from("family_goals").insert(goalPayloads),
        supabase.from("family_responsibilities").insert(respPayloads),
        supabase.from("family_emergency_vault").insert(vaultPayloads),
      ]);

      showToast("Family starter workspace loaded successfully!", "success");
      await fetchAllData();
    } catch (err) {
      console.error("Failed to seed template:", err);
      showToast("Unable to load starter template. Please try again.", "error");
    } finally {
      setSeedingTemplate(false);
    }
  };

  // ==========================================
  // Copy Household Overview for WhatsApp / Family
  // ==========================================
  const handleShareSummary = () => {
    const summary = `🏡 *arthaX Household Pulse*\n` +
      `👥 Family Members: ${members.length}\n` +
      `💰 Monthly Allowance Pool: ${formatINR(totalMonthlyAllowance)} (Spent: ${formatINR(totalCurrentSpending)})\n` +
      `🎯 Shared Goals Saved: ${formatINR(totalGoalsSaved)} of ${formatINR(totalGoalsTarget)} (${goalsProgressPercent}%)\n` +
      `📋 Pending Bills: ${pendingHouseholdBillsCount} (${formatINR(totalHouseholdBills - paidHouseholdBills)} remaining)\n` +
      `🛡️ Emergency Runway: ${emergencyRunwayMonths} months covered`;

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(summary);
      showToast("Household summary copied for sharing!", "success");
    }
  };

  // ==========================================
  // Member Operations
  // ==========================================
  const handleSaveMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name")?.toString().trim() || "";
    const relationship = formData.get("relationship")?.toString() || "Spouse";
    const role = formData.get("role")?.toString() || "member";
    const monthly_allowance = parseFloat(formData.get("monthly_allowance")?.toString() || "0") || 0;
    const avatar_color = formData.get("avatar_color")?.toString() || "#4bb473";
    const email = formData.get("email")?.toString().trim() || null;
    const phone = formData.get("phone")?.toString().trim() || null;
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
            role,
            monthly_allowance,
            avatar_color,
            email,
            phone,
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
          role,
          monthly_allowance,
          current_spending: 0,
          avatar_color,
          email,
          phone,
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
    if (!confirm(`Are you sure you want to remove ${name} from your family space?`)) return;
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

  const handleAdjustSpending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !spendMember) return;
    setSubmitting(true);

    const val = parseFloat(spendAmountInput) || 0;
    if (spendActionType === "add" && val <= 0) {
      showToast("Please enter a valid amount", "error");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      const newSpending =
        spendActionType === "reset"
          ? 0
          : Number((Number(spendMember.current_spending || 0) + val).toFixed(2));

      const { error } = await supabase
        .from("family_members")
        .update({ current_spending: newSpending })
        .eq("id", spendMember.id)
        .eq("user_id", user.id);

      if (error) throw error;
      showToast(
        spendActionType === "reset"
          ? `Spending counter reset for ${spendMember.name}`
          : `Added ${formatINR(val)} spend for ${spendMember.name}`,
        "success"
      );

      setSpendModalOpen(false);
      setSpendMember(null);
      setSpendAmountInput("");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to adjust spending", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // Goal Operations
  // ==========================================
  const handleSaveGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title")?.toString().trim() || "";
    const target_amount = parseFloat(formData.get("target_amount")?.toString() || "0") || 0;
    const current_amount = parseFloat(formData.get("current_amount")?.toString() || "0") || 0;
    const target_date = formData.get("target_date")?.toString() || null;
    const category = formData.get("category")?.toString() || "General Milestone";
    const status = (formData.get("status")?.toString() || "active") as "active" | "completed" | "paused";
    const notes = formData.get("notes")?.toString().trim() || null;

    // Collect selected members
    const selectedMembers = formData.getAll("assigned_members").map(String);

    if (!title || target_amount <= 0) {
      showToast("Please enter a title and valid target amount", "error");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();

      if (editingGoal) {
        const { error } = await supabase
          .from("family_goals")
          .update({
            title,
            target_amount,
            current_amount,
            target_date,
            category,
            assigned_members: selectedMembers,
            status,
            notes,
          })
          .eq("id", editingGoal.id)
          .eq("user_id", user.id);

        if (error) throw error;
        showToast("Shared goal updated", "success");
      } else {
        const { error } = await supabase.from("family_goals").insert({
          user_id: user.id,
          title,
          target_amount,
          current_amount,
          target_date,
          category,
          icon: "Target",
          assigned_members: selectedMembers,
          status,
          notes,
        });

        if (error) throw error;
        showToast("New shared goal created", "success");
      }

      setGoalModalOpen(false);
      setEditingGoal(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to save goal", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContributeGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !contributeGoal) return;
    setSubmitting(true);

    const val = parseFloat(contributeAmountInput) || 0;
    if (val <= 0) {
      showToast("Please enter an amount to contribute", "error");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      const updatedSaved = Number((Number(contributeGoal.current_amount || 0) + val).toFixed(2));
      const isReached = updatedSaved >= contributeGoal.target_amount;

      const { error } = await supabase
        .from("family_goals")
        .update({
          current_amount: updatedSaved,
          status: isReached ? "completed" : contributeGoal.status,
        })
        .eq("id", contributeGoal.id)
        .eq("user_id", user.id);

      if (error) throw error;
      showToast(
        isReached
          ? `🎉 Goal reached! Contributed ${formatINR(val)} to ${contributeGoal.title}!`
          : `Contributed ${formatINR(val)} to ${contributeGoal.title}`,
        "success"
      );

      setContributeModalOpen(false);
      setContributeGoal(null);
      setContributeAmountInput("");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to record contribution", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete goal: "${title}"?`)) return;
    if (!user) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from("family_goals").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      showToast("Goal deleted", "success");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete goal", "error");
    }
  };

  // ==========================================
  // Household Planning / Responsibilities
  // ==========================================
  const handleToggleResp = async (resp: FamilyResponsibility) => {
    if (!user) return;
    const newStatus = !resp.is_completed;

    // Optimistic UI update
    setResponsibilities((prev) =>
      prev.map((r) => (r.id === resp.id ? { ...r, is_completed: newStatus } : r))
    );

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("family_responsibilities")
        .update({ is_completed: newStatus })
        .eq("id", resp.id)
        .eq("user_id", user.id);

      if (error) throw error;
      showToast(
        newStatus ? `Marked "${resp.title}" as completed` : `Marked "${resp.title}" as pending`,
        "success"
      );
      saveToLocalCache(
        responsibilitiesKey,
        responsibilities.map((r) => (r.id === resp.id ? { ...r, is_completed: newStatus } : r))
      );
    } catch (err) {
      console.error(err);
      showToast("Failed to update status", "error");
      await fetchAllData();
    }
  };

  const handleSaveResp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title")?.toString().trim() || "";
    const assigned_to = formData.get("assigned_to")?.toString() || "Self";
    const amount = parseFloat(formData.get("amount")?.toString() || "0") || 0;
    const frequency = formData.get("frequency")?.toString() || "monthly";
    const due_date = formData.get("due_date")?.toString().trim() || null;
    const category = formData.get("category")?.toString() || "Bills & Utilities";
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!title) {
      showToast("Please enter a title for the responsibility", "error");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();

      if (editingResp) {
        const { error } = await supabase
          .from("family_responsibilities")
          .update({
            title,
            assigned_to,
            amount,
            frequency,
            due_date,
            category,
            notes,
          })
          .eq("id", editingResp.id)
          .eq("user_id", user.id);

        if (error) throw error;
        showToast("Household duty updated", "success");
      } else {
        const { error } = await supabase.from("family_responsibilities").insert({
          user_id: user.id,
          title,
          assigned_to,
          amount,
          frequency,
          due_date,
          category,
          is_completed: false,
          notes,
        });

        if (error) throw error;
        showToast("New household duty added", "success");
      }

      setRespModalOpen(false);
      setEditingResp(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to save duty", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResp = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    if (!user) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from("family_responsibilities").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      showToast("Responsibility removed", "success");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete item", "error");
    }
  };

  // ==========================================
  // Emergency Vault Operations
  // ==========================================
  const handleSaveVault = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title")?.toString().trim() || "";
    const type = (formData.get("type")?.toString() || "insurance") as EmergencyVaultItem["type"];
    const provider_or_name = formData.get("provider_or_name")?.toString().trim() || "";
    const reference_number = formData.get("reference_number")?.toString().trim() || null;
    const contact_number = formData.get("contact_number")?.toString().trim() || null;
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!title || !provider_or_name) {
      showToast("Please provide both a title and provider / contact name", "error");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();

      if (editingVault) {
        const { error } = await supabase
          .from("family_emergency_vault")
          .update({
            title,
            type,
            provider_or_name,
            reference_number,
            contact_number,
            notes,
          })
          .eq("id", editingVault.id)
          .eq("user_id", user.id);

        if (error) throw error;
        showToast("Vault record updated", "success");
      } else {
        const { error } = await supabase.from("family_emergency_vault").insert({
          user_id: user.id,
          title,
          type,
          provider_or_name,
          reference_number,
          contact_number,
          notes,
        });

        if (error) throw error;
        showToast("New emergency record secured", "success");
      }

      setVaultModalOpen(false);
      setEditingVault(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to save emergency record", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVault = async (id: string, title: string) => {
    if (!confirm(`Delete vault entry: "${title}"?`)) return;
    if (!user) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from("family_emergency_vault").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      showToast("Emergency record deleted", "success");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete record", "error");
    }
  };

  // Filtered responsibilities
  const filteredResponsibilities = useMemo(() => {
    return responsibilities.filter((r) => {
      const matchesFilter =
        planningFilter === "all" ||
        (planningFilter === "pending" && !r.is_completed) ||
        (planningFilter === "completed" && r.is_completed);

      const matchesSearch =
        !searchQuery ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.assigned_to && r.assigned_to.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.category && r.category.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesFilter && matchesSearch;
    });
  }, [responsibilities, planningFilter, searchQuery]);

  // Loading indicator for initial empty state
  if (loading) {
    return (
      <main
        className="flex-1 h-full p-4 sm:p-8 flex items-center justify-center select-none"
        style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
          <p className="text-xs font-mono opacity-60">Synchronizing family workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex-1 h-full p-4 sm:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* =========================================================================
          Top Header Bar
          ========================================================================= */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Family Finance Hub</h1>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold"
              style={{
                backgroundColor: "var(--app-accent-subtle)",
                color: "var(--app-accent)",
                borderColor: "var(--app-border-subtle)",
              }}
            >
              Collaborative Space
            </span>
          </div>
          <p className="text-xs opacity-70 mt-1">
            Household allowances, shared savings goals, recurring duties, and emergency vault.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {members.length === 0 && goals.length === 0 && (
            <button
              onClick={handleSeedTemplate}
              disabled={seedingTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer opacity-90 hover:opacity-100"
              style={{
                borderColor: "var(--app-accent)",
                color: "var(--app-accent)",
                backgroundColor: "var(--app-accent-subtle)",
              }}
              title="Prepopulate sample family members, goals, and recurring duties"
            >
              {seedingTemplate ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Load Example Household
            </button>
          )}

          <button
            onClick={handleShareSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer opacity-80 hover:opacity-100"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-card)",
              color: "var(--app-fg)",
            }}
            title="Copy household summary text for WhatsApp family group"
          >
            <Share2 size={13} />
            <span className="hidden sm:inline">Share Summary</span>
          </button>

          {/* Dynamic Add Button depending on active tab */}
          {activeSubTab === "members" && (
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
          )}

          {activeSubTab === "goals" && (
            <button
              onClick={() => {
                setEditingGoal(null);
                setGoalModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
              style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
            >
              <Plus size={14} />
              New Goal
            </button>
          )}

          {activeSubTab === "planning" && (
            <button
              onClick={() => {
                setEditingResp(null);
                setRespModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
              style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
            >
              <Plus size={14} />
              Add Duty
            </button>
          )}

          {activeSubTab === "safety" && (
            <button
              onClick={() => {
                setEditingVault(null);
                setVaultModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
              style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
            >
              <Plus size={14} />
              Add Policy / SOS
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          Top 4 KPI Metric Summary Cards
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Family Roster */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">Household Roster</span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-accent-subtle)" }}
            >
              <Users size={14} style={{ color: "var(--app-accent)" }} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono">{members.length} Members</div>
            <div className="text-xs opacity-60 mt-1 flex items-center gap-1.5">
              <span>{members.filter((m) => m.role === "co-manager" || m.role === "admin").length} Co-Managers</span>
              <span>•</span>
              <span>{members.filter((m) => m.relationship === "Child" || m.role === "dependent").length} Dependents</span>
            </div>
          </div>
        </div>

        {/* Card 2: Monthly Allowances */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">Monthly Allowance Pool</span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-amber-400"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "rgba(245, 158, 11, 0.12)" }}
            >
              <Coins size={14} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono">{formatINR(totalMonthlyAllowance)}</div>
            <div className="text-xs opacity-60 mt-1 flex items-center justify-between">
              <span>Spent: {formatINR(totalCurrentSpending)}</span>
              <span className="font-mono font-medium">
                {totalMonthlyAllowance > 0
                  ? `${Math.round((totalCurrentSpending / totalMonthlyAllowance) * 100)}%`
                  : "0%"}
              </span>
            </div>
            {/* Mini Progress */}
            <div
              className="w-full h-1.5 rounded-full mt-2 overflow-hidden"
              style={{ backgroundColor: "var(--app-track-bg)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, totalMonthlyAllowance > 0 ? (totalCurrentSpending / totalMonthlyAllowance) * 100 : 0)}%`,
                  backgroundColor:
                    totalCurrentSpending > totalMonthlyAllowance
                      ? "var(--app-loss)"
                      : totalCurrentSpending > totalMonthlyAllowance * 0.8
                      ? "#F59E0B"
                      : "var(--app-accent)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Goals Progress */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">Joint Goals Saved</span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center text-sky-400"
              style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "rgba(56, 189, 248, 0.12)" }}
            >
              <HeartHandshake size={14} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono">{formatINR(totalGoalsSaved)}</div>
            <div className="text-xs opacity-60 mt-1 flex items-center justify-between">
              <span>Target: {formatINR(totalGoalsTarget)}</span>
              <span className="font-mono font-medium">{goalsProgressPercent}%</span>
            </div>
            {/* Mini Progress */}
            <div
              className="w-full h-1.5 rounded-full mt-2 overflow-hidden"
              style={{ backgroundColor: "var(--app-track-bg)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${goalsProgressPercent}%`,
                  backgroundColor: "#38BDF8",
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Emergency Runway */}
        <div
          className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider opacity-60">Family Emergency Runway</span>
            <span
              className="w-7 h-7 rounded-lg border flex items-center justify-center"
              style={{
                borderColor: "var(--app-border-subtle)",
                backgroundColor: emergencyRunwayMonths >= 6 ? "var(--app-accent-subtle)" : "rgba(223, 81, 76, 0.12)",
                color: emergencyRunwayMonths >= 6 ? "var(--app-accent)" : "var(--app-loss)",
              }}
            >
              <ShieldCheck size={14} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight font-mono">
              {emergencyRunwayMonths} <span className="text-sm font-normal opacity-70">Months</span>
            </div>
            <p className="text-xs opacity-60 mt-1 truncate">
              {emergencyRunwayMonths >= 6
                ? "Rock Solid • 6+ mo buffer"
                : emergencyRunwayMonths >= 3
                ? "Adequate • Aim for 6 months"
                : "Tight buffer • Expand liquid cash"}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          Sub-Navigation Segmented Tabs
          ========================================================================= */}
      <div className="flex items-center gap-2 border-b pb-4 mb-6 overflow-x-auto" style={{ borderColor: "var(--app-border)" }}>
        <button
          onClick={() => setActiveSubTab("members")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "members" ? "font-bold shadow-sm" : "opacity-70 hover:opacity-100"
          }`}
          style={{
            backgroundColor: activeSubTab === "members" ? "var(--app-card)" : "transparent",
            borderColor: activeSubTab === "members" ? "var(--app-border)" : "transparent",
            color: activeSubTab === "members" ? "var(--app-accent)" : "var(--app-fg)",
          }}
        >
          <Users size={14} />
          <span>Members & Allowances</span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.2 rounded-full"
            style={{ backgroundColor: "var(--app-border)", color: "var(--app-fg)" }}
          >
            {members.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("goals")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "goals" ? "font-bold shadow-sm" : "opacity-70 hover:opacity-100"
          }`}
          style={{
            backgroundColor: activeSubTab === "goals" ? "var(--app-card)" : "transparent",
            borderColor: activeSubTab === "goals" ? "var(--app-border)" : "transparent",
            color: activeSubTab === "goals" ? "#38BDF8" : "var(--app-fg)",
          }}
        >
          <HeartHandshake size={14} />
          <span>Shared Goals & Plans</span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.2 rounded-full"
            style={{ backgroundColor: "var(--app-border)", color: "var(--app-fg)" }}
          >
            {goals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("planning")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "planning" ? "font-bold shadow-sm" : "opacity-70 hover:opacity-100"
          }`}
          style={{
            backgroundColor: activeSubTab === "planning" ? "var(--app-card)" : "transparent",
            borderColor: activeSubTab === "planning" ? "var(--app-border)" : "transparent",
            color: activeSubTab === "planning" ? "#F59E0B" : "var(--app-fg)",
          }}
        >
          <Home size={14} />
          <span>Household Duties & Bills</span>
          {pendingHouseholdBillsCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.2 rounded-full text-white"
              style={{ backgroundColor: "#df514c" }}
            >
              {pendingHouseholdBillsCount} Due
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("safety")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "safety" ? "font-bold shadow-sm" : "opacity-70 hover:opacity-100"
          }`}
          style={{
            backgroundColor: activeSubTab === "safety" ? "var(--app-card)" : "transparent",
            borderColor: activeSubTab === "safety" ? "var(--app-border)" : "transparent",
            color: activeSubTab === "safety" ? "var(--app-accent)" : "var(--app-fg)",
          }}
        >
          <ShieldCheck size={14} />
          <span>Emergency Vault & SOS</span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.2 rounded-full"
            style={{ backgroundColor: "var(--app-border)", color: "var(--app-fg)" }}
          >
            {vaultItems.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: FAMILY MEMBERS & ALLOWANCES
          ========================================================================= */}
      {activeSubTab === "members" && (
        <div className="space-y-6 animate-in fade-in duration-150">
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
                <h3 className="text-base font-bold">No Family Members Added Yet</h3>
                <p className="text-xs opacity-70 mt-1">
                  Add your partner, children, or household members to manage monthly allowances, oversee spending limits, and coordinate shared household wealth.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setEditingMember(null);
                    setMemberModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm"
                  style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
                >
                  <UserPlus size={14} />
                  Add First Member
                </button>
                <button
                  onClick={handleSeedTemplate}
                  disabled={seedingTemplate}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-100 opacity-80"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  Load Example Household
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => {
                const initials = member.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const allowance = Number(member.monthly_allowance) || 0;
                const spending = Number(member.current_spending) || 0;
                const remaining = allowance - spending;
                const percentSpent = allowance > 0 ? Math.round((spending / allowance) * 100) : 0;

                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border p-5 flex flex-col justify-between transition-all hover:border-[var(--app-accent)]"
                    style={{
                      backgroundColor: "var(--app-card)",
                      borderColor: "var(--app-border)",
                    }}
                  >
                    <div>
                      {/* Member Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-sm flex-shrink-0"
                            style={{ backgroundColor: member.avatar_color || "#4bb473" }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold tracking-tight">{member.name}</h3>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] opacity-60 mt-0.5">
                              <span>{member.relationship}</span>
                              <span>•</span>
                              <span className="capitalize">{member.role}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMember(member);
                              setMemberModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                            style={{ borderColor: "var(--app-border-subtle)" }}
                            title="Edit Member"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id, member.name)}
                            className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer text-rose-400"
                            style={{ borderColor: "var(--app-border-subtle)" }}
                            title="Remove Member"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Allowance & Spending Metric */}
                      <div
                        className="mt-4 p-3.5 rounded-xl border space-y-2"
                        style={{
                          backgroundColor: "var(--app-bg)",
                          borderColor: "var(--app-border-subtle)",
                        }}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="opacity-70">Monthly Allowance</span>
                          <span className="font-mono font-bold">{formatINR(allowance)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="opacity-70">Current Spending</span>
                          <span
                            className="font-mono font-semibold"
                            style={{
                              color: spending > allowance ? "var(--app-loss)" : "inherit",
                            }}
                          >
                            {formatINR(spending)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div
                          className="w-full h-2 rounded-full overflow-hidden"
                          style={{ backgroundColor: "var(--app-track-bg)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, percentSpent)}%`,
                              backgroundColor:
                                spending > allowance
                                  ? "var(--app-loss)"
                                  : percentSpent > 80
                                  ? "#F59E0B"
                                  : member.avatar_color || "var(--app-accent)",
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="opacity-60">{percentSpent}% utilized</span>
                          <span
                            className="font-mono font-medium"
                            style={{
                              color: remaining < 0 ? "var(--app-loss)" : "var(--app-accent)",
                            }}
                          >
                            {remaining < 0 ? `${formatINR(Math.abs(remaining))} Over` : `${formatINR(remaining)} Left`}
                          </span>
                        </div>
                      </div>

                      {/* Contact / Notes */}
                      {(member.phone || member.email || member.notes) && (
                        <div className="mt-3 text-[11px] space-y-1 opacity-70">
                          {member.phone && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Phone size={11} className="opacity-60" />
                              <span>{member.phone}</span>
                            </div>
                          )}
                          {member.email && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail size={11} className="opacity-60" />
                              <span>{member.email}</span>
                            </div>
                          )}
                          {member.notes && (
                            <p className="italic text-[10px] opacity-60 line-clamp-2 mt-1">"{member.notes}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Quick Adjust / Record Spend */}
                    <div className="pt-4 mt-4 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--app-border-subtle)" }}>
                      <button
                        onClick={() => {
                          setSpendMember(member);
                          setSpendActionType("add");
                          setSpendModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-100 cursor-pointer"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-bg)",
                        }}
                      >
                        <Plus size={12} />
                        Log Spend
                      </button>
                      <button
                        onClick={() => {
                          setSpendMember(member);
                          setSpendActionType("reset");
                          setSpendModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-opacity opacity-60 hover:opacity-100 cursor-pointer"
                        style={{
                          borderColor: "var(--app-border-subtle)",
                        }}
                        title="Reset spending counter for the month"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: SHARED GOALS & MILESTONES
          ========================================================================= */}
      {activeSubTab === "goals" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {goals.length === 0 ? (
            <div
              className="rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-4"
              style={{ backgroundColor: "var(--app-card)", borderColor: "var(--app-border)" }}
            >
              <div
                className="w-14 h-14 rounded-2xl border flex items-center justify-center text-sky-400"
                style={{ backgroundColor: "rgba(56, 189, 248, 0.12)", borderColor: "var(--app-border-subtle)" }}
              >
                <HeartHandshake size={28} />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold">No Shared Family Goals Yet</h3>
                <p className="text-xs opacity-70 mt-1">
                  Create savings milestones together: annual family vacation, kid's education fund, emergency reserve, or dream car downpayment.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingGoal(null);
                  setGoalModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm"
                style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
              >
                <Plus size={14} />
                Create First Goal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((goal) => {
                const target = Number(goal.target_amount) || 0;
                const saved = Number(goal.current_amount) || 0;
                const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
                const remaining = Math.max(0, target - saved);

                const catMeta = GOAL_CATEGORIES.find((c) => c.label === goal.category) || {
                  label: goal.category,
                  icon: Target,
                  color: "#3B82F6",
                };
                const CatIcon = catMeta.icon;

                return (
                  <div
                    key={goal.id}
                    className="rounded-2xl border p-5 flex flex-col justify-between transition-all hover:border-sky-400/50"
                    style={{
                      backgroundColor: "var(--app-card)",
                      borderColor: "var(--app-border)",
                    }}
                  >
                    <div>
                      {/* Goal Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: "var(--app-border-subtle)",
                              backgroundColor: `${catMeta.color}18`,
                              color: catMeta.color,
                            }}
                          >
                            <CatIcon size={18} />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold tracking-tight line-clamp-1">{goal.title}</h3>
                            <div className="flex items-center gap-2 text-[11px] opacity-60 mt-0.5">
                              <span>{goal.category}</span>
                              {goal.target_date && (
                                <>
                                  <span>•</span>
                                  <span>Target: {new Date(goal.target_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingGoal(goal);
                              setGoalModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                            style={{ borderColor: "var(--app-border-subtle)" }}
                            title="Edit Goal"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id, goal.title)}
                            className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer text-rose-400"
                            style={{ borderColor: "var(--app-border-subtle)" }}
                            title="Delete Goal"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Amount Progress */}
                      <div
                        className="mt-4 p-3.5 rounded-xl border space-y-2.5"
                        style={{
                          backgroundColor: "var(--app-bg)",
                          borderColor: "var(--app-border-subtle)",
                        }}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-lg font-bold font-mono tracking-tight">{formatINR(saved)}</span>
                          <span className="text-xs font-mono opacity-60">of {formatINR(target)}</span>
                        </div>

                        {/* Progress Bar */}
                        <div
                          className="w-full h-2.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: "var(--app-track-bg)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? "var(--app-accent)" : catMeta.color,
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold" style={{ color: pct >= 100 ? "var(--app-accent)" : catMeta.color }}>
                            {pct}% achieved
                          </span>
                          <span className="opacity-60 font-mono">
                            {remaining === 0 ? "Goal Reached! 🎉" : `${formatINR(remaining)} to go`}
                          </span>
                        </div>
                      </div>

                      {/* Contributing Members */}
                      {goal.assigned_members && goal.assigned_members.length > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-mono opacity-60">Contributors:</span>
                          {goal.assigned_members.map((m, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                              style={{
                                borderColor: "var(--app-border-subtle)",
                                backgroundColor: "var(--app-card)",
                              }}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}

                      {goal.notes && (
                        <p className="italic text-[10px] opacity-60 line-clamp-2 mt-2">"{goal.notes}"</p>
                      )}
                    </div>

                    {/* Contribute Button */}
                    <div className="pt-4 mt-4 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                      <button
                        onClick={() => {
                          setContributeGoal(goal);
                          setContributeModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-100 cursor-pointer"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-bg)",
                          color: catMeta.color,
                        }}
                      >
                        <Plus size={13} />
                        Deposit / Contribute Funds
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: HOUSEHOLD DUTIES & BILLS
          ========================================================================= */}
      {activeSubTab === "planning" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPlanningFilter("all")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  planningFilter === "all" ? "font-bold shadow-sm" : "opacity-60"
                }`}
                style={{
                  backgroundColor: planningFilter === "all" ? "var(--app-card)" : "transparent",
                  borderColor: planningFilter === "all" ? "var(--app-border)" : "transparent",
                }}
              >
                All ({responsibilities.length})
              </button>
              <button
                onClick={() => setPlanningFilter("pending")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  planningFilter === "pending" ? "font-bold text-rose-400" : "opacity-60"
                }`}
                style={{
                  backgroundColor: planningFilter === "pending" ? "var(--app-card)" : "transparent",
                  borderColor: planningFilter === "pending" ? "var(--app-border)" : "transparent",
                }}
              >
                Pending ({responsibilities.filter((r) => !r.is_completed).length})
              </button>
              <button
                onClick={() => setPlanningFilter("completed")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  planningFilter === "completed" ? "font-bold text-emerald-400" : "opacity-60"
                }`}
                style={{
                  backgroundColor: planningFilter === "completed" ? "var(--app-card)" : "transparent",
                  borderColor: planningFilter === "completed" ? "var(--app-border)" : "transparent",
                }}
              >
                Completed ({responsibilities.filter((r) => r.is_completed).length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 opacity-40" />
              <input
                type="text"
                placeholder="Search duties or bills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg pl-8.5 pr-3 py-1.5 text-xs border focus:outline-none transition-colors"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                  color: "var(--app-fg)",
                }}
              />
            </div>
          </div>

          {/* Duties Table / List */}
          {filteredResponsibilities.length === 0 ? (
            <div
              className="rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-3"
              style={{ backgroundColor: "var(--app-card)", borderColor: "var(--app-border)" }}
            >
              <Home size={28} className="opacity-40" />
              <p className="text-xs opacity-60">No household responsibilities match your filter.</p>
              <button
                onClick={() => {
                  setEditingResp(null);
                  setRespModalOpen(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-opacity hover:opacity-100"
                style={{ borderColor: "var(--app-border)" }}
              >
                Add Household Duty
              </button>
            </div>
          ) : (
            <div
              className="rounded-2xl border divide-y overflow-hidden shadow-sm"
              style={{
                backgroundColor: "var(--app-card)",
                borderColor: "var(--app-border)",
                borderBottomColor: "var(--app-border)",
              }}
            >
              {filteredResponsibilities.map((resp) => (
                <div
                  key={resp.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors hover:bg-[var(--app-card-hover)] ${
                    resp.is_completed ? "opacity-60" : ""
                  }`}
                  style={{ borderColor: "var(--app-border-subtle)" }}
                >
                  {/* Left: Checkbox & Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      onClick={() => handleToggleResp(resp)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                        resp.is_completed ? "bg-emerald-500 border-emerald-500 text-black font-bold" : "border-gray-500/40"
                      }`}
                      title={resp.is_completed ? "Mark pending" : "Mark as paid/done"}
                    >
                      {resp.is_completed && <Check size={14} />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-semibold truncate ${
                            resp.is_completed ? "line-through opacity-80" : ""
                          }`}
                        >
                          {resp.title}
                        </span>
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full border opacity-75"
                          style={{
                            borderColor: "var(--app-border-subtle)",
                            backgroundColor: "var(--app-bg)",
                          }}
                        >
                          {resp.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] opacity-60 mt-0.5 flex-wrap">
                        {resp.assigned_to && <span>Assigned to: {resp.assigned_to}</span>}
                        {resp.due_date && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {resp.due_date}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="capitalize">{resp.frequency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono tracking-tight">{formatINR(resp.amount)}</div>
                      <span
                        className={`text-[10px] font-mono ${
                          resp.is_completed ? "text-emerald-400 font-semibold" : "text-rose-400"
                        }`}
                      >
                        {resp.is_completed ? "Paid ✓" : "Pending"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingResp(resp);
                          setRespModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ borderColor: "var(--app-border-subtle)" }}
                        title="Edit duty"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteResp(resp.id, resp.title)}
                        className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer text-rose-400"
                        style={{ borderColor: "var(--app-border-subtle)" }}
                        title="Delete duty"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: EMERGENCY VAULT & SAFETY NET
          ========================================================================= */}
      {activeSubTab === "safety" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Financial Runway Insight Box */}
          <div
            className="rounded-2xl border p-5 sm:p-6 relative overflow-hidden"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} style={{ color: "var(--app-accent)" }} />
                  <h3 className="text-sm font-bold tracking-tight">Family Emergency Financial Runway</h3>
                </div>
                <p className="text-xs opacity-70 max-w-xl leading-relaxed">
                  Calculated against your total liquid cash reserves ({formatINR(totalLiquidCash)}) and monthly recurring household burn rate ({formatINR(monthlyBurnRate)}/mo).
                </p>
              </div>

              <div className="text-left md:text-right">
                <div className="text-2xl font-bold font-mono tracking-tight" style={{ color: emergencyRunwayMonths >= 6 ? "var(--app-accent)" : "#F59E0B" }}>
                  {emergencyRunwayMonths} Months
                </div>
                <span className="text-[11px] opacity-60">
                  {emergencyRunwayMonths >= 6 ? "Institutional Grade Buffer" : "Build toward 6 months"}
                </span>
              </div>
            </div>
          </div>

          {/* Emergency Vault Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider opacity-60">
                Critical Family SOS & Policy Records ({vaultItems.length})
              </h3>
            </div>

            {vaultItems.length === 0 ? (
              <div
                className="rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-4"
                style={{ backgroundColor: "var(--app-card)", borderColor: "var(--app-border)" }}
              >
                <ShieldAlert size={28} className="opacity-40" />
                <div className="max-w-md">
                  <h3 className="text-base font-bold">Emergency Vault is Empty</h3>
                  <p className="text-xs opacity-70 mt-1">
                    Store cashless health insurance policy numbers, family pediatrician contact, society security desk, and term life policy details for instant access in emergencies.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingVault(null);
                    setVaultModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm"
                  style={{ backgroundColor: "var(--app-fg)", color: "var(--app-bg)" }}
                >
                  <Plus size={14} />
                  Add First Record
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vaultItems.map((item) => {
                  const typeMeta = VAULT_TYPES.find((t) => t.value === item.type) || VAULT_TYPES[0];
                  const Icon = typeMeta.icon;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border p-5 flex flex-col justify-between transition-all hover:border-[var(--app-accent)]"
                      style={{
                        backgroundColor: "var(--app-card)",
                        borderColor: "var(--app-border)",
                      }}
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0"
                              style={{
                                borderColor: "var(--app-border-subtle)",
                                backgroundColor: "var(--app-accent-subtle)",
                                color: "var(--app-accent)",
                              }}
                            >
                              <Icon size={16} />
                            </span>
                            <div>
                              <h4 className="text-sm font-bold tracking-tight line-clamp-1">{item.title}</h4>
                              <p className="text-[11px] opacity-60 mt-0.5">{typeMeta.label}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingVault(item);
                                setVaultModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                              style={{ borderColor: "var(--app-border-subtle)" }}
                              title="Edit item"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteVault(item.id, item.title)}
                              className="p-1.5 rounded-lg border opacity-60 hover:opacity-100 transition-opacity cursor-pointer text-rose-400"
                              style={{ borderColor: "var(--app-border-subtle)" }}
                              title="Delete record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Details */}
                        <div
                          className="mt-3.5 p-3 rounded-xl border space-y-2 text-xs"
                          style={{
                            backgroundColor: "var(--app-bg)",
                            borderColor: "var(--app-border-subtle)",
                          }}
                        >
                          <div>
                            <span className="text-[10px] uppercase font-mono opacity-60 block">Provider / Name</span>
                            <span className="font-semibold">{item.provider_or_name}</span>
                          </div>

                          {item.reference_number && (
                            <div>
                              <span className="text-[10px] uppercase font-mono opacity-60 block">Policy / Ref ID</span>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <span className="font-mono text-xs select-all">{item.reference_number}</span>
                                <button
                                  onClick={() => handleCopy(item.reference_number || "", `ref-${item.id}`)}
                                  className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                                  title="Copy reference number"
                                >
                                  {copiedId === `ref-${item.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                            </div>
                          )}

                          {item.contact_number && (
                            <div>
                              <span className="text-[10px] uppercase font-mono opacity-60 block">Emergency Helpline</span>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <a
                                  href={`tel:${item.contact_number.replace(/\s+/g, "")}`}
                                  className="font-mono text-xs text-sky-400 hover:underline"
                                >
                                  {item.contact_number}
                                </a>
                                <button
                                  onClick={() => handleCopy(item.contact_number || "", `phone-${item.id}`)}
                                  className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                                  title="Copy phone"
                                >
                                  {copiedId === `phone-${item.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {item.notes && (
                          <p className="italic text-[10px] opacity-60 line-clamp-3 mt-2.5">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
                  <p className="text-xs opacity-60">Set role, allowance, and household profile.</p>
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
                  placeholder="e.g. Priya Sharma"
                  defaultValue={editingMember?.name || ""}
                  className="w-full rounded-lg px-3.5 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Relationship</label>
                  <select
                    name="relationship"
                    defaultValue={editingMember?.relationship || "Spouse"}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Household Role</label>
                  <select
                    name="role"
                    defaultValue={editingMember?.role || "member"}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Monthly Allowance (₹ INR)
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
                  Avatar Theme Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {AVATAR_COLORS.map((col) => (
                    <label key={col} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="avatar_color"
                        value={col}
                        defaultChecked={(editingMember?.avatar_color || "#4bb473") === col}
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
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Phone / WhatsApp</label>
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
                    placeholder="priya@example.com"
                    defaultValue={editingMember?.email || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Notes / Responsibilities</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. In charge of groceries and school fee payments"
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
          POPUP MODAL 2: LOG SPEND / RESET ALLOWANCE
          ========================================================================= */}
      {spendModalOpen && spendMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl border p-6 space-y-5 shadow-2xl relative"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div>
                <h3 className="text-sm font-bold tracking-tight">
                  {spendActionType === "reset" ? "Reset Spending Counter" : `Log Spend: ${spendMember.name}`}
                </h3>
                <p className="text-xs opacity-60">
                  Allowance: {formatINR(spendMember.monthly_allowance)} (Spent: {formatINR(spendMember.current_spending)})
                </p>
              </div>
              <button
                onClick={() => setSpendModalOpen(false)}
                className="p-1 rounded opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAdjustSpending} className="space-y-4">
              {spendActionType === "add" ? (
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Amount Spent (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-mono opacity-60">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="0"
                      value={spendAmountInput}
                      onChange={(e) => setSpendAmountInput(e.target.value)}
                      required
                      autoFocus
                      className="w-full rounded-lg pl-7 pr-3 py-2 text-sm font-mono border focus:outline-none transition-colors"
                      style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs opacity-70 leading-relaxed">
                  Resetting will set <strong>{spendMember.name}&apos;s</strong> current monthly spending back to ₹0 for the new billing cycle.
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setSpendModalOpen(false)}
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
                  {spendActionType === "reset" ? "Reset to ₹0" : "Record Spend"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP MODAL 3: CREATE / EDIT SHARED GOAL
          ========================================================================= */}
      {goalModalOpen && (
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
                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-sky-400"
                  style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-bg)" }}
                >
                  <HeartHandshake size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {editingGoal ? "Edit Shared Goal" : "Create Shared Family Goal"}
                  </h3>
                  <p className="text-xs opacity-60">Set joint savings targets, target date, and contributors.</p>
                </div>
              </div>
              <button
                onClick={() => setGoalModalOpen(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Goal Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Annual Vacation to Goa"
                  defaultValue={editingGoal?.title || ""}
                  className="w-full rounded-lg px-3.5 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Target Amount (₹) *</label>
                  <input
                    type="number"
                    name="target_amount"
                    step="1000"
                    min="1"
                    required
                    placeholder="150000"
                    defaultValue={editingGoal?.target_amount || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Initial Saved (₹)</label>
                  <input
                    type="number"
                    name="current_amount"
                    step="500"
                    min="0"
                    placeholder="0"
                    defaultValue={editingGoal?.current_amount || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Category</label>
                  <select
                    name="category"
                    defaultValue={editingGoal?.category || "Vacation & Travel"}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  >
                    {GOAL_CATEGORIES.map((cat) => (
                      <option key={cat.label} value={cat.label}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Target Date</label>
                  <input
                    type="date"
                    name="target_date"
                    defaultValue={editingGoal?.target_date || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              {members.length > 0 && (
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Contributing Members
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border" style={{ borderColor: "var(--app-border-subtle)", backgroundColor: "var(--app-bg)" }}>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        name="assigned_members"
                        value="Self"
                        defaultChecked={editingGoal?.assigned_members?.includes("Self") ?? true}
                        className="rounded"
                      />
                      <span>Self (Primary)</span>
                    </label>
                    {members.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer truncate">
                        <input
                          type="checkbox"
                          name="assigned_members"
                          value={m.name}
                          defaultChecked={editingGoal?.assigned_members?.includes(m.name)}
                          className="rounded"
                        />
                        <span className="truncate">{m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Notes & Milestones</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Flight bookings scheduled for Diwali holiday season"
                  defaultValue={editingGoal?.notes || ""}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors resize-none"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border opacity-70 hover:opacity-100 cursor-pointer"
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
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP MODAL 4: DEPOSIT / CONTRIBUTE TO GOAL
          ========================================================================= */}
      {contributeModalOpen && contributeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl border p-6 space-y-5 shadow-2xl relative"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
              color: "var(--app-fg)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Deposit to Goal</h3>
                <p className="text-xs opacity-60 line-clamp-1">{contributeGoal.title}</p>
              </div>
              <button
                onClick={() => setContributeModalOpen(false)}
                className="p-1 rounded opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleContributeGoal} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Deposit Amount (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono opacity-60">₹</span>
                  <input
                    type="number"
                    step="100"
                    min="1"
                    placeholder="5000"
                    value={contributeAmountInput}
                    onChange={(e) => setContributeAmountInput(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-lg pl-7 pr-3 py-2 text-sm font-mono border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] opacity-60 mt-1.5">
                  <span>Current: {formatINR(contributeGoal.current_amount)}</span>
                  <span>Target: {formatINR(contributeGoal.target_amount)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setContributeModalOpen(false)}
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
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP MODAL 5: ADD / EDIT HOUSEHOLD DUTY
          ========================================================================= */}
      {respModalOpen && (
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
                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-amber-400"
                  style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-bg)" }}
                >
                  <Home size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {editingResp ? "Edit Household Duty" : "Add Recurring Duty / Bill"}
                  </h3>
                  <p className="text-xs opacity-60">Assign recurring responsibilities to family members.</p>
                </div>
              </div>
              <button
                onClick={() => setRespModalOpen(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveResp} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Duty / Bill Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Society Maintenance / Electricity Bill"
                  defaultValue={editingResp?.title || ""}
                  className="w-full rounded-lg px-3.5 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    name="amount"
                    step="50"
                    min="0"
                    placeholder="0"
                    defaultValue={editingResp?.amount || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Assigned Member</label>
                  <select
                    name="assigned_to"
                    defaultValue={editingResp?.assigned_to || "Self"}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  >
                    <option value="Self">Self (Primary)</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Category</label>
                  <select
                    name="category"
                    defaultValue={editingResp?.category || "Bills & Utilities"}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  >
                    {RESPONSIBILITY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Frequency</label>
                  <select
                    name="frequency"
                    defaultValue={editingResp?.frequency || "monthly"}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one-time">One-Time</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Due Schedule / Day
                </label>
                <input
                  type="text"
                  name="due_date"
                  placeholder="e.g. 5th of every month or 2026-11-20"
                  defaultValue={editingResp?.due_date || ""}
                  className="w-full rounded-lg px-3.5 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Payment Instructions / Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. Pay via UPI or BESCOM portal using Account # 89421"
                  defaultValue={editingResp?.notes || ""}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors resize-none"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setRespModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border opacity-70 hover:opacity-100 cursor-pointer"
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
                  Save Duty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP MODAL 6: ADD / EDIT EMERGENCY VAULT
          ========================================================================= */}
      {vaultModalOpen && (
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
                  <ShieldCheck size={16} style={{ color: "var(--app-accent)" }} />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {editingVault ? "Edit Vault Entry" : "Add Emergency Vault Entry"}
                  </h3>
                  <p className="text-xs opacity-60">Store critical policies, physician numbers, and SOS helplines.</p>
                </div>
              </div>
              <button
                onClick={() => setVaultModalOpen(false)}
                className="p-1.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveVault} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Record Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Star Health Family Floater"
                  defaultValue={editingVault?.title || ""}
                  className="w-full rounded-lg px-3.5 py-2 text-xs border focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Category Type</label>
                  <select
                    name="type"
                    defaultValue={editingVault?.type || "insurance"}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  >
                    {VAULT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">Provider / Person Name *</label>
                  <input
                    type="text"
                    name="provider_or_name"
                    required
                    placeholder="e.g. Star Health & Allied Insurance"
                    defaultValue={editingVault?.provider_or_name || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Policy # / Ref ID
                  </label>
                  <input
                    type="text"
                    name="reference_number"
                    placeholder="e.g. P/211112/01/2026/004928"
                    defaultValue={editingVault?.reference_number || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                    Emergency Phone / Helpline
                  </label>
                  <input
                    type="tel"
                    name="contact_number"
                    placeholder="e.g. 1800-425-2255 or +91 98450 11223"
                    defaultValue={editingVault?.contact_number || ""}
                    className="w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono tracking-wider opacity-70 mb-1.5">
                  Emergency Notes / Claim Instructions
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="e.g. ₹25 Lakhs cover. Cashless TPA card located in master bedroom drawer"
                  defaultValue={editingVault?.notes || ""}
                  className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none transition-colors resize-none"
                  style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)", color: "var(--app-fg)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setVaultModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border opacity-70 hover:opacity-100 cursor-pointer"
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
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
