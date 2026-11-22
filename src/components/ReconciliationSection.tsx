"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  FileText,
  ShieldCheck,
  Building2,
  Copy,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/context/ToastContext";

interface ReconciliationData {
  health_score: number;
  summary: {
    total_accounts: number;
    reconciled_accounts: number;
    total_statements: number;
    reconciled_statements: number;
    discrepant_statements: number;
    detected_duplicates_count: number;
    detected_reversals_count: number;
  };
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    last_four: string | null;
    current_balance: number;
    latest_statement_date: string | null;
    latest_statement_closing_balance: number | null;
    discrepancy_amount: number;
    status: "RECONCILED" | "DISCREPANCY" | "NO_STATEMENTS";
  }>;
  statements: Array<{
    id: string;
    account_id: string | null;
    bank_name: string;
    file_name: string;
    period_start: string;
    period_end: string;
    opening_balance: number;
    closing_balance: number;
    total_credits: number;
    total_debits: number;
    transaction_count: number;
    expected_closing_balance: number;
    discrepancy_amount: number;
    reconciliation_status: string;
    reconciliation_error: string | null;
  }>;
  duplicates: Array<{
    transaction_a_id: string;
    transaction_b_id: string;
    date: string;
    amount: number;
    narration: string;
    reason: string;
  }>;
  reversals: Array<{
    original_id: string;
    reversal_id: string;
    amount: number;
    date: string;
    narration: string;
  }>;
}

export default function ReconciliationSection() {
  const { showToast } = useToast();
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"accounts" | "statements" | "duplicates" | "reversals">("accounts");

  const fetchReconciliation = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/reconciliation/dashboard");
      if (!res.ok) throw new Error("Failed to load reconciliation data");
      const json = await res.json();
      setData(json.data || json);
    } catch (err: unknown) {
      showToast("Could not load reconciliation dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  const handleTriggerReconcile = async () => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/v1/reconciliation/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TRIGGER_TRANSFER_RECONCILIATION" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to trigger reconciliation");
      showToast(json.data?.message || "Reconciliation completed", "success");
      fetchReconciliation();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error reconciling", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgeStatement = async (statementId: string) => {
    try {
      const res = await fetch("/api/v1/reconciliation/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ACKNOWLEDGE_STATEMENT_DISCREPANCY",
          statement_id: statementId,
          notes: "Acknowledged via Reconciliation Dashboard",
        }),
      });
      if (!res.ok) throw new Error("Failed to acknowledge");
      showToast("Statement marked as acknowledged", "success");
      fetchReconciliation();
    } catch (err: unknown) {
      showToast("Error acknowledging statement", "error");
    }
  };

  return (
    <main
      className="flex-1 h-full p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 sm:space-y-8"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <PageHeader
        title="Financial Reconciliation"
        description="Verify accounting balance invariants, double-entry integrity, statement math, and detect suspicious duplicates."
        icon={<ShieldCheck size={20} className="text-emerald-400" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReconciliation}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerReconcile}
              disabled={actionLoading}
              className="gap-2"
            >
              <ArrowRightLeft size={14} className={actionLoading ? "animate-spin" : ""} />
              Match Internal Transfers
            </Button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Reconciliation Score"
          value={`${data?.health_score ?? 100}%`}
          subtitle={data?.health_score && data.health_score < 90 ? "Discrepancies Detected" : "Accounting Invariants Verified"}
          icon={<ShieldCheck size={18} />}
          trend={{ direction: data?.health_score && data.health_score >= 95 ? "up" : "down" }}
        />
        <StatCard
          title="Account Invariants"
          value={`${data?.summary.reconciled_accounts ?? 0} / ${data?.summary.total_accounts ?? 0}`}
          subtitle="Balances match verified statements"
          icon={<Building2 size={18} />}
        />
        <StatCard
          title="Statement Invariants"
          value={`${data?.summary.reconciled_statements ?? 0} / ${data?.summary.total_statements ?? 0}`}
          subtitle="Opening + Cr - Dr = Closing validated"
          icon={<FileText size={18} />}
        />
        <StatCard
          title="Suspected Duplicates"
          value={String(data?.summary.detected_duplicates_count ?? 0)}
          subtitle={data?.summary.detected_reversals_count ? `${data.summary.detected_reversals_count} reversals tracked` : "Zero duplicate writes detected"}
          icon={<Copy size={18} />}
          trend={{ direction: data?.summary.detected_duplicates_count ? "down" : "up" }}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "accounts"
              ? "bg-[var(--app-card-bg)] text-[var(--app-fg)] border border-[var(--app-border)]"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          Account Audit ({data?.accounts.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("statements")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "statements"
              ? "bg-[var(--app-card-bg)] text-[var(--app-fg)] border border-[var(--app-border)]"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          Bank Statements ({data?.statements.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("duplicates")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "duplicates"
              ? "bg-[var(--app-card-bg)] text-[var(--app-fg)] border border-[var(--app-border)]"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          Duplicates ({data?.duplicates.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("reversals")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "reversals"
              ? "bg-[var(--app-card-bg)] text-[var(--app-fg)] border border-[var(--app-border)]"
              : "text-[var(--app-muted)] hover:text-[var(--app-fg)]"
          }`}
        >
          Reversals ({data?.reversals.length ?? 0})
        </button>
      </div>

      {/* TAB 1: ACCOUNTS */}
      {activeTab === "accounts" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-[var(--app-border)] flex items-center justify-between">
            <h3 className="font-semibold text-sm">Account Balance Reconciliation</h3>
            <span className="text-xs text-[var(--app-muted)]">Verified against latest ingested statement closing balance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--app-bg)] border-b border-[var(--app-border)] text-[var(--app-muted)] text-xs uppercase">
                <tr>
                  <th className="p-3 pl-4">Account Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Ledger Balance</th>
                  <th className="p-3">Statement Closing</th>
                  <th className="p-3">Last Verified Period</th>
                  <th className="p-3 text-right pr-4">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {(data?.accounts || []).map((acc) => (
                  <tr key={acc.id} className="hover:bg-[var(--app-card-hover)] transition-colors">
                    <td className="p-3 pl-4 font-medium flex items-center gap-2">
                      <Building2 size={16} className="text-[var(--app-muted)]" />
                      <span>{acc.name}</span>
                      {acc.last_four && <span className="text-xs text-[var(--app-muted)]">••••{acc.last_four}</span>}
                    </td>
                    <td className="p-3 text-xs text-[var(--app-muted)]">{acc.type}</td>
                    <td className="p-3 font-semibold">₹{acc.current_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-sm">
                      {acc.latest_statement_closing_balance !== null
                        ? `₹${acc.latest_statement_closing_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="p-3 text-xs text-[var(--app-muted)]">{acc.latest_statement_date || "No Statements"}</td>
                    <td className="p-3 text-right pr-4">
                      {acc.status === "RECONCILED" ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 size={12} />
                          Reconciled
                        </Badge>
                      ) : acc.status === "DISCREPANCY" ? (
                        <Badge variant="danger" className="gap-1">
                          <AlertTriangle size={12} />
                          Diff: ₹{acc.discrepancy_amount}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Unverified</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: STATEMENTS */}
      {activeTab === "statements" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-[var(--app-border)] flex items-center justify-between">
            <h3 className="font-semibold text-sm">Bank Statement Invariant Validation</h3>
            <span className="text-xs text-[var(--app-muted)]">Rule: Opening Balance + Total Credits − Total Debits = Closing Balance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--app-bg)] border-b border-[var(--app-border)] text-[var(--app-muted)] text-xs uppercase">
                <tr>
                  <th className="p-3 pl-4">Bank / Source</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Opening</th>
                  <th className="p-3 text-emerald-600">Credits</th>
                  <th className="p-3 text-rose-600">Debits</th>
                  <th className="p-3">Expected Closing</th>
                  <th className="p-3">Reported Closing</th>
                  <th className="p-3 text-right pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {(data?.statements || []).map((stmt) => (
                  <tr key={stmt.id} className="hover:bg-[var(--app-card-hover)] transition-colors">
                    <td className="p-3 pl-4 font-medium">
                      <div className="text-sm">{stmt.bank_name}</div>
                      <div className="text-xs text-[var(--app-muted)] truncate max-w-xs">{stmt.file_name}</div>
                    </td>
                    <td className="p-3 text-xs text-[var(--app-muted)] whitespace-nowrap">
                      {stmt.period_start} to {stmt.period_end}
                    </td>
                    <td className="p-3">₹{stmt.opening_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-emerald-600 font-medium">+₹{stmt.total_credits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-rose-600 font-medium">-₹{stmt.total_debits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 font-medium">₹{stmt.expected_closing_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 font-semibold">₹{stmt.closing_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right pr-4">
                      {stmt.reconciliation_status === "RECONCILED" ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 size={12} />
                          Reconciled
                        </Badge>
                      ) : stmt.reconciliation_status === "ACKNOWLEDGED" ? (
                        <Badge variant="neutral">Acknowledged</Badge>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant="danger" className="gap-1">
                            <AlertTriangle size={12} />
                            Diff: ₹{stmt.discrepancy_amount}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledgeStatement(stmt.id)}
                            className="text-xs py-0.5 px-2"
                          >
                            Acknowledge
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: DUPLICATES */}
      {activeTab === "duplicates" && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
            <h3 className="font-semibold text-sm">Suspected Duplicate Transactions</h3>
            <span className="text-xs text-[var(--app-muted)]">Matched on Date, Amount, Direction & Narration fingerprint</span>
          </div>

          {(data?.duplicates || []).length === 0 ? (
            <EmptyState
              title="No duplicate transactions detected"
              description="Your ledger and canonical transactions are cleanly deduplicated."
              icon={<CheckCircle2 size={32} className="text-emerald-500" />}
            />
          ) : (
            <div className="space-y-3">
              {(data?.duplicates || []).map((dup, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Copy size={14} className="text-amber-500" />
                      <span>{dup.narration}</span>
                    </div>
                    <div className="text-xs text-[var(--app-muted)]">
                      Date: {dup.date} • Reason: {dup.reason}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">₹{dup.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                    <Badge variant="warning" className="text-xs">Flagged</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: REVERSALS */}
      {activeTab === "reversals" && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
            <h3 className="font-semibold text-sm">Tracked Refunds & Payment Reversals</h3>
            <span className="text-xs text-[var(--app-muted)]">Matched debit/credit reversal pairs</span>
          </div>

          {(data?.reversals || []).length === 0 ? (
            <EmptyState
              title="No payment reversals tracked"
              description="Failed transactions or merchant refunds will appear here once identified."
              icon={<RotateCcw size={32} className="text-amber-500" />}
            />
          ) : (
            <div className="space-y-3">
              {(data?.reversals || []).map((rev, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <RotateCcw size={14} className="text-emerald-500" />
                      <span>{rev.narration}</span>
                    </div>
                    <div className="text-xs text-[var(--app-muted)]">Date: {rev.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm text-emerald-600">+₹{rev.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                    <Badge variant="success" className="text-xs">Neutralized</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
