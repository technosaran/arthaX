"use client";

import React, { useState } from "react";
import { X, ShieldCheck, Calendar, DollarSign, Building } from "lucide-react";
import { addInsurancePolicy } from "../actions";
import { invalidateFinanceData } from "@/hooks/use-finance-data";

interface PolicyModalProps {
  onClose: () => void;
  baseCurrency?: string;
}

export function PolicyModal({ onClose, baseCurrency = "USD" }: PolicyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    provider: "",
    policy_name: "",
    policy_number: "",
    type: "life",
    coverage_amount: "",
    premium_amount: "",
    premium_frequency: "annual",
    next_due_date: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!formData.provider || !formData.policy_name || !formData.coverage_amount || !formData.premium_amount) {
        throw new Error("Please fill in all required fields");
      }

      const res = await addInsurancePolicy({
        provider: formData.provider,
        policy_name: formData.policy_name,
        policy_number: formData.policy_number || undefined,
        type: formData.type,
        coverage_amount: Number(formData.coverage_amount),
        premium_amount: Number(formData.premium_amount),
        premium_frequency: formData.premium_frequency,
        next_due_date: formData.next_due_date || null,
      });

      if (res.error) throw new Error(res.error);

      // Refresh SWR cache
      await invalidateFinanceData("insurance");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Add Insurance Policy
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              {error}
            </div>
          )}

          <form id="policy-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Provider *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    name="provider"
                    required
                    value={formData.provider}
                    onChange={handleChange}
                    placeholder="e.g. LIC, HDFC Ergo"
                    className="w-full pl-9 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Policy Name *</label>
                <input
                  type="text"
                  name="policy_name"
                  required
                  value={formData.policy_name}
                  onChange={handleChange}
                  placeholder="e.g. Term Life Plan"
                  className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Policy Number</label>
                <input
                  type="text"
                  name="policy_number"
                  value={formData.policy_number}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Type *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-[#0b0f19] border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all appearance-none"
                >
                  <option value="life">Life Insurance</option>
                  <option value="health">Health Insurance</option>
                  <option value="auto">Auto / Motor</option>
                  <option value="property">Property / Home</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Coverage Amount *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-medium text-sm">{baseCurrency === 'INR' ? '₹' : '$'}</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    name="coverage_amount"
                    required
                    value={formData.coverage_amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Premium Amount *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    name="premium_amount"
                    required
                    value={formData.premium_amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Premium Frequency *</label>
                <select
                  name="premium_frequency"
                  value={formData.premium_frequency}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-[#0b0f19] border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all appearance-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annually</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 ml-1">Next Due Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="date"
                    name="next_due_date"
                    value={formData.next_due_date}
                    onChange={handleChange}
                    className="w-full pl-9 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            form="policy-form"
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              "Save Policy"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
