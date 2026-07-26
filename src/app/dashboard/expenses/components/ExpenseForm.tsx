"use client";

import { useState } from "react";

type Account = {
  id: string;
  name: string;
  currency: string;
  balance: number;
};

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
  accounts: Account[];
  categories: { label: string; icon?: string }[];
  defaultDate: string;
  defaultAccountId?: string;
  editingExpense?: {
    id: string;
    description: string;
    amount: string | number;
    category: string;
    date: string | null;
    account_id: string | null;
  };
}

type FieldErrors = {
  description?: string;
  amount?: string;
  date?: string;
  account_id?: string;
};

export default function ExpenseForm({
  isOpen: _isOpen,
  onClose: _onClose,
  onSubmit,
  submitting,
  accounts,
  categories,
  defaultDate,
  defaultAccountId,
  editingExpense,
}: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    description: editingExpense ? editingExpense.description : "",
    amount: editingExpense ? String(editingExpense.amount) : "",
    category: editingExpense?.category ?? "Food",
    date: editingExpense?.date ?? defaultDate,
    account_id: editingExpense?.account_id ?? defaultAccountId ?? "",
  });

  // #13 — inline field error state
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [prevEditingExpenseId, setPrevEditingExpenseId] = useState<string | undefined>(undefined);
  if (editingExpense?.id !== prevEditingExpenseId) {
    setPrevEditingExpenseId(editingExpense?.id);
    if (editingExpense) {
      setFormData({
        description: editingExpense.description,
        amount: String(editingExpense.amount),
        category: editingExpense.category,
        date: editingExpense.date ?? defaultDate,
        account_id: editingExpense.account_id ?? defaultAccountId ?? "",
      });
    }
  }

  function validate(data: typeof formData): FieldErrors {
    const errs: FieldErrors = {};
    if (!data.description.trim()) errs.description = "Description is required.";
    const amt = parseFloat(data.amount);
    if (!data.amount || isNaN(amt)) errs.amount = "Enter a valid amount.";
    else if (amt <= 0) errs.amount = "Amount must be greater than 0.";
    if (!data.date) errs.date = "Date is required.";
    if (!data.account_id) errs.account_id = "Account is required.";
    return errs;
  }

  function handleBlur(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(formData));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = { description: true, amount: true, date: true, account_id: true };
    setTouched(allTouched);
    const errs = validate(formData);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    await onSubmit({
      ...(editingExpense ? { id: editingExpense.id } : {}),
      ...formData,
      amount: parseFloat(formData.amount),
      account_id: formData.account_id || undefined,
    });

    // reset only when adding (not editing — caller closes drawer)
    if (!editingExpense) {
      setFormData({
        description: "",
        amount: "",
        category: "Food",
        date: defaultDate,
        account_id: defaultAccountId ?? "",
      });
      setErrors({});
      setTouched({});
    }
  };

  const fieldError = (field: keyof FieldErrors) =>
    touched[field] && errors[field] ? (
      <p role="alert" className="text-xs text-rose-400 mt-1">{errors[field]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Group 1: Merchant & Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="expense-description" className="block text-xs font-black uppercase tracking-widest text-[--text-muted]">
            {["Food", "Shopping", "Entertainment"].includes(formData.category) ? "Merchant / Store" : "Description"}
          </label>
          <input
            autoFocus
            type="text"
            required
            id="expense-description"
            name="description"
            className={`w-full h-11 px-4 rounded-xl bg-white/[0.03] border text-sm font-semibold text-white placeholder-[--text-muted] focus:outline-none focus:ring-1 transition-all ${
              touched.description && errors.description 
                ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500" 
                : "border-white/10 hover:border-white/20 focus:border-rose-500 focus:ring-rose-500"
            }`}
            placeholder="e.g. Starbucks, Amazon"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            onBlur={() => handleBlur("description")}
            autoComplete="off"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "err-description" : undefined}
          />
          <span id="err-description">{fieldError("description")}</span>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label htmlFor="expense-amount" className="block text-xs font-black uppercase tracking-widest text-[--text-muted]">Amount</label>
          <div className="relative">
            <input
              type="number"
              required
              id="expense-amount"
              name="amount"
              className={`w-full h-11 px-4 rounded-xl bg-white/[0.03] border text-sm font-bold text-white placeholder-[--text-muted] focus:outline-none focus:ring-1 transition-all ${
                touched.amount && errors.amount 
                  ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500" 
                  : "border-white/10 hover:border-white/20 focus:border-rose-500 focus:ring-rose-500"
              }`}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              onBlur={() => handleBlur("amount")}
              autoComplete="off"
              inputMode="decimal"
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? "err-amount" : undefined}
            />
          </div>
          <span id="err-amount">{fieldError("amount")}</span>
        </div>
      </div>

      {/* Category Chips */}
      <div className="space-y-2">
        <label className="block text-xs font-black uppercase tracking-widest text-[--text-muted]">Category</label>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {categories.map((c) => {
            const isActive = formData.category === c.label;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setFormData({ ...formData, category: c.label })}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  isActive
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-400 font-extrabold shadow-[0_4px_15px_rgba(244,63,94,0.2)] scale-[1.02]"
                    : "bg-white/[0.03] border-white/10 text-[--text-muted] hover:text-white hover:bg-white/10 hover:border-white/20"
                }`}
              >
                {c.icon && <span className="text-sm">{c.icon}</span>}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Group 2: Date & Account */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date */}
        <div className="space-y-1.5">
          <label htmlFor="expense-date" className="block text-xs font-black uppercase tracking-widest text-[--text-muted]">Date</label>
          <input
            type="date"
            required
            id="expense-date"
            name="date"
            className={`w-full h-11 px-4 rounded-xl bg-white/[0.03] border text-sm font-semibold text-white focus:outline-none focus:ring-1 transition-all ${
              touched.date && errors.date 
                ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500" 
                : "border-white/10 hover:border-white/20 focus:border-rose-500 focus:ring-rose-500"
            }`}
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            onBlur={() => handleBlur("date")}
            autoComplete="off"
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? "err-date" : undefined}
          />
          <span id="err-date">{fieldError("date")}</span>
        </div>

        {/* Account */}
        <div className="space-y-1.5">
          <label htmlFor="expense-account" className="block text-xs font-black uppercase tracking-widest text-[--text-muted]">Debit Account</label>
          <select
            id="expense-account"
            name="account_id"
            className={`w-full h-11 px-4 rounded-xl bg-white/[0.03] border text-sm font-semibold text-white focus:outline-none focus:ring-1 transition-all ${
              touched.account_id && errors.account_id 
                ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500" 
                : "border-white/10 hover:border-white/20 focus:border-rose-500 focus:ring-rose-500"
            }`}
            value={formData.account_id}
            onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
            onBlur={() => handleBlur("account_id")}
            aria-label="Select debit account"
            aria-invalid={!!errors.account_id}
            aria-describedby={errors.account_id ? "err-account_id" : undefined}
          >
            <option value="" disabled className="bg-[#12141c] text-white">Select Account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id} className="bg-[#12141c] text-white">
                {acc.name} ({acc.currency === "USD" ? "$" : "₹"}{acc.balance.toLocaleString()})
              </option>
            ))}
          </select>
          <span id="err-account_id">{fieldError("account_id")}</span>
        </div>
      </div>

      {formData.account_id && (() => {
        const sel = accounts.find((a) => a.id === formData.account_id);
        return sel ? (
          <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
            <span className="font-semibold">Selected Account Balance</span>
            <span className="font-black text-rose-400 text-sm">{sel.currency === "USD" ? "$" : "₹"}{sel.balance.toLocaleString()}</span>
          </div>
        ) : null;
      })()}

      <div className="pt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={_onClose}
          className="h-12 px-6 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white hover:bg-white/10 transition-all active:scale-95"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Processing…" : editingExpense ? "Save Changes" : "Confirm Record"}
        </button>
      </div>
    </form>
  );
}
