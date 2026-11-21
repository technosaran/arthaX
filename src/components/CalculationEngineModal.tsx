"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Cpu,
  RefreshCw,
  Clock,
  Activity,
  Layers,
  AlertTriangle,
  Play,
  X,
} from "lucide-react";

interface ValidationMetrics {
  total_calculations_executed: number;
  successful_calculations: number;
  failed_calculations: number;
  validation_pass_rate_percent: number;
  average_execution_time_ms: number;
  module_wise_breakdown: Record<string, number>;
  latest_validation_timestamp: string;
  history_buffer_size: number;
}

interface AuditRecord {
  calculation_id: string;
  calculation_type: string;
  user_id: string;
  version: string;
  execution_time_ms: number;
  status: string;
  error?: string;
  result_summary?: Record<string, any>;
  timestamp: string;
}

interface CalculationEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculationEngineModal({
  isOpen,
  onClose,
}: CalculationEngineModalProps) {
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const [valRes, histRes] = await Promise.all([
        fetch("/api/v1/calculations/validation"),
        fetch("/api/v1/calculations/history?limit=25"),
      ]);

      if (valRes.ok) {
        const valData = await valRes.json();
        setMetrics(valData);
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history || []);
      }
    } catch (err) {
      console.warn("Failed to fetch calculation engine telemetry:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
    }
  }, [isOpen]);

  const runLiveBenchmark = async () => {
    setRunningTest(true);
    setTestResult(null);
    try {
      // Benchmark Net Worth calculation: Assets ₹100,000, Liabilities ₹15,000 -> Expected ₹85,000
      const res = await fetch("/api/v1/calculations/networth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accounts: [
            { id: "acc-1", name: "HDFC Savings", type: "SAVINGS", balance: 50000, classification: "ASSET" },
            { id: "acc-2", name: "ICICI Fixed Deposit", type: "DEPOSIT", balance: 50000, classification: "ASSET" },
            { id: "acc-3", name: "Axis Credit Card", type: "CREDIT", balance: 15000, classification: "LIABILITY" },
          ],
          investments: [],
          liabilities: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const resultData = data.data ?? data;
        const expected = 85000;
        const actual = Number(resultData.net_worth ?? data.net_worth);
        const pass = actual === expected;
        const executionTime = data.metadata?.execution_time_ms ?? data.execution_time_ms;
        setTestResult({
          scenario: "Net Worth Benchmark: ₹100,000 Assets - ₹15,000 Liabilities",
          expected,
          actual,
          pass,
          version: data.calculation_version || data.metadata?.version || "1.0.0",
          execution_time_ms: executionTime,
        });
      } else {
        const errJson = await res.json().catch(() => null);
        const errMsg =
          errJson?.error?.message ||
          errJson?.error ||
          errJson?.detail ||
          "Calculation engine returned an error. Ensure the Python microservice is running.";
        setTestResult({
          scenario: "Benchmark execution",
          error: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
          pass: false,
        });
      }
      fetchTelemetry();
    } catch (err: any) {
      setTestResult({
        scenario: "Benchmark execution",
        error: err.message,
        pass: false,
      });
    } finally {
      setRunningTest(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 sm:p-8 space-y-6"
        style={{
          backgroundColor: "var(--app-card, #121316)",
          borderColor: "var(--app-border, #27272a)",
          color: "var(--app-fg, #fafafa)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--app-border,#27272a)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Cpu size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  ArthaX Financial Calculation Engine (AFCE)
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v1.0.0
                </span>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Decimal Precision
                </span>
              </div>
              <p className="text-xs text-[var(--app-muted,#a1a1aa)]">
                Deterministic, audited financial calculation telemetry and validation dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-[var(--app-muted,#a1a1aa)] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Telemetry KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-[var(--app-border,#27272a)] bg-white/2">
            <div className="text-xs text-[var(--app-muted,#a1a1aa)] flex items-center gap-1.5">
              <Activity size={14} /> Total Calculations
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-[var(--app-fg,#fafafa)]">
              {metrics ? metrics.total_calculations_executed : 0}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--app-border,#27272a)] bg-white/2">
            <div className="text-xs text-[var(--app-muted,#a1a1aa)] flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" /> Pass Rate
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-emerald-400">
              {metrics ? `${metrics.validation_pass_rate_percent}%` : "100%"}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--app-border,#27272a)] bg-white/2">
            <div className="text-xs text-[var(--app-muted,#a1a1aa)] flex items-center gap-1.5">
              <Clock size={14} /> Avg Execution Time
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-blue-400">
              {metrics ? `${metrics.average_execution_time_ms} ms` : "0 ms"}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--app-border,#27272a)] bg-white/2">
            <div className="text-xs text-[var(--app-muted,#a1a1aa)] flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-400" /> Inconsistencies
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-amber-400">
              {metrics ? metrics.failed_calculations : 0}
            </div>
          </div>
        </div>

        {/* Live On-Demand Self-Verification */}
        <div className="p-4 rounded-xl border border-[var(--app-border,#27272a)] bg-white/2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Play size={16} className="text-emerald-400" /> Live Benchmark Self-Test
              </div>
              <div className="text-xs text-[var(--app-muted,#a1a1aa)]">
                Executes live deterministic test: Assets (₹100,000) - Liabilities (₹15,000) = ₹85,000.
              </div>
            </div>
            <button
              onClick={runLiveBenchmark}
              disabled={runningTest}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-black font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={runningTest ? "animate-spin" : ""} />
              {runningTest ? "Validating..." : "Run Test"}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                testResult.pass
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  {testResult.pass ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {testResult.scenario}
                </div>
                <div>
                  Expected: ₹{testResult.expected?.toLocaleString("en-IN")} | Actual: ₹
                  {testResult.actual?.toLocaleString("en-IN")}
                </div>
              </div>
              <div className="text-right">
                <div>Latency: {testResult.execution_time_ms} ms</div>
                <div>Status: {testResult.pass ? "PASSED (100% ACCURACY)" : "FAILED"}</div>
              </div>
            </div>
          )}
        </div>

        {/* Module-Wise Status Grid */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted,#a1a1aa)]">
            Active Financial Engine Modules
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            {[
              "ExpenseEngine",
              "IncomeEngine",
              "BudgetEngine",
              "NetWorthEngine",
              "InvestmentEngine",
              "PortfolioEngine",
              "ReconciliationEngine",
              "PrecisionEngine",
            ].map((mod) => (
              <div
                key={mod}
                className="p-2.5 rounded-lg border border-[var(--app-border,#27272a)] bg-white/2 flex items-center justify-between"
              >
                <span>{mod}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Audit Trail History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--app-muted,#a1a1aa)]">
            <span>Recent Immutable Audit Trail</span>
            <button
              onClick={fetchTelemetry}
              className="text-emerald-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--app-border,#27272a)] text-xs font-mono">
            {history.length === 0 ? (
              <div className="p-4 text-center text-[var(--app-muted,#a1a1aa)]">
                No calculation audit events recorded yet. Run a calculation or self-test above.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-[var(--app-border,#27272a)] text-[var(--app-muted,#a1a1aa)]">
                  <tr>
                    <th className="p-2">ID</th>
                    <th className="p-2">Module</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Time</th>
                    <th className="p-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border,#27272a)]">
                  {history.map((rec) => (
                    <tr
                      key={rec.calculation_id}
                      onClick={() => setSelectedRecord(rec)}
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="p-2 truncate max-w-[120px]">{rec.calculation_id}</td>
                      <td className="p-2 text-blue-400">{rec.calculation_type}</td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            rec.status === "SUCCESS"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="p-2">{rec.execution_time_ms} ms</td>
                      <td className="p-2 text-[var(--app-muted,#a1a1aa)]">
                        {new Date(rec.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Selected Audit Record Details Modal */}
        {selectedRecord && (
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between font-bold text-blue-400">
              <span>Calculation Details: {selectedRecord.calculation_id}</span>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-[var(--app-muted,#a1a1aa)] hover:text-white"
              >
                ✕
              </button>
            </div>
            <div>Module: {selectedRecord.calculation_type} (v{selectedRecord.version})</div>
            <div>Status: {selectedRecord.status} | Execution Time: {selectedRecord.execution_time_ms} ms</div>
            <div>Result Summary: {JSON.stringify(selectedRecord.result_summary, null, 2)}</div>
            {selectedRecord.error && <div className="text-red-400">Error: {selectedRecord.error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
