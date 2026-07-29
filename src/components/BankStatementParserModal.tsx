"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { X, Upload, FileText, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { BankType, ParsedTransaction } from "@/lib/bank-parsers/types";
import { importParsedTransactions } from "@/app/dashboard/accounts/actions";

interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
}

interface BankStatementParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess?: () => void;
}

export default function BankStatementParserModal({
  isOpen,
  onClose,
  accounts,
  onSuccess,
}: BankStatementParserModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bankType, setBankType] = useState<BankType>("auto");
  const [targetAccountId, setTargetAccountId] = useState<string>(accounts[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [detectedBank, setDetectedBank] = useState<string>("");
  const [pasteTextMode, setPasteTextMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");

  if (!isOpen) return null;

  const handleParseFile = async () => {
    if (!selectedFile && !rawText.trim()) {
      toast.error("Please upload a bank statement file or paste statement text");
      return;
    }

    setLoading(true);
    try {
      let res: Response;

      if (pasteTextMode || !selectedFile) {
        res = await fetch("/api/bank-parser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText, bank: bankType, password: pdfPassword }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("bank", bankType);
        if (pdfPassword) formData.append("password", pdfPassword);

        res = await fetch("/api/bank-parser", {
          method: "POST",
          body: formData,
        });
      }

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to parse bank statement");
      }

      if (!json.transactions || json.transactions.length === 0) {
        toast.error("No transactions found in this statement text. Try choosing a specific bank format.");
        setParsedData([]);
      } else {
        setParsedData(json.transactions);
        setDetectedBank(json.bankDetected || "Generic");
        toast.success(`Successfully parsed ${json.transactions.length} transactions!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to parse bank statement");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setParsedData((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setParsedData((prev) => prev.map((t) => ({ ...t, selected: select })));
  };

  const handleExecuteImport = async () => {
    const selectedTransactions = parsedData.filter((t) => t.selected);
    if (selectedTransactions.length === 0) {
      toast.error("Please select at least one transaction to import.");
      return;
    }
    if (!targetAccountId) {
      toast.error("Please select a target bank account.");
      return;
    }

    setImporting(true);
    try {
      const res = await importParsedTransactions(
        targetAccountId,
        selectedTransactions.map((t) => ({
          date: t.date,
          description: t.description,
          type: t.type,
          amount: t.amount,
          category: t.category,
        }))
      );

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || "Transactions imported successfully!");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to import transactions");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsedData.filter((t) => t.selected).length;
  const totalSelectedAmount = parsedData
    .filter((t) => t.selected)
    .reduce((acc, curr) => (curr.type === "expense" ? acc - curr.amount : acc + curr.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Bank PDF Statement Parser</h2>
              <p className="text-xs text-white/50">Auto-parse transactions from ICICI, HDFC, SBI, Axis, & generic PDFs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Settings Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Target Account</label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="w-full bg-[#1a1d28] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency} {acc.balance})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Bank Format</label>
              <select
                value={bankType}
                onChange={(e) => setBankType(e.target.value as BankType)}
                className="w-full bg-[#1a1d28] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="auto">Auto-Detect Format</option>
                <option value="hdfc">HDFC Bank</option>
                <option value="icici">ICICI Bank</option>
                <option value="sbi">State Bank of India (SBI)</option>
                <option value="axis">Axis Bank</option>
                <option value="generic">Generic PDF / CSV / Text</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">PDF Password (if encrypted)</label>
              <input
                type="password"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="e.g. DOB or PAN"
                className="w-full bg-[#1a1d28] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Input Method</label>
              <div className="flex bg-[#1a1d28] p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setPasteTextMode(false)}
                  className={`flex-1 py-1 text-xs rounded-lg font-medium transition ${
                    !pasteTextMode ? "bg-sky-500 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setPasteTextMode(true)}
                  className={`flex-1 py-1 text-xs rounded-lg font-medium transition ${
                    pasteTextMode ? "bg-sky-500 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  Paste Text
                </button>
              </div>
            </div>
          </div>

          {/* File Upload or Text Paste Area */}
          {!pasteTextMode ? (
            <div className="border-2 border-dashed border-white/15 hover:border-sky-500/50 rounded-2xl p-6 text-center transition bg-white/[0.01]">
              <input
                type="file"
                accept=".pdf,.txt,.csv"
                id="statement-file-input"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="statement-file-input" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedFile ? selectedFile.name : "Click to upload or drag & drop Bank Statement PDF"}
                  </p>
                  <p className="text-xs text-white/40 mt-1">Supports PDF, CSV, or TXT bank statements</p>
                </div>
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-white/60 mb-1">Paste Bank Statement Text</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste statement text here (e.g. copied from PDF or bank net banking)..."
                rows={5}
                className="w-full bg-[#1a1d28] border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          {/* Parse Action Button */}
          <button
            onClick={handleParseFile}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Parsing Statement..." : "Parse & Preview Transactions"}
          </button>

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Parsed Transactions ({selectedCount}/{parsedData.length} selected)
                  </h3>
                  <p className="text-xs text-white/50">
                    Detected Format: <span className="text-sky-400 uppercase font-bold">{detectedBank}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="text-xs text-white/50 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs text-white/80">
                  <thead className="bg-[#1a1d28] text-white/60 sticky top-0 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Select</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsedData.map((t) => (
                      <tr key={t.id} className={t.selected ? "bg-sky-500/5" : "opacity-40"}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={t.selected}
                            onChange={() => handleToggleSelect(t.id)}
                            className="rounded border-white/20 bg-transparent text-sky-500 focus:ring-0"
                          />
                        </td>
                        <td className="p-3 font-mono">{t.date}</td>
                        <td className="p-3 max-w-xs truncate" title={t.description}>
                          {t.description}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 text-white/80">
                            {t.category}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-medium">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              t.type === "income" ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {t.type === "income" ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            ₹{t.amount.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {parsedData.length > 0 && (
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="text-xs text-white/70">
              Net Impact:{" "}
              <span className={totalSelectedAmount >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                ₹{totalSelectedAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-white/70 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={importing || selectedCount === 0}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? "Importing..." : `Import ${selectedCount} Transactions`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
