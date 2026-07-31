"use client";

import { useMemo, useState } from "react";
import { endOfDay, format, isWithinInterval, startOfDay } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import LedgerDataTable from "./components/LedgerDataTable";
import MiniCalendar from "./components/MiniCalendar";

type LedgerLog = {
  id: string;
  created_at: string | null;
  account_name: string | null;
  account_id: string | null;
  action_type: string;
  amount: number | null;
  previous_balance: number | null;
  new_balance: number | null;
  details: string | null;
  source_type: string | null;
  source_id: string | null;
};

const DEBIT_ACTIONS = new Set(["ADJUST_DOWN", "TRANSFER_OUT", "DELETE", "SEND_MONEY", "EXPENSE", "WITHDRAWAL"]);
const CREDIT_ACTIONS = new Set(["ADJUST_UP", "TRANSFER_IN", "CREATE", "INCOME", "DEPOSIT"]);

const ACTION_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; ring: string }> = {
  CREATE: { label: "Created", icon: "✨", bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", ring: "rgba(16, 185, 129, 0.2)" },
  DELETE: { label: "Deleted", icon: "🗑️", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  UPDATE: { label: "Updated", icon: "✏️", bg: "rgba(99, 102, 241, 0.1)", text: "#818cf8", ring: "rgba(99, 102, 241, 0.2)" },
  TRANSFER_IN: { label: "Inflow", icon: "📥", bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", ring: "rgba(16, 185, 129, 0.2)" },
  TRANSFER_OUT: { label: "Outflow", icon: "📤", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  ADJUST_UP: { label: "Adjust Up", icon: "📈", bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", ring: "rgba(16, 185, 129, 0.2)" },
  ADJUST_DOWN: { label: "Adjust Down", icon: "📉", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  SEND_MONEY: { label: "Family Send", icon: "👨‍👩‍👧‍👦", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  EXPENSE: { label: "Expense", icon: "💸", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  INCOME: { label: "Income", icon: "💰", bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", ring: "rgba(16, 185, 129, 0.2)" },
};

const formatMoney = (value: number | null | undefined, currency = "INR") => {
  if (value === null || value === undefined) return "—";
  const symbol = currency === "USD" ? "$" : "₹";
  return `${symbol}${value.toLocaleString()}`;
};

const isDebitLog = (log: LedgerLog) => {
  if (log.new_balance !== null && log.previous_balance !== null) {
    return log.new_balance < log.previous_balance;
  }
  return DEBIT_ACTIONS.has(log.action_type);
};

const isCreditLog = (log: LedgerLog) => {
  if (log.new_balance !== null && log.previous_balance !== null) {
    return log.new_balance > log.previous_balance;
  }
  return CREDIT_ACTIONS.has(log.action_type);
};

export default function LedgerClient({ initialData }: { initialData?: FinanceData }) {
  const {
    data: { ledgerLogs: logs, accounts },
    isValidating,
    mutate,
  } = useFinanceData(initialData);

  const getLogCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuickRange, setActiveQuickRange] = useState("All Time");

  const selectQuickRange = (range: string) => {
    setActiveQuickRange(range);
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    
    if (range === "Today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (range === "Yesterday") {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (range === "This Month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(format(start, "yyyy-MM-dd"));
      setEndDate(format(end, "yyyy-MM-dd"));
    } else if (range === "Last 30 Days") {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setStartDate(format(start, "yyyy-MM-dd"));
      setEndDate(todayStr);
    } else if (range === "All Time") {
      setStartDate("");
      setEndDate("");
    }
  };

  const allFilteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!log.created_at) return false;

      // Filter by account
      if (selectedAccountId !== "all" && log.account_id !== selectedAccountId) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const detailsMatch = (log.details || "").toLowerCase().includes(q);
        const actionMatch = log.action_type.toLowerCase().includes(q);
        const accMatch = (log.account_name || "").toLowerCase().includes(q);
        if (!detailsMatch && !actionMatch && !accMatch) {
          return false;
        }
      }

      const date = new Date(log.created_at);

      if (startDate || endDate) {
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
        const end = endDate ? endOfDay(new Date(endDate)) : new Date();
        return isWithinInterval(date, { start, end });
      }
      return true;
    });
  }, [endDate, logs, startDate, selectedAccountId, searchQuery]);

  const openingBalance = useMemo(() => {
    if (allFilteredLogs.length === 0) return 0;
    const oldestLog = allFilteredLogs[allFilteredLogs.length - 1];
    return oldestLog.previous_balance || 0;
  }, [allFilteredLogs]);

  const closingBalance = useMemo(() => {
    if (allFilteredLogs.length === 0) return 0;
    const newestLog = allFilteredLogs[0];
    return newestLog.new_balance || 0;
  }, [allFilteredLogs]);

  const totalInflow = useMemo(() => {
    return allFilteredLogs.reduce((sum, log) => {
      if (!isCreditLog(log)) return sum;
      return sum + (log.amount || 0);
    }, 0);
  }, [allFilteredLogs]);

  const totalOutflow = useMemo(() => {
    return allFilteredLogs.reduce((sum, log) => {
      if (!isDebitLog(log)) return sum;
      return sum + (log.amount || 0);
    }, 0);
  }, [allFilteredLogs]);

  const resetRange = () => {
    setStartDate("");
    setEndDate("");
    setActiveQuickRange("All Time");
  };

  const getActionConfig = (type: string) => {
    return ACTION_CONFIG[type] || {
      label: type,
      icon: "⚙️",
      bg: "rgba(255, 255, 255, 0.05)",
      text: "#8b8d98",
      ring: "rgba(255, 255, 255, 0.1)",
    };
  };

  const getActionBadge = (log: LedgerLog) => {
    let type = log.action_type;
    if (log.source_type === "family_transfer") {
      type = "SEND_MONEY";
    }
    const cfg = getActionConfig(type);
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[0.5625rem] font-mono font-black uppercase tracking-wider border whitespace-nowrap"
        style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.ring }}
      >
        <span className="text-xs shrink-0" aria-hidden="true">{cfg.icon}</span>
        {cfg.label}
      </span>
    );
  };

  const logDatesSet = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      if (log.created_at) {
        set.add(log.created_at.split("T")[0]);
      }
    }
    return set;
  }, [logs]);

  return (
    <div className="flex flex-col gap-[var(--section-gap)] max-w-7xl mx-auto w-full px-2">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-2">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Ledger</h1>
            <p className="text-xs text-[--text-muted] font-black uppercase tracking-[0.3em] mt-1.5">Console Statement & Balance Audit Trail</p>
          </div>
          <div className="inline-flex items-center gap-2 mt-1">
            <span className={`h-2 w-2 rounded-full shadow-lg ${isValidating ? "animate-pulse bg-warning shadow-warning/40" : "bg-success shadow-success/40"}`} />
          </div>
        </div>
      </header>

      {/* Compact Filter Toolbar */}
      <section className="bg-[#151515] p-3.5 rounded-xl border border-white/10 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search & Account Select */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search logs, details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white outline-none focus:border-[#f26522] placeholder:text-gray-500 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1.5 text-xs text-gray-500 hover:text-white">✕</button>
              )}
            </div>

            {/* Account Selector */}
            <select
              className="bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#f26522] cursor-pointer min-w-[140px]"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="all" className="bg-[#181A20] text-white">All Accounts</option>
              {accounts.map(acc => {
                const symbol = acc.currency === "USD" ? "$" : "₹";
                const nameLabel = acc.bank_name && acc.bank_name.trim().toLowerCase() !== acc.name.trim().toLowerCase()
                  ? `${acc.bank_name} (${acc.name})`
                  : acc.name;
                return (
                  <option key={acc.id} value={acc.id} className="bg-[#181A20] text-white">
                    {nameLabel} — {symbol}{acc.balance.toLocaleString()}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Right: Quick Range Chips & Mini Calendar */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "All", value: "All Time" },
              { label: "Today", value: "Today" },
              { label: "Yesterday", value: "Yesterday" },
              { label: "This Month", value: "This Month" },
              { label: "30 Days", value: "Last 30 Days" },
            ].map((range) => {
              const isActive = activeQuickRange === range.value;
              return (
                <button
                  key={range.value}
                  onClick={() => selectQuickRange(range.value)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                    isActive
                      ? "bg-[#f26522] text-white border-[#f26522] shadow-[0_0_10px_rgba(242,101,34,0.3)]"
                      : "bg-[#1e1e1e] text-gray-400 border-white/5 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}

            {/* Interactive Small Calendar Component */}
            <MiniCalendar
              startDate={startDate}
              endDate={endDate}
              logDatesSet={logDatesSet}
              onSelectDate={(dateStr) => {
                setStartDate(dateStr);
                setEndDate(dateStr);
                setActiveQuickRange("Custom");
              }}
              onSelectRange={(startStr, endStr) => {
                setStartDate(startStr);
                setEndDate(endStr);
                setActiveQuickRange("Custom");
              }}
              onReset={() => {
                resetRange();
              }}
            />
          </div>
        </div>

        {/* Date Inputs & Active Filter Clear Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-gray-500">Manual Date:</span>
            <input
              type="date"
              className="bg-[#1e1e1e] border border-white/10 rounded-md px-2 py-1 text-[0.6875rem] text-white [color-scheme:dark] outline-none focus:border-[#f26522]"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActiveQuickRange("Custom");
              }}
            />
            <span className="text-gray-500">—</span>
            <input
              type="date"
              className="bg-[#1e1e1e] border border-white/10 rounded-md px-2 py-1 text-[0.6875rem] text-white [color-scheme:dark] outline-none focus:border-[#f26522]"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActiveQuickRange("Custom");
              }}
            />
          </div>

          {(startDate || endDate || selectedAccountId !== "all" || searchQuery || activeQuickRange !== "All Time") && (
            <button
              onClick={() => {
                resetRange();
                setSelectedAccountId("all");
                setSearchQuery("");
              }}
              className="text-[0.6875rem] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>✕</span> Clear Filters
            </button>
          )}
        </div>
      </section>

      {/* Zerodha Console Summary Statements */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Opening Balance", value: openingBalance, color: "text-white", note: "Balance before selected date range" },
          { label: "Total Credits (Pay-in)", value: totalInflow, color: "text-emerald-500", note: "Total money added or deposited" },
          { label: "Total Debits (Pay-out)", value: totalOutflow, color: "text-rose-500", note: "Total money withdrawn or spent" },
          { label: "Closing Balance", value: closingBalance, color: "text-white", note: "Net balance after selected date range" },
        ].map((s, i) => (
          <div key={i} className="p-5 rounded-xl border border-white/10 bg-[#151515] flex flex-col justify-between min-h-[100px]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{s.label}</p>
              <p className="text-[0.625rem] text-gray-500 font-medium mt-0.5">{s.note}</p>
            </div>
            <p className={`text-xl font-bold tracking-tight ${s.color} mt-2`}>
              {formatMoney(s.value, getLogCurrency(selectedAccountId !== "all" ? selectedAccountId : null))}
            </p>
          </div>
        ))}
      </section>

      <LedgerDataTable
        logs={allFilteredLogs}
        getLogCurrency={getLogCurrency}
        isDebitLog={isDebitLog}
        isCreditLog={isCreditLog}
        getActionBadge={getActionBadge}
        formatMoney={formatMoney}
        onReset={resetRange}
        onRevert={async (logId) => {
          const { revertLedgerTransaction } = await import("./actions");
          const { toast } = await import("react-hot-toast");
          const res = await revertLedgerTransaction(logId);
          if (res.success) {
            toast.success("Transaction reverted successfully");
            mutate();
          } else {
            toast.error(res.error || "Failed to revert transaction");
          }
        }}
      />
    </div>
  );
}
