"use client";

import React from "react";
import type { FinanceData } from "@/hooks/use-finance-data";

interface SectionConfig {
  key: string;
  label: string;
  icon: string;
}

interface DefaultsTabProps {
  defaultAccounts: Record<string, string | null>;
  accounts: FinanceData["accounts"];
  handleDefaultAccountChange: (sectionKey: string, accountId: string) => void;
  sectionsRequiringAccount: SectionConfig[];
}

export default function DefaultsTab({
  defaultAccounts,
  accounts = [],
  handleDefaultAccountChange,
  sectionsRequiringAccount,
}: DefaultsTabProps) {
  return (
    <div className="space-y-6 max-w-5xl animate-fade-in-up">
      {/* Header Info */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>⚙️</span> Default Accounts
        </h2>
        <p className="text-xs text-[--text-secondary]">
          Pre-select the default bank account to auto-fill for each financial section.
        </p>
      </div>

      {/* Clean 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sectionsRequiringAccount.map((section) => {
          const currentVal = defaultAccounts[section.key] || "";
          const selectedAcc = accounts?.find((a) => a.id === currentVal);

          return (
            <div
              key={section.key}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                selectedAcc
                  ? "bg-white/[0.03] border-cyan-500/30"
                  : "bg-white/[0.015] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg select-none">{section.icon}</span>
                  <span className="text-sm font-bold text-white">{section.label}</span>
                </div>
                {selectedAcc && (
                  <span className="text-[0.6875rem] font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    {selectedAcc.currency} {Number(selectedAcc.balance).toLocaleString()}
                  </span>
                )}
              </div>

              <select
                aria-label={`Default account for ${section.label}`}
                value={currentVal}
                onChange={(e) => handleDefaultAccountChange(section.key, e.target.value)}
                className="w-full bg-[#1a1d28] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="">None (Select First Available)</option>
                {accounts?.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency} {Number(acc.balance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
