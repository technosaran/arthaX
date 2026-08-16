"use client";

import React, { useState } from "react";
import { useFinanceData, invalidateFinanceData } from "@/hooks/use-finance-data";
import { EmptyState } from "@/components/empty-state";
import { Plus, ShieldCheck } from "lucide-react";
import { PolicyModal } from "./components/policy-modal";

export default function InsuranceClient() {
  const { data: { insurancePolicies = [], profile } = {}, isLoading } = useFinanceData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (isLoading) return null;

  const totalCoverage = insurancePolicies.reduce((acc, p) => acc + Number(p.coverage_amount || 0), 0);
  const totalPremium = insurancePolicies.reduce((acc, p) => acc + Number(p.premium_amount || 0), 0);

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Insurance & Policy Tracker
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage your life, health, auto, and property coverage.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Policy
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <p className="text-slate-400 text-sm font-medium">Total Coverage</p>
          <p className="text-3xl font-bold text-white mt-2">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: profile?.base_currency || 'USD' }).format(totalCoverage)}
          </p>
        </div>
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <p className="text-slate-400 text-sm font-medium">Total Premiums (Annually)</p>
          <p className="text-3xl font-bold text-white mt-2">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: profile?.base_currency || 'USD' }).format(totalPremium)}
          </p>
        </div>
      </div>

      {insurancePolicies.length === 0 ? (
        <EmptyState
          title="No Active Policies"
          description="Add your first insurance policy to start tracking your coverage."
          icon="🛡️"
          action={
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              Add First Policy
            </button>
          }
        />
      ) : (
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Provider & Policy</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Coverage</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Premium</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Next Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {insurancePolicies.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-6">
                      <p className="text-sm font-bold text-white">{p.provider}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.policy_name} {p.policy_number && `(#${p.policy_number})`}</p>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-300 capitalize">{p.type}</td>
                    <td className="py-4 px-6 text-sm font-medium text-white text-right">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: profile?.base_currency || 'USD' }).format(Number(p.coverage_amount))}
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-300 text-right">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: profile?.base_currency || 'USD' }).format(Number(p.premium_amount))}
                      <span className="text-[10px] text-slate-500 block uppercase">{p.premium_frequency}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-400 flex items-center justify-between">
                      {p.next_due_date ? new Date(p.next_due_date).toLocaleDateString() : 'N/A'}
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this policy?')) {
                            const { deleteInsurancePolicy } = await import('./actions');
                            await deleteInsurancePolicy(p.id);
                            invalidateFinanceData("insurance");
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Delete Policy"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <PolicyModal 
          onClose={() => setIsAddModalOpen(false)} 
          baseCurrency={profile?.base_currency} 
        />
      )}
    </div>
  );
}
