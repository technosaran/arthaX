"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Minus,
  SlidersHorizontal,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import BankLogo from "@/components/BankLogo";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

export interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  last_four?: string;
  classification?: "asset" | "liability";
}

export interface AccountAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountItem | null;
  initialMode?: "deposit" | "withdraw" | "adjust";
  accounts: AccountItem[];
  onSuccess: () => Promise<void>;
  formatINR: (val: number) => string;
}

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Dividends",
  "Interest",
  "Bonus",
  "Gift & Pocket Money",
  "Cash Deposit",
  "Other",
];

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Groceries",
  "Bills & Utilities",
  "Transportation",
  "Entertainment",
  "Health & Medical",
  "Rent & Housing",
  "General Expense",
];

export default function AccountAdjustModal({
  isOpen,
  onClose,
  account,
  initialMode = "deposit",
  accounts,
  onSuccess,
  formatINR,
}: AccountAdjustModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Active top-level tab: deposit (+) | withdraw (-) | adjust (exact/calibrate)
  const [mode, setMode] = useState<"deposit" | "withdraw" | "adjust">(initialMode);

  // Sub-modes
  const [depositType, setDepositType] = useState<"transfer" | "income" | "direct">("transfer");
  const [withdrawType, setWithdrawType] = useState<"transfer" | "expense" | "direct">("transfer");
  const [adjustType, setAdjustType] = useState<"add" | "subtract" | "set">("add");

  // Form Fields
  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [category, setCategory] = useState("Cash Deposit");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [exactBalanceInput, setExactBalanceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync initial state when modal opens or target account changes
  useEffect(() => {
    if (!isOpen || !account) return;

    setMode(initialMode);
    setAmount("");
    setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
    setExactBalanceInput(account.balance.toString());

    const isTargetCash =
      account.type === "Liquid Cash" || account.name.toLowerCase().includes("cash");

    // Smart default source/destination for transfers
    const cashAcc = accounts.find(
      (a) => a.type === "Liquid Cash" || a.name.toLowerCase().includes("cash")
    );
    const firstOther = accounts.find((a) => a.id !== account.id);

    if (initialMode === "deposit") {
      // If depositing into bank, default source is Cash in Hand (if available and different)
      if (!isTargetCash && cashAcc && cashAcc.id !== account.id) {
        setFromAccountId(cashAcc.id);
      } else if (firstOther) {
        setFromAccountId(firstOther.id);
      } else {
        setFromAccountId("");
      }
      setToAccountId(account.id);
      setTitle(`Deposit to ${account.name}`);
      setCategory("Cash Deposit");
    } else if (initialMode === "withdraw") {
      setFromAccountId(account.id);
      // If withdrawing from bank, default destination is Cash in Hand
      if (!isTargetCash && cashAcc && cashAcc.id !== account.id) {
        setToAccountId(cashAcc.id);
      } else if (firstOther) {
        setToAccountId(firstOther.id);
      } else {
        setToAccountId("");
      }
      setTitle(`Withdrawal from ${account.name}`);
      setCategory("General Expense");
    } else {
      setExactBalanceInput(account.balance.toString());
      setAdjustType("add");
    }
  }, [isOpen, account, initialMode, accounts]);

  if (!isOpen || !account) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const isTargetCash =
    account.type === "Liquid Cash" || account.name.toLowerCase().includes("cash");

  // Helpers for calculations
  const sourceAccount = accounts.find((a) => a.id === fromAccountId);
  const destAccount = accounts.find((a) => a.id === toAccountId);

  // Quick preset chips helper
  const handlePreset = (val: number) => {
    setAmount(val.toString());
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    const supabase = createClient();

    try {
      if (mode === "deposit") {
        if (depositType === "transfer") {
          // 1. Account Transfer / Cash Deposit
          if (!fromAccountId || !toAccountId) {
            showToast("Missing Account", "Please select source and destination accounts.", "warning");
            setSubmitting(false);
            return;
          }
          if (fromAccountId === toAccountId) {
            showToast("Invalid Transfer", "Source and destination accounts must be distinct.", "warning");
            setSubmitting(false);
            return;
          }
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount greater than zero.", "warning");
            setSubmitting(false);
            return;
          }

          const { error } = await supabase.rpc("fn_record_transfer_atomic", {
            p_user_id: user.id,
            p_from_account_id: fromAccountId,
            p_to_account_id: toAccountId,
            p_amount: parsedAmount,
            p_transfer_date: date,
            p_notes: notes.trim() || `Cash deposit into ${account.name}`,
          });

          if (error) throw error;

          showToast(
            "Deposit Successful",
            `Deposited ${formatINR(parsedAmount)} from ${sourceAccount?.name || "source"} to ${destAccount?.name || account.name}.`,
            "success"
          );
        } else if (depositType === "income") {
          // 2. External Income Deposit
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount greater than zero.", "warning");
            setSubmitting(false);
            return;
          }

          const { error } = await supabase.rpc("fn_record_income_atomic", {
            p_user_id: user.id,
            p_title: title.trim() || `Deposit to ${account.name}`,
            p_amount: parsedAmount,
            p_category: category,
            p_frequency: "One-Time",
            p_account_id: account.id,
            p_received_date: date,
            p_notes: notes.trim() || null,
            p_tags: ["deposit", "adjustment"],
          });

          if (error) throw error;

          showToast(
            "Income Logged & Credited",
            `Added ${formatINR(parsedAmount)} to ${account.name} as ${category}.`,
            "success"
          );
        } else {
          // 3. Direct Balance Increase
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount greater than zero.", "warning");
            setSubmitting(false);
            return;
          }
          const newBalance = Number((account.balance + parsedAmount).toFixed(2));
          const { error } = await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", account.id)
            .eq("user_id", user.id);

          if (error) throw error;

          showToast(
            "Balance Increased",
            `${account.name} balance updated to ${formatINR(newBalance)}.`,
            "success"
          );
        }
      } else if (mode === "withdraw") {
        if (withdrawType === "transfer") {
          // 1. ATM Cash Withdrawal / Transfer to another account
          if (!fromAccountId || !toAccountId) {
            showToast("Missing Account", "Please select source and destination accounts.", "warning");
            setSubmitting(false);
            return;
          }
          if (fromAccountId === toAccountId) {
            showToast("Invalid Transfer", "Source and destination accounts must be distinct.", "warning");
            setSubmitting(false);
            return;
          }
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount greater than zero.", "warning");
            setSubmitting(false);
            return;
          }

          const { error } = await supabase.rpc("fn_record_transfer_atomic", {
            p_user_id: user.id,
            p_from_account_id: fromAccountId,
            p_to_account_id: toAccountId,
            p_amount: parsedAmount,
            p_transfer_date: date,
            p_notes: notes.trim() || `Withdrawal from ${account.name}`,
          });

          if (error) throw error;

          showToast(
            "Withdrawal Successful",
            `Withdrew ${formatINR(parsedAmount)} from ${account.name} into ${destAccount?.name || "destination"}.`,
            "success"
          );
        } else if (withdrawType === "expense") {
          // 2. Record as Expense
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount greater than zero.", "warning");
            setSubmitting(false);
            return;
          }

          const { error } = await supabase.rpc("fn_record_expense_atomic", {
            p_user_id: user.id,
            p_title: title.trim() || `Expense from ${account.name}`,
            p_amount: parsedAmount,
            p_category: category,
            p_account_id: account.id,
            p_expense_date: date,
            p_notes: notes.trim() || null,
            p_tags: ["withdrawal", "adjustment"],
          });

          if (error) throw error;

          showToast(
            "Expense Recorded",
            `Deducted ${formatINR(parsedAmount)} from ${account.name} for ${title || category}.`,
            "success"
          );
        } else {
          // 3. Direct Balance Decrease
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount greater than zero.", "warning");
            setSubmitting(false);
            return;
          }
          const newBalance = Math.max(0, Number((account.balance - parsedAmount).toFixed(2)));
          const { error } = await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("id", account.id)
            .eq("user_id", user.id);

          if (error) throw error;

          showToast(
            "Balance Deducted",
            `${account.name} balance updated to ${formatINR(newBalance)}.`,
            "success"
          );
        }
      } else {
        // Direct Adjust / Calibrate
        let newBalance = account.balance;
        if (adjustType === "add") {
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount to add.", "warning");
            setSubmitting(false);
            return;
          }
          newBalance = Number((account.balance + parsedAmount).toFixed(2));
        } else if (adjustType === "subtract") {
          if (parsedAmount <= 0) {
            showToast("Invalid Amount", "Please enter an amount to deduct.", "warning");
            setSubmitting(false);
            return;
          }
          newBalance = Math.max(0, Number((account.balance - parsedAmount).toFixed(2)));
        } else {
          const parsedExact = parseFloat(exactBalanceInput);
          if (isNaN(parsedExact) || parsedExact < 0) {
            showToast("Invalid Balance", "Please enter a valid positive balance number.", "warning");
            setSubmitting(false);
            return;
          }
          newBalance = Number(parsedExact.toFixed(2));
        }

        const { error } = await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", account.id)
          .eq("user_id", user.id);

        if (error) throw error;

        showToast(
          "Balance Calibrated",
          `${account.name} balance updated to ${formatINR(newBalance)}.`,
          "success"
        );
      }

      await onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      showToast("Operation Failed", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--app-card-subtle)] border border-[var(--app-border)] p-1 flex items-center justify-center flex-shrink-0">
            <BankLogo name={account.name} size={22} />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--app-fg)] flex items-center gap-1.5">
              <span>Adjust & Manage</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">({account.name})</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--app-muted)]">
              Current Balance: <span className="font-bold text-[var(--app-fg)]">{formatINR(account.balance)}</span>
            </div>
          </div>
        </div>
      }
      size="md"
    >
      <div className="space-y-2.5">
        {/* Top-Level Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--app-card-subtle)] border border-[var(--app-border)]">
          <button
            type="button"
            onClick={() => {
              setMode("deposit");
              setToAccountId(account.id);
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === "deposit"
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            <Plus size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Deposit (+)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("withdraw");
              setFromAccountId(account.id);
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === "withdraw"
                ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/35 shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            <Minus size={13} className="text-rose-600 dark:text-rose-400" />
            <span>Withdraw (-)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("adjust")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === "adjust"
                ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/35 shadow-xs"
                : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
            }`}
          >
            <SlidersHorizontal size={13} className="text-sky-600 dark:text-sky-400" />
            <span>Calibrate</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* ========================================================= */}
          {/* 1. DEPOSIT MODE (+) */}
          {/* ========================================================= */}
          {mode === "deposit" && (
            <div className="space-y-2">
              {/* Sub-selector for deposit source */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--app-card)] border border-[var(--app-border-subtle)] text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setDepositType("transfer")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    depositType === "transfer"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  Transfer In
                </button>
                <button
                  type="button"
                  onClick={() => setDepositType("income")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    depositType === "income"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  External Income
                </button>
                <button
                  type="button"
                  onClick={() => setDepositType("direct")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    depositType === "direct"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  Direct Adjust
                </button>
              </div>

              {/* DEPOSIT: TRANSFER FROM ANOTHER ACCOUNT */}
              {depositType === "transfer" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    label="Deposit Source (From)"
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select source account
                    </option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === account.id}>
                        {acc.name} ({formatINR(acc.balance)})
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* DEPOSIT: EXTERNAL INCOME */}
              {depositType === "income" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    label="Source Title"
                    placeholder="e.g. Salary, Client"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />

                  <Select
                    label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    options={INCOME_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />

                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Common Amount Field & Quick Chips */}
              <div className="space-y-1">
                <Input
                  label="Deposit Amount (₹ INR) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  leftIcon={<span className="font-mono text-xs font-bold text-emerald-400">₹</span>}
                />

                {/* Quick preset chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-[var(--app-muted)] font-mono">Quick:</span>
                  {[500, 1000, 2000, 5000, 10000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handlePreset(val)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--app-card-subtle)] hover:bg-emerald-500/20 text-[var(--app-fg)] hover:text-emerald-300 border border-[var(--app-border-subtle)] hover:border-emerald-500/30 transition-all cursor-pointer"
                    >
                      +{formatINR(val)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. WITHDRAW MODE (-) */}
          {/* ========================================================= */}
          {mode === "withdraw" && (
            <div className="space-y-2">
              {/* Sub-selector for withdraw action */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--app-card)] border border-[var(--app-border-subtle)] text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setWithdrawType("transfer")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    withdrawType === "transfer"
                      ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  Transfer Out
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawType("expense")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    withdrawType === "expense"
                      ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  Record Expense
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawType("direct")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    withdrawType === "direct"
                      ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  Direct Adjust
                </button>
              </div>

              {/* WITHDRAW: TRANSFER TO DESTINATION */}
              {withdrawType === "transfer" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    label="Destination (To)"
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select destination account
                    </option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === account.id}>
                        {acc.name} ({formatINR(acc.balance)})
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* WITHDRAW: RECORD AS EXPENSE */}
              {withdrawType === "expense" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    label="Merchant / Title"
                    placeholder="e.g. Grocery, Dining"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />

                  <Select
                    label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />

                  <Input
                    label="Date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Common Amount Field & Quick Chips */}
              <div className="space-y-1">
                <Input
                  label="Withdrawal Amount (₹ INR) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  leftIcon={<span className="font-mono text-xs font-bold text-rose-400">₹</span>}
                />

                {/* Quick preset chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-[var(--app-muted)] font-mono">Quick:</span>
                  {[500, 1000, 2000, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handlePreset(val)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--app-card-subtle)] hover:bg-rose-500/20 text-[var(--app-fg)] hover:text-rose-300 border border-[var(--app-border-subtle)] hover:border-rose-500/30 transition-all cursor-pointer"
                    >
                      -{formatINR(val)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. CALIBRATE / DIRECT ADJUST MODE */}
          {/* ========================================================= */}
          {mode === "adjust" && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--app-card)] border border-[var(--app-border-subtle)] text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setAdjustType("add")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    adjustType === "add"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("subtract")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    adjustType === "subtract"
                      ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  - Deduct
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("set")}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    adjustType === "set"
                      ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30"
                      : "text-[var(--app-muted)] hover:text-white"
                  }`}
                >
                  Set Exact
                </button>
              </div>

              {adjustType === "set" ? (
                <div className="space-y-1.5">
                  <Input
                    label="Exact Card Balance (₹ INR) *"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={exactBalanceInput}
                    onChange={(e) => setExactBalanceInput(e.target.value)}
                    required
                    autoFocus
                    leftIcon={<span className="font-mono text-xs font-bold text-sky-400">₹</span>}
                  />
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs flex items-center justify-between">
                    <span className="text-[var(--app-muted)]">Current: {formatINR(account.balance)}</span>
                    <span className="text-sky-300 font-bold">
                      Difference:{" "}
                      {(parseFloat(exactBalanceInput) || 0) >= account.balance ? "+" : ""}
                      {formatINR((parseFloat(exactBalanceInput) || 0) - account.balance)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    label={`Amount to ${adjustType === "add" ? "Add (+)" : "Deduct (-)"} (₹ INR) *`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                    leftIcon={
                      <span
                        className={`font-mono text-xs font-bold ${
                          adjustType === "add" ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        ₹
                      </span>
                    }
                  />

                  {/* Quick Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-[var(--app-muted)] font-mono">Quick:</span>
                    {[100, 500, 1000, 2000, 5000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePreset(val)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--app-card-subtle)] hover:bg-sky-500/20 text-[var(--app-fg)] hover:text-sky-300 border border-[var(--app-border-subtle)] hover:border-sky-500/30 transition-all cursor-pointer"
                      >
                        {adjustType === "add" ? "+" : "-"}
                        {formatINR(val)}
                      </button>
                    ))}
                  </div>

                  {parsedAmount > 0 && (
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs flex items-center justify-between">
                      <span className="text-[var(--app-muted)]">Current: {formatINR(account.balance)}</span>
                      <span
                        className={`font-bold ${adjustType === "add" ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        New:{" "}
                        {formatINR(
                          adjustType === "add"
                            ? account.balance + parsedAmount
                            : Math.max(0, account.balance - parsedAmount)
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--app-border-subtle)]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              icon={
                mode === "deposit" ? (
                  <Plus size={14} />
                ) : mode === "withdraw" ? (
                  <Minus size={14} />
                ) : (
                  <SlidersHorizontal size={14} />
                )
              }
              className={
                mode === "deposit"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : mode === "withdraw"
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-sky-600 hover:bg-sky-500"
              }
            >
              {mode === "deposit"
                ? depositType === "transfer"
                  ? "Transfer In"
                  : depositType === "income"
                  ? "Record Income"
                  : "Update Balance"
                : mode === "withdraw"
                ? withdrawType === "transfer"
                  ? "Transfer Out"
                  : withdrawType === "expense"
                  ? "Record Expense"
                  : "Update Balance"
                : "Update Balance"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
