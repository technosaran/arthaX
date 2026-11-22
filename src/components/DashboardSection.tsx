"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  PieChart as PieChartIcon,
  Plus,
  ArrowLeftRight,
  Target,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Landmark,
  ArrowRight,
  PiggyBank,
  Clock,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getUserCacheKey, CACHE_KEYS } from "@/utils/cacheKeys";
import { getFromLocalCache, saveToCache } from "@/utils/cacheClient";
import InteractiveDonutChart, { DonutSegment } from "@/components/charts/InteractiveDonutChart";
import EntityLogo from "@/components/EntityLogo";
import BankLogo from "@/components/BankLogo";
import { getTimeGreeting } from "@/utils/greeting";
import { isFamilyTransfer } from "@/utils/expenseFilter";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, StatCardSkeleton } from "@/components/ui/Skeleton";

interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
  classification?: "asset" | "liability";
}

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  account_id?: string | null;
  expense_date: string;
  notes?: string | null;
  tags?: string[];
  created_at?: string;
}

interface IncomeItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  account_id?: string | null;
  received_date: string;
  created_at?: string;
}

interface TransferItem {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  notes?: string | null;
  created_at?: string;
}

interface ActivityItem {
  id: string;
  type: "income" | "expense" | "transfer";
  title: string;
  amount: number;
  category?: string;
  date: string;
  accountName?: string;
  notes?: string | null;
}

function formatDisplayName(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 2 && !/[aeiou]/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

interface DashboardSectionProps {
  onNavigate?: (tab: string) => void;
}

export default function DashboardSection({ onNavigate }: DashboardSectionProps = {}) {
  const { user, profile } = useAuth();
  const [greeting, setGreeting] = useState(() => getTimeGreeting().text);
  const [greetingEmoji, setGreetingEmoji] = useState(() => getTimeGreeting().emoji);

  const redisPortfolioKey = getUserCacheKey(user?.id, CACHE_KEYS.PORTFOLIO);

  // Synchronous Tier 1 & 2 Local Cache load (0ms latency for warm sessions < 120s)
  const initialCache = useMemo(() => {
    return getFromLocalCache<{
      name: string;
      netWorth: number;
      accounts: AccountItem[];
      expenses?: ExpenseItem[];
      incomes?: IncomeItem[];
      transfers?: TransferItem[];
    }>(redisPortfolioKey);
  }, [redisPortfolioKey]);

  const [name, setName] = useState<string>(profile?.name || initialCache?.name || "");
  const [netWorth, setNetWorth] = useState<number>(initialCache?.netWorth || 0);
  const [currencyView, setCurrencyView] = useState<"INR" | "USD">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arthax_networth_currency");
      if (saved === "USD" || saved === "INR") return saved;
    }
    return "INR";
  });
  const [totalCryptoUsd, setTotalCryptoUsd] = useState<number>(0);
  const [cryptoHoldings, setCryptoHoldings] = useState<{ asset: string; total_value_usd: number }[]>([]);
  const [investmentsBreakdown, setInvestmentsBreakdown] = useState<{
    stocks: number;
    mutualFunds: number;
    bonds: number;
    bullion: number;
    cryptoInr: number;
    total: number;
  }>({ stocks: 0, mutualFunds: 0, bonds: 0, bullion: 0, cryptoInr: 0, total: 0 });
  const [accounts, setAccounts] = useState<AccountItem[]>(initialCache?.accounts || []);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialCache?.expenses || []);
  const [incomes, setIncomes] = useState<IncomeItem[]>(initialCache?.incomes || []);
  const [transfers, setTransfers] = useState<TransferItem[]>(initialCache?.transfers || []);
  const [loading, setLoading] = useState<boolean>(!initialCache);
  const inFlightRef = useRef<boolean>(false);
  const pendingRefetchRef = useRef<boolean>(false);

  const displayName = profile?.name || name;

  const formattedName = useMemo(() => {
    return formatDisplayName(displayName);
  }, [displayName]);

  // Synchronize greeting name whenever profile arrives or updates
  useEffect(() => {
    if (profile?.name) {
      setName((prev) => (prev === profile.name ? prev : profile.name));
    }
  }, [profile?.name]);

  // Currency Formatter (INR)
  const formatCurrency = useCallback((val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  // Currency Formatter (USD)
  const formatUSD = useCallback((val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    if (inFlightRef.current) {
      pendingRefetchRef.current = true;
      return;
    }
    inFlightRef.current = true;

    try {
      const supabase = createClient();

      // Parallel concurrent burst: accounts, expenses, income, transfers, crypto, stocks, mutual funds, bonds, bullion
      const [
        accountsRes,
        expensesRes,
        incomeRes,
        transfersRes,
        cryptoRes,
        stocksRes,
        mfRes,
        bondsRes,
        bullionRes,
      ] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, type, balance, last_four, classification")
          .eq("user_id", user.id),
        supabase
          .from("expenses")
          .select("id, title, amount, category, account_id, expense_date, notes, tags, created_at, transaction_type, transfer_id")
          .eq("user_id", user.id)
          .order("expense_date", { ascending: false })
          .limit(100),
        supabase
          .from("income")
          .select("id, title, amount, category, account_id, received_date, created_at, transaction_type, transfer_id")
          .eq("user_id", user.id)
          .order("received_date", { ascending: false })
          .limit(100),
        supabase
          .from("transfers")
          .select("id, from_account_id, to_account_id, amount, transfer_date, notes, created_at")
          .eq("user_id", user.id)
          .order("transfer_date", { ascending: false })
          .limit(25),
        supabase
          .from("crypto_holdings")
          .select("asset, total_value_usd")
          .eq("user_id", user.id),
        supabase
          .from("stock_holdings")
          .select("quantity, avg_buy_price")
          .eq("user_id", user.id),
        supabase
          .from("mutual_fund_holdings")
          .select("units, current_nav, avg_nav, invested_amount")
          .eq("user_id", user.id),
        supabase
          .from("bond_holdings")
          .select("quantity, avg_buy_price, invested_amount, current_price, face_value")
          .eq("user_id", user.id),
        supabase
          .from("bullion_holdings")
          .select("metal, weight_grams, total_buy_price")
          .eq("user_id", user.id),
      ]);

      // 1. Resolve user display name
      const rawProfileName = profile?.name?.trim();
      const validProfileName =
        rawProfileName && rawProfileName.toLowerCase() !== "user" ? rawProfileName : null;
      const resolvedName =
        validProfileName ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";
      setName((prev) => (prev === resolvedName ? prev : resolvedName));

      // Resolve Crypto Holdings USD Valuation
      let cryptoUsdTotal = 0;
      let cryptoList: { asset: string; total_value_usd: number }[] = [];
      if (cryptoRes?.data && cryptoRes.data.length > 0) {
        cryptoList = cryptoRes.data.map((c: any) => ({
          asset: c.asset,
          total_value_usd: Number(c.total_value_usd) || 0,
        }));
        cryptoUsdTotal = cryptoList.reduce((acc, curr) => acc + curr.total_value_usd, 0);
      }
      setCryptoHoldings(cryptoList);
      setTotalCryptoUsd(cryptoUsdTotal);

      // Investment Valuations
      const stocksTotal = (stocksRes?.data || []).reduce(
        (sum: number, s: any) => sum + (Number(s.quantity) || 0) * (Number(s.avg_buy_price) || 0),
        0
      );
      const mfTotal = (mfRes?.data || []).reduce((sum: number, m: any) => {
        const inv = Number(m.invested_amount) || 0;
        if (inv > 0) return sum + inv;
        const nav = Number(m.current_nav) || Number(m.avg_nav) || 0;
        return sum + (Number(m.units) || 0) * nav;
      }, 0);
      const bondsTotal = (bondsRes?.data || []).reduce((sum: number, b: any) => {
        const inv = Number(b.invested_amount) || 0;
        if (inv > 0) return sum + inv;
        const p = Number(b.current_price) || Number(b.avg_buy_price) || Number(b.face_value) || 1000;
        return sum + (Number(b.quantity) || 0) * p;
      }, 0);
      const bullionTotal = (bullionRes?.data || []).reduce(
        (sum: number, bul: any) => sum + (Number(bul.total_buy_price) || 0),
        0
      );
      const cryptoInr = cryptoUsdTotal * 84.5;
      const totalInvestments = stocksTotal + mfTotal + bondsTotal + bullionTotal + cryptoInr;

      setInvestmentsBreakdown({
        stocks: stocksTotal,
        mutualFunds: mfTotal,
        bonds: bondsTotal,
        bullion: bullionTotal,
        cryptoInr,
        total: totalInvestments,
      });

      // 2. Resolve accounts and accurate net worth (Total Assets - Total Liabilities)
      let mapped: AccountItem[] = [];
      let total = 0;
      if (accountsRes.data && accountsRes.data.length > 0) {
        mapped = accountsRes.data.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          balance: Number(item.balance) || 0,
          last_four: item.last_four,
          classification:
            item.classification ||
            (item.type?.toLowerCase().includes("credit") ||
            item.name?.toLowerCase().includes("credit") ||
            item.type?.toLowerCase().includes("loan")
              ? "liability"
              : "asset"),
        }));

        const totalAccountAssets = mapped
          .filter((a) => a.classification !== "liability")
          .reduce((acc, curr) => acc + curr.balance, 0);

        const totalLiabilities = mapped
          .filter((a) => a.classification === "liability")
          .reduce((acc, curr) => acc + Math.abs(curr.balance), 0);

        total = totalAccountAssets + totalInvestments - totalLiabilities;
      } else {
        total = totalInvestments;
      }

      setAccounts(mapped);
      setNetWorth(total);

      if (expensesRes.data) {
        setExpenses((expensesRes.data as ExpenseItem[]).filter((e) => !isFamilyTransfer(e)));
      }
      if (incomeRes.data) setIncomes(incomeRes.data as IncomeItem[]);
      if (transfersRes.data) setTransfers(transfersRes.data as TransferItem[]);

      // 3. Update multi-tier cache (synchronized snapshot with 120s warm TTL)
      saveToCache(
        redisPortfolioKey,
        {
          name: resolvedName,
          netWorth: total,
          accounts: mapped,
          expenses: (expensesRes.data as ExpenseItem[])?.filter((e) => !isFamilyTransfer(e)) || [],
          incomes: (incomeRes.data as IncomeItem[]) || [],
          transfers: (transfersRes.data as TransferItem[]) || [],
        },
        120
      );
    } catch (err) {
      console.warn("Error fetching dashboard telemetry:", err);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        fetchDashboardData();
      }
    }
  }, [user, redisPortfolioKey, profile?.name]);

  useEffect(() => {
    const updateTimeGreeting = () => {
      const info = getTimeGreeting();
      setGreeting(info.text);
      setGreetingEmoji(info.emoji);
    };

    updateTimeGreeting();
    const greetingInterval = setInterval(updateTimeGreeting, 60000);

    if (!user) {
      return () => clearInterval(greetingInterval);
    }

    fetchDashboardData();

    // Cross-device Realtime synchronization for Dashboard
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "income", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfers", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_holdings", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mutual_fund_holdings", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bullion_holdings", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bond_holdings", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crypto_holdings", filter: `user_id=eq.${user.id}` },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new?.name) {
            setName(payload.new.name);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(greetingInterval);
      supabase.removeChannel(channel);
    };
  }, [user, fetchDashboardData]);

  // Synchronize dashboard whenever financial data is updated in any tab
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchDashboardData();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("arthax:financial_data_updated", handleDataUpdated);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("arthax:financial_data_updated", handleDataUpdated);
      }
    };
  }, [fetchDashboardData]);

  // Current Month Calculations
  const currentMonthPrefix = useMemo(() => {
    return new Date().toISOString().slice(0, 7); // e.g. "2026-11"
  }, []);

  const currentMonthIncomes = useMemo(() => {
    return incomes.filter((i) => i.received_date?.startsWith(currentMonthPrefix));
  }, [incomes, currentMonthPrefix]);

  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((e) => e.expense_date?.startsWith(currentMonthPrefix));
  }, [expenses, currentMonthPrefix]);

  const totalMonthIncome = useMemo(() => {
    return currentMonthIncomes.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [currentMonthIncomes]);

  const totalMonthExpense = useMemo(() => {
    return currentMonthExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [currentMonthExpenses]);

  const netSavings = useMemo(() => {
    return totalMonthIncome - totalMonthExpense;
  }, [totalMonthIncome, totalMonthExpense]);

  const savingsRate = useMemo(() => {
    if (totalMonthIncome <= 0) return 0;
    const rate = (netSavings / totalMonthIncome) * 100;
    return Math.max(0, Math.min(100, Math.round(rate)));
  }, [netSavings, totalMonthIncome]);

  // Days elapsed in current month for daily burn rate calculation
  const dayOfMonth = useMemo(() => {
    return Math.max(1, new Date().getDate());
  }, []);

  const dailyBurnRate = useMemo(() => {
    return totalMonthExpense / dayOfMonth;
  }, [totalMonthExpense, dayOfMonth]);

  // Asset Totals
  const totalAssets = useMemo(() => {
    const liquidAssets = accounts
      .filter((a) => a.classification !== "liability")
      .reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
    return liquidAssets + (investmentsBreakdown?.total || 0);
  }, [accounts, investmentsBreakdown]);

  const totalLiabilities = useMemo(() => {
    return accounts
      .filter((a) => a.classification === "liability")
      .reduce((acc, curr) => acc + Math.abs(Number(curr.balance) || 0), 0);
  }, [accounts]);

  // Derived Net Worth (Guaranteed mathematically consistent with totalAssets - totalLiabilities)
  const calculatedNetWorth = useMemo(() => {
    if (accounts.length > 0 || (investmentsBreakdown?.total || 0) > 0) {
      return totalAssets - totalLiabilities;
    }
    return netWorth;
  }, [totalAssets, totalLiabilities, accounts.length, investmentsBreakdown?.total, netWorth]);

  // Currency-Specific Independent Values (No conversion applied)
  const displayedNetWorth = useMemo(() => {
    return currencyView === "USD" ? totalCryptoUsd : calculatedNetWorth;
  }, [currencyView, totalCryptoUsd, calculatedNetWorth]);

  const displayedAssets = useMemo(() => {
    return currencyView === "USD" ? totalCryptoUsd : totalAssets;
  }, [currencyView, totalCryptoUsd, totalAssets]);

  const displayedLiabilities = useMemo(() => {
    return currencyView === "USD" ? 0 : totalLiabilities;
  }, [currencyView, totalLiabilities]);

  // Formatted Net Worth (omitting trailing .00 for whole numbers to ensure crisp elegance & avoid truncation)
  const formattedNetWorth = useMemo(() => {
    const formatted =
      currencyView === "USD" ? formatUSD(displayedNetWorth) : formatCurrency(displayedNetWorth);
    return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
  }, [currencyView, formatUSD, formatCurrency, displayedNetWorth]);

  // Dynamic Net Worth font sizing based on string length to guarantee zero overflow
  const netWorthFontSize = useMemo(() => {
    const len = formattedNetWorth.length;
    if (len > 16) {
      // 17+ chars (e.g. ₹9,93,56,00,08,832)
      return "text-2xl sm:text-3xl lg:text-3xl xl:text-4xl 2xl:text-5xl";
    }
    if (len > 12) {
      // 13-16 chars (e.g. ₹10,00,00,000)
      return "text-3xl sm:text-4xl lg:text-4xl xl:text-5xl 2xl:text-6xl";
    }
    return "text-3xl sm:text-5xl xl:text-6xl";
  }, [formattedNetWorth]);

  const liquidPct = useMemo(() => {
    if (totalAssets <= 0) return 100;
    const liquid = accounts
      .filter(
        (a) =>
          a.classification !== "liability" &&
          (a.type?.toLowerCase().includes("cash") ||
            a.type?.toLowerCase().includes("saving") ||
            a.type?.toLowerCase().includes("bank") ||
            a.name?.toLowerCase().includes("cash"))
      )
      .reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
    return Math.min(100, Math.round((liquid / totalAssets) * 100));
  }, [accounts, totalAssets]);

  // Modern Fintech Color Palette for Chart
  const chartPalette = [
    "#10B981", // Emerald (Cash / Savings)
    "#3B82F6", // Royal Blue (HDFC / Banking)
    "#8B5CF6", // Purple / Violet (Fixed Deposits)
    "#06B6D4", // Neon Cyan (Investments / Demat)
    "#F59E0B", // Bright Amber / Gold
    "#EC4899", // Vivid Pink
    "#F43F5E", // Vibrant Rose / Red
    "#14B8A6", // Teal
  ];

  // Group portfolio assets by type for Donut Chart
  const typeMap = useMemo(() => {
    const map = accounts
      .filter((a) => a.classification !== "liability")
      .reduce((acc, curr) => {
        const key = curr.type || curr.name || "Other";
        acc[key] = (acc[key] || 0) + curr.balance;
        return acc;
      }, {} as Record<string, number>);

    if (investmentsBreakdown?.stocks && investmentsBreakdown.stocks > 0) {
      map["Stocks"] = (map["Stocks"] || 0) + investmentsBreakdown.stocks;
    }
    if (investmentsBreakdown?.mutualFunds && investmentsBreakdown.mutualFunds > 0) {
      map["Mutual Funds"] = (map["Mutual Funds"] || 0) + investmentsBreakdown.mutualFunds;
    }
    if (investmentsBreakdown?.bonds && investmentsBreakdown.bonds > 0) {
      map["Bonds"] = (map["Bonds"] || 0) + investmentsBreakdown.bonds;
    }
    if (investmentsBreakdown?.bullion && investmentsBreakdown.bullion > 0) {
      map["Gold & Silver"] = (map["Gold & Silver"] || 0) + investmentsBreakdown.bullion;
    }
    if (investmentsBreakdown?.cryptoInr && investmentsBreakdown.cryptoInr > 0) {
      map["Crypto"] = (map["Crypto"] || 0) + investmentsBreakdown.cryptoInr;
    }

    return map;
  }, [accounts, investmentsBreakdown]);

  const donutSegments: DonutSegment[] = useMemo(() => {
    return Object.entries(typeMap)
      .filter(([_, bal]) => bal > 0)
      .map(([catType, catBalance], index) => ({
        label: catType,
        value: catBalance,
        color: chartPalette[index % chartPalette.length],
      }));
  }, [typeMap, chartPalette]);

  const cryptoDonutSegments: DonutSegment[] = useMemo(() => {
    const sorted = [...cryptoHoldings].sort((a, b) => b.total_value_usd - a.total_value_usd);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);

    const segments: DonutSegment[] = top5.map((c, i) => ({
      label: c.asset,
      value: c.total_value_usd,
      color: chartPalette[i % chartPalette.length],
      subtitle: formatUSD(c.total_value_usd),
    }));

    if (others.length > 0) {
      const othersTotal = others.reduce((acc, curr) => acc + curr.total_value_usd, 0);
      segments.push({
        label: "Others",
        value: othersTotal,
        color: "#6B7280",
        subtitle: formatUSD(othersTotal),
      });
    }

    return segments;
  }, [cryptoHoldings, chartPalette, formatUSD]);

  // Top Expense Categories this Month
  const topExpenseCategories = useMemo(() => {
    const catMap = currentMonthExpenses.reduce((acc, curr) => {
      const cat = curr.category || "Other";
      acc[cat] = (acc[cat] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amount], index) => ({
        category: cat,
        amount,
        percentage: totalMonthExpense > 0 ? Math.round((amount / totalMonthExpense) * 100) : 0,
        color: chartPalette[index % chartPalette.length],
      }));
  }, [currentMonthExpenses, totalMonthExpense, chartPalette]);

  // Combined Recent Activity (Latest 5 items)
  const recentActivities: ActivityItem[] = useMemo(() => {
    const accountLookup = new Map(accounts.map((a) => [a.id, a.name]));

    const expList: ActivityItem[] = expenses.slice(0, 10).map((e) => ({
      id: e.id,
      type: "expense",
      title: e.title,
      amount: e.amount,
      category: e.category,
      date: e.expense_date,
      accountName: e.account_id ? accountLookup.get(e.account_id) : undefined,
    }));

    const incList: ActivityItem[] = incomes.slice(0, 10).map((i) => ({
      id: i.id,
      type: "income",
      title: i.title,
      amount: i.amount,
      category: i.category,
      date: i.received_date,
      accountName: i.account_id ? accountLookup.get(i.account_id) : undefined,
    }));

    const trfList: ActivityItem[] = transfers.slice(0, 5).map((t) => {
      const fromName = accountLookup.get(t.from_account_id) || "Source";
      const toName = accountLookup.get(t.to_account_id) || "Destination";
      return {
        id: t.id,
        type: "transfer",
        title: `Transfer: ${fromName} → ${toName}`,
        amount: t.amount,
        category: "Transfer",
        date: t.transfer_date,
        notes: t.notes,
      };
    });

    return [...expList, ...incList, ...trfList]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [expenses, incomes, transfers, accounts]);

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto transition-colors select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Header Bar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8 border-b border-[var(--app-border)]"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <h1
              suppressHydrationWarning
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--app-fg)] flex items-center gap-2 flex-wrap"
            >
              <span>
                {greeting}
                {formattedName && formattedName.toLowerCase() !== "user" ? `,` : ""}
              </span>
              {formattedName && formattedName.toLowerCase() !== "user" && (
                <span className="text-[var(--app-accent)]">
                  {formattedName.split(" ")[0]}
                </span>
              )}
              <span
                className="text-2xl sm:text-3xl select-none inline-block transition-transform hover:scale-110"
                role="img"
                aria-label={greeting}
              >
                {greetingEmoji}
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[var(--app-muted)] font-normal">
            Sovereign ledger overview, net worth telemetry, and real-time cash flow.
          </p>
        </div>
      </div>

      <div className="max-w-7xl space-y-6 sm:space-y-8">
        {/* HERO CARD: Total Net Worth Card + Integrated Portfolio Asset Allocation */}
        <div
          className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 border relative overflow-hidden transition-all shadow-md group hover:border-[var(--app-border-hover)]"
          style={{
            backgroundColor: "var(--app-card)",
            borderColor: "var(--app-border)",
            color: "var(--app-fg)",
          }}
        >
          {/* Luminous Accent Pill Indicator on Left Border */}
          <span className="absolute left-0 top-7 bottom-7 w-1.5 bg-[var(--app-accent)] rounded-r-full shadow-[0_0_12px_var(--app-accent)]" />

          {/* Ambient Glow Gradient */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-center relative z-10">
            {/* Left Column: Total Net Worth Summary */}
            <div className="xl:col-span-5 space-y-5 min-w-0">
              {/* Top Label & Segmented Currency View Toggle */}
              <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-medium text-[var(--app-muted)]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--app-fg)]">
                    Total Net Worth
                  </span>
                  {currencyView === "INR" ? (
                    totalLiabilities > 0 && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                        <span className="text-[var(--app-muted)]">Assets − Liabilities</span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                      <span className="text-[var(--app-muted)]">Crypto (Binance)</span>
                    </>
                  )}
                </div>

                {/* Independent Currency View Toggle: [ ₹ INR | $ USD ] (No conversion) */}
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--app-card-subtle)] border border-[var(--app-border)] text-xs font-mono select-none">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrencyView("INR");
                      if (typeof window !== "undefined") {
                        localStorage.setItem("arthax_networth_currency", "INR");
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      currencyView === "INR"
                        ? "bg-[var(--app-card-elevated)] text-emerald-400 border border-[var(--app-border)] shadow-xs"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    ₹ INR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrencyView("USD");
                      if (typeof window !== "undefined") {
                        localStorage.setItem("arthax_networth_currency", "USD");
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      currencyView === "USD"
                        ? "bg-[var(--app-card-elevated)] text-amber-400 border border-[var(--app-border)] shadow-xs"
                        : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                    }`}
                  >
                    $ USD
                  </button>
                </div>
              </div>

              {/* Massive Metric Amount with Dynamic Sizing & Overflow Protection */}
              <div className="space-y-1 min-w-0">
                <div
                  className={`${netWorthFontSize} font-extrabold tracking-tight font-mono text-[var(--app-fg)] tabular-nums truncate`}
                  title={currencyView === "USD" ? formatUSD(displayedNetWorth) : formatCurrency(displayedNetWorth)}
                >
                  {loading ? (
                    <Skeleton className="h-14 w-64 rounded-xl" />
                  ) : (
                    formattedNetWorth
                  )}
                </div>
              </div>

              {/* Asset & Liability Quick Badges */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {currencyView === "USD" ? (
                  <>
                    <div
                      className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors min-w-0"
                      style={{ backgroundColor: "var(--app-card-subtle)" }}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                        Crypto Assets (USD)
                      </div>
                      <div
                        className="text-sm sm:text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums truncate"
                        title={formatUSD(displayedAssets)}
                      >
                        {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatUSD(displayedAssets)}
                      </div>
                    </div>

                    <div
                      className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors min-w-0"
                      style={{ backgroundColor: "var(--app-card-subtle)" }}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                        USD Liabilities
                      </div>
                      <div
                        className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums truncate"
                        title={formatUSD(displayedLiabilities)}
                      >
                        {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatUSD(displayedLiabilities)}
                      </div>
                    </div>
                  </>
                ) : totalLiabilities > 0 ? (
                  <>
                    <div
                      className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors min-w-0"
                      style={{ backgroundColor: "var(--app-card-subtle)" }}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                        Total Assets
                      </div>
                      <div
                        className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums truncate"
                        title={formatCurrency(totalAssets)}
                      >
                        {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatCurrency(totalAssets)}
                      </div>
                    </div>

                    <div
                      className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors min-w-0"
                      style={{ backgroundColor: "var(--app-card-subtle)" }}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                        Total Liabilities
                      </div>
                      <div
                        className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums truncate"
                        title={formatCurrency(totalLiabilities)}
                      >
                        {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatCurrency(totalLiabilities)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors min-w-0"
                      style={{ backgroundColor: "var(--app-card-subtle)" }}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                        Total Assets
                      </div>
                      <div
                        className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums truncate"
                        title={formatCurrency(totalAssets)}
                      >
                        {loading ? <Skeleton className="h-5 w-20 rounded-md" /> : formatCurrency(totalAssets)}
                      </div>
                    </div>

                    <div
                      className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] transition-colors min-w-0"
                      style={{ backgroundColor: "var(--app-card-subtle)" }}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--app-muted)] font-semibold truncate">
                        Active Accounts
                      </div>
                      <div className="text-sm sm:text-base font-bold font-mono text-sky-600 dark:text-sky-400 mt-0.5 tabular-nums truncate">
                        {loading ? (
                          <Skeleton className="h-5 w-16 rounded-md" />
                        ) : (
                          `${accounts.length} ${accounts.length === 1 ? "Account" : "Accounts"}`
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sub-Badges Pill Row */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {currencyView === "INR" ? (
                  <>
                    <Badge variant="success" dot={true}>
                      {liquidPct}% Liquid Assets
                    </Badge>
                    {totalLiabilities > 0 && totalAssets > 0 && (
                      <Badge variant="danger">
                        {Math.round((totalLiabilities / totalAssets) * 100)}% Debt-to-Asset Ratio
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <Badge variant="neutral" dot={true}>
                      {cryptoHoldings.length} {cryptoHoldings.length === 1 ? "Asset" : "Assets"} in Spot
                    </Badge>
                    <Badge variant="neutral">
                      Binance Auto-Sync
                    </Badge>
                  </>
                )}
              </div>
            </div>

            {/* Right Column: Asset Allocation Donut Chart & Color Legend */}
            <div
              className="xl:col-span-7 min-w-0 flex items-center justify-center xl:justify-end border-t xl:border-t-0 xl:border-l pt-6 xl:pt-0 xl:pl-8 border-[var(--app-border-subtle)]"
            >
              {loading ? (
                <div className="flex items-center justify-center h-48 w-full">
                  <Skeleton className="w-40 h-40 rounded-full" />
                </div>
              ) : (
                <InteractiveDonutChart
                  title={currencyView === "USD" ? "Binance Crypto Allocation" : "Portfolio Asset Allocation"}
                  totalLabel={currencyView === "USD" ? "Crypto Assets (USD)" : "Total Assets"}
                  totalValue={currencyView === "USD" ? displayedAssets : (totalAssets > 0 ? totalAssets : calculatedNetWorth)}
                  segments={currencyView === "USD" ? cryptoDonutSegments : donutSegments}
                  formatter={currencyView === "USD" ? formatUSD : formatCurrency}
                  unitLabel={currencyView === "USD" ? "Coin" : "Class"}
                  align="end"
                  emptyMessage={currencyView === "USD" ? "No cryptocurrency holdings found." : "No asset allocation data available."}
                  emptySubMessage={currencyView === "USD" ? "Sync Binance in the Crypto tab to see your coin breakdown." : "Add bank accounts or cash in hand to see your portfolio breakdown."}
                  icon={<PieChartIcon size={24} className="opacity-50 text-[var(--app-accent)]" />}
                />
              )}
            </div>
          </div>
        </div>

        {/* MONTHLY FINANCIAL PULSE (3 Key High-Impact Metrics) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {/* 1. Monthly Inflow */}
            <StatCard
              title="This Month's Inflow"
              value={formatCurrency(totalMonthIncome)}
              icon={<TrendingUp size={16} />}
              iconColor="emerald"
              trend={{
                direction: "up",
                value: `${currentMonthIncomes.length} Inflows`,
                label: "recorded this cycle",
              }}
              onClick={() => onNavigate?.("income")}
            />

            {/* 2. Monthly Outflow */}
            <StatCard
              title="This Month's Spend"
              value={formatCurrency(totalMonthExpense)}
              icon={<TrendingDown size={16} />}
              iconColor="rose"
              trend={{
                direction: "down",
                value: `~${formatCurrency(dailyBurnRate)}/day`,
                label: "daily burn rate",
              }}
              onClick={() => onNavigate?.("expenses")}
            />

            {/* 3. Net Savings Rate */}
            <StatCard
              title="Net Savings & Rate"
              value={
                <span className={netSavings >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {netSavings >= 0 ? "+" : ""}
                  {formatCurrency(netSavings)}
                </span>
              }
              icon={<PiggyBank size={16} />}
              iconColor="sky"
              subtitle={
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[var(--app-muted)]">Savings Rate</span>
                  <span className="font-mono text-emerald-400">{savingsRate}%</span>
                </div>
              }
              progress={{
                value: savingsRate,
                color: "#10b981",
              }}
              onClick={() => onNavigate?.("budgets")}
            />
          </div>
        )}

        {/* TWO COLUMN ANALYTICS & INSIGHTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left Column: Top Spending Categories Breakdown */}
          <div
            className="lg:col-span-6 rounded-2xl p-5 sm:p-7 border border-[var(--app-border)] transition-all shadow-xs"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">
                  Top Spending Categories
                </h3>
                <p className="text-xs text-[var(--app-muted)] mt-0.5">
                  Monthly distribution of outflows
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("expenses")}
                className="text-xs font-semibold text-[var(--app-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {loading ? (
              <div className="space-y-4 pt-2">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
                <Skeleton className="h-4 w-4/6 rounded-md" />
              </div>
            ) : topExpenseCategories.length === 0 ? (
              <EmptyState
                compact={true}
                icon={<Target size={24} />}
                title="No expenses recorded this month"
                description="Log your everyday expenses in the Expenses tab to view dynamic category analytics."
                action={
                  <Button
                    size="xs"
                    variant="subtle"
                    icon={<Plus size={13} />}
                    onClick={() => onNavigate?.("expenses")}
                  >
                    Log an Expense
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {topExpenseCategories.map((item) => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-[var(--app-fg)] truncate">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono">
                        <span className="text-[var(--app-muted)]">{item.percentage}%</span>
                        <span className="font-bold text-[var(--app-fg)]">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[var(--app-track-bg)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Connected Accounts & Liquidity Strip */}
          <div
            className="lg:col-span-6 rounded-2xl p-5 sm:p-7 border border-[var(--app-border)] transition-all shadow-xs"
            style={{ backgroundColor: "var(--app-card)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">
                  Connected Accounts
                </h3>
                <p className="text-xs text-[var(--app-muted)] mt-0.5">
                  {accounts.length} active {accounts.length === 1 ? "holding" : "holdings"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("accounts")}
                className="text-xs font-semibold text-[var(--app-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Accounts</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3 pt-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : accounts.length === 0 ? (
              <EmptyState
                compact={true}
                icon={<Landmark size={24} />}
                title="No accounts linked yet"
                description="Connect your bank accounts, credit cards, or cash holdings to activate portfolio tracking."
                action={
                  <Button
                    size="xs"
                    variant="subtle"
                    icon={<Plus size={13} />}
                    onClick={() => onNavigate?.("accounts")}
                  >
                    Add First Account
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {accounts.slice(0, 4).map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => onNavigate?.("accounts")}
                    className="flex items-center justify-between p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] transition-all cursor-pointer hover:border-[var(--app-border-hover)] hover:bg-[var(--app-card-hover)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BankLogo name={acc.name} size={34} className="flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-[var(--app-fg)] truncate">
                          {acc.name}
                        </div>
                        <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-1.5">
                          <span>{acc.type}</span>
                          {acc.last_four &&
                            acc.last_four.toUpperCase() !== "CASH" &&
                            /^\d+$/.test(acc.last_four.trim()) && (
                              <>
                                <span>•</span>
                                <span className="font-mono">•••• {acc.last_four}</span>
                              </>
                            )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div
                        className={`font-mono font-bold text-xs sm:text-sm tabular-nums ${
                          acc.classification === "liability" ? "text-rose-400" : "text-[var(--app-fg)]"
                        }`}
                      >
                        {formatCurrency(acc.balance)}
                      </div>
                      <span
                        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                          acc.classification === "liability"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {acc.classification === "liability" ? "Liability" : "Asset"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT FINANCIAL ACTIVITY FEED */}
        <div
          className="rounded-2xl p-5 sm:p-7 border border-[var(--app-border)] transition-all shadow-xs"
          style={{ backgroundColor: "var(--app-card)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-[var(--app-fg)]">
                Recent Financial Activity
              </h3>
              <p className="text-xs text-[var(--app-muted)] mt-0.5">
                Latest transactions across your active holdings
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("ledger")}
              className="flex items-center gap-1.5 text-xs font-bold text-[var(--app-accent)] hover:underline cursor-pointer"
            >
              <span>View All Transactions</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : recentActivities.length === 0 ? (
            <EmptyState
              compact={true}
              icon={<Clock size={24} />}
              title="No recent transactions recorded"
              description="Transactions you log in Expenses, Income, or Transfers will appear here in real time."
              action={
                <Button
                  size="xs"
                  variant="subtle"
                  icon={<Plus size={13} />}
                  onClick={() => onNavigate?.("expenses")}
                >
                  Record a Transaction
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--app-border-subtle)]">
              {recentActivities.map((act) => {
                const isIncome = act.type === "income";
                const isExpense = act.type === "expense";

                return (
                  <div
                    key={`${act.type}-${act.id}`}
                    className="py-3 sm:py-3.5 flex items-center justify-between gap-3 group transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        {isExpense ? (
                          <EntityLogo name={act.title} category={act.category} size={36} />
                        ) : isIncome ? (
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <TrendingUp size={16} />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center flex-shrink-0">
                            <ArrowLeftRight size={16} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[var(--app-fg)] truncate">
                          {act.title}
                        </div>
                        <div className="text-[11px] text-[var(--app-muted)] flex items-center gap-2 mt-0.5">
                          {act.category && (
                            <span className="px-2 py-0.5 rounded-md border text-[10px] font-mono border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]">
                              {act.category}
                            </span>
                          )}
                          <span>
                            {new Date(act.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          {act.accountName && (
                            <>
                              <span>•</span>
                              <span className="truncate">{act.accountName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div
                        className={`font-mono font-bold text-xs sm:text-sm tabular-nums whitespace-nowrap ${
                          isIncome
                            ? "text-emerald-400"
                            : isExpense
                            ? "text-rose-400"
                            : "text-sky-400"
                        }`}
                      >
                        {isIncome ? "+" : isExpense ? "−" : ""}
                        {formatCurrency(act.amount)}
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--app-muted)]">
                        {act.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
