"use client";

import { useMemo, useState, useEffect, memo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addIncome, deleteIncome } from "./actions";
import { format, parseISO, subMonths } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/empty-state";

import { getBankLogoSources } from "@/lib/banks";
import { getCompanyLogoSources } from "@/lib/companies";

import { CHART_COLOURS, CHART_SERIES_COLOURS } from "@/lib/chart-colours";
function getColorByLabel(label: string | null | undefined) {
  if (!label) return CHART_COLOURS[0];
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return CHART_COLOURS[hash % CHART_COLOURS.length];
}

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "@/components/ui/recharts";
// Direct HQ logo URLs for known companies (Clearbit full-color logos — NOT monochrome icons)
const COMPANY_LOGO_DOMAINS: Record<string, string> = {
  samsung: "samsung.com",
  tvs: "tvsmotor.com",
  google: "google.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  amazon: "amazon.com",
  meta: "meta.com",
  facebook: "facebook.com",
  netflix: "netflix.com",
  tcs: "tcs.com",
  tata: "tata.com",
  infosys: "infosys.com",
  wipro: "wipro.com",
  accenture: "accenture.com",
  cognizant: "cognizant.com",
  hcl: "hcltech.com",
  techmahindra: "techmahindra.com",
  capgemini: "capgemini.com",
  ibm: "ibm.com",
  oracle: "oracle.com",
  salesforce: "salesforce.com",
  adobe: "adobe.com",
  uber: "uber.com",
  swiggy: "swiggy.in",
  zomato: "zomato.com",
  flipkart: "flipkart.com",
  razorpay: "razorpay.com",
  stripe: "stripe.com",
  upwork: "upwork.com",
  fiverr: "fiverr.com",
  toptal: "toptal.com",
  linkedin: "linkedin.com",
  atlassian: "atlassian.com",
  github: "github.com",
  gitlab: "gitlab.com",
  zoom: "zoom.us",
  slack: "slack.com",
  shopify: "shopify.com",
  twitter: "x.com",
  snap: "snap.com",
  spotify: "spotify.com",
  airbnb: "airbnb.com",
  paypal: "paypal.com",
  paytm: "paytm.com",
  phonepe: "phonepe.com",
  fiver: "fiverr.com",
  mrf: "mrftyres.com",
};

function getBrandMonogram(name: string): string {
  const cleaned = name
    .replace(/^(dividend|salary|interest|bonus|freelance|payout|credit|payment|refund|from|to|transfer):\s*/i, "")
    .replace(/\b(ltd|limited|corp|corporation|inc|incorporated|serv|services|lt|co)\b/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[—–\-]\s*₹.*$/i, "")
    .trim();
  
  if (cleaned.length === 0) return "IN";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

const MONOGRAM_GRADIENTS = [
  "from-blue-500 via-indigo-600 to-purple-600",
  "from-emerald-500 via-teal-600 to-cyan-600",
  "from-orange-500 via-red-500 to-pink-600",
  "from-violet-500 via-purple-600 to-fuchsia-600",
  "from-cyan-500 via-blue-600 to-indigo-600",
  "from-rose-500 via-pink-500 to-fuchsia-600",
];

function getGradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return MONOGRAM_GRADIENTS[Math.abs(hash) % MONOGRAM_GRADIENTS.length];
}

const CompanyLogo = memo(({ name, fallbackText = "I", className = "w-10 h-10" }: { name?: string; fallbackText?: string; className?: string }) => {
  const cleanName = useMemo(() => {
    if (!name) return "";
    return name.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim();
  }, [name]);

  const sources = useMemo(() => {
    if (!cleanName) return [];
    const companySources = getCompanyLogoSources(cleanName);
    if (companySources.length > 0) return companySources;

    const bankSources = getBankLogoSources(cleanName);
    if (bankSources.length > 0) return bankSources;

    return [];
  }, [cleanName]);

  const [srcIndex, setSrcIndex] = useState(0);

  const [prevName, setPrevName] = useState(cleanName);
  if (prevName !== cleanName) {
    setPrevName(cleanName);
    setSrcIndex(0);
  }

  const initials = getBrandMonogram(cleanName || fallbackText);
  const gradient = getGradientForName(cleanName || "");

  if (!sources.length || srcIndex >= sources.length) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-xs tracking-wider shadow-md shrink-0 select-none p-1 text-center truncate`}>
        {initials}
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center justify-center shrink-0 rounded-2xl bg-white p-1.5 shadow-md border border-white/30 overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={sources[srcIndex]}
        src={sources[srcIndex]}
        alt={cleanName || "Company"}
        className="w-full h-full object-contain rounded-xl"
        loading="eager"
        onError={() => setSrcIndex((prev) => prev + 1)}
      />
    </div>
  );
});
CompanyLogo.displayName = "CompanyLogo";

const AccountBankLogo = memo(({ bankName, accountName, className = "w-6 h-6" }: { bankName?: string | null; accountName?: string; className?: string }) => {
  const query = (bankName || accountName || "").trim().toLowerCase();
  const isCash = query.includes("cash");
  const isDirect = query.includes("direct") || query.includes("ledger");

  const sources = useMemo(() => {
    if (isCash || isDirect) return [];
    return getBankLogoSources(bankName || accountName || "");
  }, [bankName, accountName, isCash, isDirect]);

  const [srcIndex, setSrcIndex] = useState(0);

  const [prevKey, setPrevKey] = useState(`${bankName}-${accountName}`);
  if (prevKey !== `${bankName}-${accountName}`) {
    setPrevKey(`${bankName}-${accountName}`);
    setSrcIndex(0);
  }

  if (isCash) {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 border border-amber-400/30 flex items-center justify-center text-white text-[11px] shadow-md shrink-0 select-none`}>
        💵
      </div>
    );
  }

  if (isDirect) {
    return (
      <div className={`${className} rounded-lg bg-slate-800 border border-white/20 flex items-center justify-center text-sky-400 font-black text-[10px] shrink-0 select-none`}>
        D
      </div>
    );
  }

  if (!sources || sources.length === 0 || srcIndex >= sources.length) {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white font-bold text-[10px] shrink-0 select-none`}>
        {(accountName || bankName || "B").charAt(0).toUpperCase()}
      </div>
    );
  }

  const currentSrc = sources[srcIndex];

  return (
    <div className={`${className} flex items-center justify-center shrink-0 rounded-lg bg-white p-0.5 shadow-sm border border-white/20 overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={bankName || accountName || "Bank"}
        className="w-full h-full object-contain"
        loading="lazy"
        onError={() => setSrcIndex(prev => prev + 1)}
      />
    </div>
  );
});
AccountBankLogo.displayName = "AccountBankLogo";

const INCOME_CATEGORIES = [
  { label: "Salary", icon: "🏢", color: CHART_COLOURS[0] },
  { label: "Dividend", icon: "💎", color: "#10b981" },
  { label: "Work", icon: "💻", color: CHART_COLOURS[1] },
  { label: "Freelance", icon: "🚀", color: CHART_COLOURS[2] },
  { label: "Gift", icon: "💝", color: CHART_COLOURS[3] },
  { label: "Bonus", icon: "✨", color: CHART_COLOURS[4] },
  { label: "Refund", icon: "↩️", color: CHART_COLOURS[5] },
  { label: "Others", icon: "📦", color: CHART_COLOURS[6] },
];

export default function IncomeClient({ initialData }: { initialData?: FinanceData }) {

  const { data: { incomes, accounts, profile }, isValidating, mutate } = useFinanceData(initialData);
  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);

  const defaultDate = useMemo(() => {
    const today = new Date();
    const yyyy = selectedYear;
    const mm = String(selectedMonth).padStart(2, '0');
    if (today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear) {
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } else {
      return `${yyyy}-${mm}-01`;
    }
  }, [selectedMonth, selectedYear]);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Salary",
    date: "",
    account_id: "",
    is_recurring: false,
    recurrence_frequency: "monthly",
    recurrence_day: 1,
    recurrence_end_date: "",
  });

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    const isNew = searchParams.get("action") === "new";
    if (isNew && !initialized && accounts.length > 0 && defaultDate) {
      const defaultAccId = profile?.default_accounts?.income;
      const account_id = (defaultAccId && accounts.some(a => a.id === defaultAccId)) ? defaultAccId : "";
      setTimeout(() => {
        setInitialized(true);
        setFormData({
          description: "",
          amount: "",
          category: "Salary",
          date: defaultDate,
          account_id,
          is_recurring: false,
          recurrence_frequency: "monthly",
          recurrence_day: 1,
          recurrence_end_date: "",
        });
      }, 0);
    } else if (!initialized && defaultDate) {
      setTimeout(() => {
        setInitialized(true);
        setFormData(prev => ({ ...prev, date: defaultDate }));
      }, 0);
    }
  }, [accounts, profile, defaultDate, initialized, searchParams]);

  const [prevCategoryFilter, setPrevCategoryFilter] = useState(categoryFilter);
  const [prevSelectedMonth, setPrevSelectedMonth] = useState(selectedMonth);
  const [prevSelectedYear, setPrevSelectedYear] = useState(selectedYear);

  if (categoryFilter !== prevCategoryFilter || selectedMonth !== prevSelectedMonth || selectedYear !== prevSelectedYear) {
    setPrevCategoryFilter(categoryFilter);
    setPrevSelectedMonth(selectedMonth);
    setPrevSelectedYear(selectedYear);
    setCurrentPage(1);
  }

  const handleOpenAddModal = () => {
    const defaultAccId = profile?.default_accounts?.income;
    const account_id = (defaultAccId && accounts.some(a => a.id === defaultAccId)) ? defaultAccId : "";
    setFormData({
      description: "",
      amount: "",
      category: "Salary",
      date: defaultDate,
      account_id,
      is_recurring: false,
      recurrence_frequency: "monthly",
      recurrence_day: 1,
      recurrence_end_date: "",
    });
    setShowAddModal(true);
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDeleteConfirm(false);
        setDeletingIncomeId(null);
        setShowAddModal(false);
      }
    };
    if (showDeleteConfirm || showAddModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteConfirm, showAddModal]);

  async function handleDeleteIncome(id: string) {
    setDeletingIncomeId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteIncome() {
    if (!deletingIncomeId) return;
    await withLock(async () => {
      const res = await deleteIncome(deletingIncomeId);
      if (!res?.error) {
        toast.success(res.message || "Income entry reverted successfully");
        mutate();
      } else {
        toast.error(res.error);
      }
      setShowDeleteConfirm(false);
      setDeletingIncomeId(null);
    });
  }

  const stats = useMemo(() => {
    const targetDate = new Date(selectedYear, selectedMonth - 1, 1);
    const currentMonth = incomes.filter(i => {
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
    const monthlyTotal = currentMonth.reduce((s, i) => s + Number(i.amount), 0);
    
    // YoY comparison - same month last year
    const lastYearSameMonth = new Date(selectedYear - 1, selectedMonth - 1, 1);
    const lastYearIncomes = incomes.filter(i => {
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === lastYearSameMonth.getMonth() + 1 && d.getFullYear() === lastYearSameMonth.getFullYear();
    });
    const lastYearTotal = lastYearIncomes.reduce((s, i) => s + Number(i.amount), 0);
    const yoyChange = lastYearTotal > 0 ? ((monthlyTotal - lastYearTotal) / lastYearTotal) * 100 : 0;
    const yoyAbsolute = monthlyTotal - lastYearTotal;
    
    const catMap: Record<string, number> = {};
    currentMonth.forEach(i => {
      catMap[i.category] = (catMap[i.category] || 0) + Number(i.amount);
    });
    const pieData = Object.entries(catMap)
      .map(([name, value]) => {
        const categoryColor = INCOME_CATEGORIES.find((c) => c.label === name)?.color;
        const resolvedColor =
          categoryColor ||
          getColorByLabel(name);

        return {
          name,
          value,
          fill: resolvedColor,
          color: resolvedColor,
        };
      })
      .sort((a, b) => b.value - a.value);

    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(targetDate, i);
      trendMap[format(d, "MMM yy")] = 0;
    }
    incomes.forEach(i => {
      if (!i.date) return;
      const m = format(parseISO(i.date), "MMM yy");
      if (trendMap[m] !== undefined) {
        trendMap[m] += Number(i.amount);
      }
    });
    const trendData = Object.entries(trendMap).map(([name, value]) => ({ name, value }));

    const dividendIncomes = incomes.filter(i => 
      i.category?.toLowerCase() === "dividend" || 
      i.description?.toLowerCase().includes("dividend")
    );
    const totalDividends = dividendIncomes.reduce((s, i) => s + Number(i.amount), 0);

    return { totalIncome, monthlyTotal, pieData, trendData, yoyChange, yoyAbsolute, lastYearTotal, totalDividends };
  }, [incomes, selectedMonth, selectedYear]);

  const filteredIncomes = useMemo(() => {
    const filtered = incomes.filter(i => {
      const matchCat = categoryFilter === "All" || i.category === categoryFilter;
      if (!matchCat) return false;
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
    
    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [incomes, categoryFilter, currentPage, selectedMonth, selectedYear]);

  const totalFilteredCount = useMemo(() => {
    return incomes.filter(i => {
      const matchCat = categoryFilter === "All" || i.category === categoryFilter;
      if (!matchCat) return false;
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    }).length;
  }, [incomes, categoryFilter, selectedMonth, selectedYear]);

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.account_id) {
      toast.error("Please select a deposit account");
      return;
    }
    await withLock(async () => {
      const result = await addIncome({ 
        ...formData, 
        amount: parseFloat(formData.amount), 
        account_id: formData.account_id || undefined 
      });
      if (!result?.error) {
        toast.success("Revenue inflow registered successfully");
        const today = new Date();
        const yyyy = selectedYear;
        const mm = String(selectedMonth).padStart(2, '0');
        const defaultDate = (today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear)
          ? `${yyyy}-${mm}-${String(today.getDate()).padStart(2, '0')}`
          : `${yyyy}-${mm}-01`;

        setFormData({
          description: "",
          amount: "",
          category: "Salary",
          date: defaultDate,
          account_id: "",
          is_recurring: false,
          recurrence_frequency: "monthly",
          recurrence_day: 1,
          recurrence_end_date: "",
        });
        setShowAddModal(false);
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Income Strategy</h1>
            <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
          </div>
          <p className="text-[--text-secondary] text-sm md:text-sm mt-1">Monitor your revenue streams and track financial growth.</p>
        </div>
         <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Desktop Month Switcher */}
          <div className="hidden md:flex items-center gap-1.5 bg-white/5 border border-white/10 p-1.5 rounded-xl">
            <button
              type="button"
              onClick={() => {
                if (selectedMonth === 1) {
                  setSelectedMonth(12);
                  setSelectedYear(prev => prev - 1);
                } else {
                  setSelectedMonth(prev => prev - 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-black text-[--text-muted] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              ◀
            </button>
            <div className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-400 select-none">
              {format(new Date(selectedYear, selectedMonth - 1, 1), "MMM yyyy")}
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedMonth === 12) {
                  setSelectedMonth(1);
                  setSelectedYear(prev => prev + 1);
                } else {
                  setSelectedMonth(prev => prev + 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-black text-[--text-muted] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          {/* Mobile Fallback selects */}
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold md:hidden" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            aria-label="Select month"
            id="income-month-select"
            name="month"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1} className="bg-[--bg-surface]">
                {format(new Date(2020, i, 1), "MMMM")}
              </option>
            ))}
          </select>
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold md:hidden" 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            aria-label="Select year"
            id="income-year-select"
            name="year"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y} className="bg-[--bg-surface]">{y}</option>
            ))}
          </select>
          <button type="button" onClick={handleOpenAddModal} className="btn-primary flex-1 md:flex-none gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Log Income
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[--text-muted]">Net Throughput</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black text-success">
              +₹{stats.totalIncome.toLocaleString()}
            </h3>
            <span className="text-[0.5625rem] w-fit px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-bold shrink-0">Lifetime</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[--text-muted]">Monthly Flow</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black text-success">
              +₹{stats.monthlyTotal.toLocaleString()}
            </h3>
            <span className="text-[0.5625rem] w-fit px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20 font-bold shrink-0">{format(new Date(), "MMM")}</span>
          </div>
          {stats.lastYearTotal > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs font-black ${stats.yoyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.yoyChange >= 0 ? '↑' : '↓'} {Math.abs(stats.yoyChange).toFixed(1)}%
              </span>
              <span className="text-[0.5625rem] text-[--text-muted] font-bold">vs last year</span>
            </div>
          )}
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[--text-muted]">Average Inflow</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black text-success">
              +₹{(incomes.length ? stats.totalIncome / incomes.length : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
            </h3>
            <span className="text-[0.5625rem] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted] shrink-0">{incomes.length} entries</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card-static p-5 md:p-8">
          <div className="flex items-center justify-between mb-8"><h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Income Velocity</h3><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs font-bold text-[--text-muted]">Inbound Flow</span></div></div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_SERIES_COLOURS.income} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_SERIES_COLOURS.income} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} dy={10} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="value" stroke={CHART_SERIES_COLOURS.income} strokeWidth={3} fillOpacity={1} fill="url(#incomeGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8"><h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-8">Source Distribution</h3><div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}><PieChart><Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">{stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }} /></PieChart></ResponsiveContainer></div><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">{stats.pieData.slice(0, 4).map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background: item.color}} /><span className="text-xs font-bold text-[--text-secondary] truncate">{item.name}</span></div>))}</div></div>
      </div>

      <div className="glass-card-static overflow-hidden border-white/5">
        <div className="p-5 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto"><select className="input-premium py-1.5 px-2 text-xs w-28 md:w-32" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by source" id="income-category-filter" name="categoryFilter"><option value="All">All Sources</option>{INCOME_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}</select></div>
          <div className="text-xs font-bold text-[--text-muted]">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalFilteredCount)} of {totalFilteredCount} results
          </div>
        </div>

        <div className="hidden table-responsive-wrapper md:block relative">
          {incomes.length === 0 ? (
            <EmptyState
              title="Track Your Wealth Inflow"
              description="No revenue streams detected. Start by logging your first income to visualize your growth strategy."
              icon={
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
              }
              glowColor="emerald"
              action={
                <button type="button" onClick={handleOpenAddModal} className="btn-primary shadow-xl !bg-emerald-500 hover:!bg-emerald-600 shadow-emerald-500/20 mt-8 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                  Log Your First Income
                </button>
              }
            />
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-[#12151c] shadow-sm">
                <tr className="border-b border-white/5">
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Source</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Segment</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] hidden sm:table-cell">Destination</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredIncomes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-[--text-muted] text-sm italic">No income transactions logged for this period.</td>
                  </tr>
                ) : (
                  filteredIncomes.map((inc) => {
                    const isAiLogged = /^\[(gemini ai|telegram|ai|bot)\]/i.test(inc.description);
                    const cleanDesc = inc.description.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim();
                    const isDividend = /dividend/i.test(inc.description);
                    const categoryLabel = isDividend ? "DIVIDEND" : inc.category;
                    const theme = INCOME_CATEGORIES.find(c => c.label === categoryLabel) || INCOME_CATEGORIES[6];
                    const account = accounts.find(a => a.id === inc.account_id);
                    return (
                      <tr key={inc.id} className="text-[--text-primary] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap">
                          <p className="text-xs font-bold">{inc.date ? format(parseISO(inc.date), "MMM d, yy") : "N/A"}</p>
                          <p className="text-[0.5625rem] text-success/60 font-bold uppercase">Credit</p>
                        </td>
                        <td className="px-4 md:px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo name={inc.description} fallbackText="I" className="w-10 h-10" />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold group-hover:text-success transition-colors truncate max-w-[140px] md:max-w-none">{cleanDesc}</p>
                                {isAiLogged && (
                                  <span className="text-[8px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded shrink-0">
                                    AI Log
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[0.5625rem] font-black uppercase tracking-[0.1em] bg-success/5 border border-success/10 text-success" style={{color: theme.color}}>{categoryLabel}</span>
                        </td>
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap hidden sm:table-cell">
                          <div className="flex items-center gap-2.5">
                            <AccountBankLogo bankName={account?.bank_name} accountName={account?.name} className="w-6 h-6" />
                            <span className="text-xs font-semibold text-[--text-secondary]">{account?.name || "Direct Log"}</span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap text-right">
                          <p className="text-xs md:text-sm font-black text-success">+{getAccountCurrency(inc.account_id) === 'USD' ? '$' : '₹'}{Number(inc.amount).toLocaleString()}</p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile card list feed for incomes */}
        <div className="divide-y divide-white/10 md:hidden">
          {filteredIncomes.length === 0 ? (
            <div className="p-8 text-center text-[--text-muted] text-xs italic">
              No transactions found matching your criteria.
            </div>
          ) : (
            filteredIncomes.map((inc) => {
              const isAiLogged = /^\[(gemini ai|telegram|ai|bot)\]/i.test(inc.description);
              const cleanDesc = inc.description.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim();
              const isDividend = /dividend/i.test(inc.description);
              const categoryLabel = isDividend ? "DIVIDEND" : inc.category;
              const theme = INCOME_CATEGORIES.find(c => c.label === categoryLabel) || INCOME_CATEGORIES[6];
              const account = accounts.find(a => a.id === inc.account_id);
              return (
                <div key={inc.id} className="p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo name={inc.description} fallbackText="I" className="w-10 h-10" />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-[--text-primary] truncate">{cleanDesc}</span>
                          {isAiLogged && (
                            <span className="text-[8px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1 py-0.5 rounded shrink-0">
                              AI
                            </span>
                          )}
                        </div>
                        <span className="text-[0.5625rem] text-[--text-muted] uppercase font-bold">{inc.date ? format(parseISO(inc.date), "MMM d, yyyy") : "—"}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[15px] font-black text-success">+{getAccountCurrency(inc.account_id) === 'USD' ? '$' : '₹'}{Number(inc.amount).toLocaleString()}</span>
                      <span className="px-2 py-0.5 rounded-full text-[0.5rem] font-black uppercase tracking-[0.1em] bg-success/5 border border-success/10 text-success" style={{color: theme.color}}>{categoryLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.03] pt-2 mt-1">
                    <div className="flex items-center gap-2">
                      <AccountBankLogo bankName={account?.bank_name} accountName={account?.name} className="w-6 h-6" />
                      <span className="text-xs font-medium text-[--text-secondary]">{account?.name || "Direct Log"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <button type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button type="button"
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                      currentPage === pageNum
                        ? 'bg-success text-white'
                        : 'bg-white/5 hover:bg-white/10 text-[--text-muted]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div role="dialog" aria-modal="true" className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-sm p-8 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-[--text-primary]">Delete Income</h3>
                <p className="text-sm text-[--text-secondary] mt-2">Are you sure you want to delete this income entry? Your account balance will be updated.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletingIncomeId(null); }} className="btn-secondary flex-1 h-11 font-bold rounded-xl">Cancel</button>
                <button type="button" onClick={confirmDeleteIncome} className="btn-danger flex-1 h-11 font-bold rounded-xl" disabled={submitting}>Revert</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Income"
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[0.625rem] font-black uppercase tracking-wider text-[--text-muted]">
                  {formData.category === "Salary" ? "Company / Employer" : "Description / Source"}
                </label>
                <input autoFocus type="text" required className="input-premium !h-9 text-xs" placeholder={formData.category === "Salary" ? "e.g. Google" : "e.g. Freelance Web Design"} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} autoComplete="new-password" id="income-description" name="description" />
              </div>
              
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[0.625rem] font-black uppercase tracking-wider text-[--text-muted]">Amount</label>
                <input type="number" required className="input-premium !h-9 text-xs" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} autoComplete="new-password" inputMode="decimal" id="income-amount" name="amount" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="income-category" className="text-[0.625rem] font-black uppercase tracking-wider text-[--text-muted]">Stream / Category</label>
              <select
                id="income-category"
                name="category"
                aria-label="Select Income Stream / Category"
                className="input-premium !h-9.5 text-xs font-semibold w-full cursor-pointer"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label} className="bg-[#151922] text-white py-1">
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</label>
                <input type="date" required className="input-premium py-2 text-xs" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} autoComplete="new-password" id="income-date" name="date" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Account</label>
                <select className="input-premium py-2 text-xs" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})} aria-label="Select deposit account" id="income-account" name="account_id">
                  <option value="" disabled className="bg-[--bg-surface]">Select Deposit Account</option>
                  {accounts.map(acc => {
                    const symbol = acc.currency === "USD" ? "$" : "₹";
                    const nameLabel = acc.bank_name && acc.bank_name.trim().toLowerCase() !== acc.name.trim().toLowerCase()
                      ? `${acc.bank_name} (${acc.name})`
                      : acc.name;
                    return (
                      <option key={acc.id} value={acc.id} className="bg-[--bg-surface]">
                        {nameLabel} — {symbol}{acc.balance.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {formData.account_id && (() => {
              const selectedAcc = accounts.find(a => a.id === formData.account_id);
              return selectedAcc ? (
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
                  <span className="font-medium">Selected Balance</span>
                  <span className="font-bold text-white">
                    {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                  </span>
                </div>
              ) : null;
            })()}

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="inc-recurring">
                  Recurring Income
                </label>
                <input
                  type="checkbox"
                  id="inc-recurring"
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                  checked={formData.is_recurring}
                  onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })}
                />
              </div>

              {formData.is_recurring && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[0.5625rem] font-bold text-[--text-muted]" htmlFor="inc-frequency">
                      Frequency
                    </label>
                    <select
                      id="inc-frequency"
                      className="input-premium !h-9 text-xs text-white"
                      value={formData.recurrence_frequency}
                      onChange={e => setFormData({ ...formData, recurrence_frequency: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[0.5625rem] font-bold text-[--text-muted]" htmlFor="inc-rec-day">
                      Day Due
                    </label>
                    <input
                      type="number"
                      id="inc-rec-day"
                      min="1"
                      max="31"
                      className="input-premium !h-9 text-xs text-white"
                      value={formData.recurrence_day}
                      onChange={e => setFormData({ ...formData, recurrence_day: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[0.5625rem] font-bold text-[--text-muted]" htmlFor="inc-end-date">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="inc-end-date"
                      className="input-premium !h-9 text-xs text-white"
                      value={formData.recurrence_end_date}
                      onChange={e => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-2 mt-4">
              <button type="submit" disabled={submitting} className="btn-primary w-full h-10 shadow-xl shadow-[--accent-primary]/20 text-xs font-black uppercase tracking-widest cursor-pointer">
                {submitting ? "Deploying..." : "Finalize Entry"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
