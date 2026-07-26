"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { X, Upload, FileCheck, Layers, TrendingUp } from "lucide-react";
import { CASParsedItem } from "@/lib/cas-parser/types";
import { importCASPortfolio } from "@/app/dashboard/mutual-funds/actions";

interface CASImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CASImportModal({
  isOpen,
  onClose,
  onSuccess,
}: CASImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedItems, setParsedItems] = useState<CASParsedItem[]>([]);
  const [detectedType, setDetectedType] = useState<string>("");
  const [pasteMode, setPasteMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");

  if (!isOpen) return null;

  const handleParseCAS = async () => {
    if (!selectedFile && !rawText.trim()) {
      toast.error("Please upload a CAS statement file or paste statement text");
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      if (pasteMode || !selectedFile) {
        res = await fetch("/api/cas-parser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText, password: pdfPassword }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (pdfPassword) formData.append("password", pdfPassword);

        res = await fetch("/api/cas-parser", {
          method: "POST",
          body: formData,
        });
      }

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to parse CAS statement");

      if (!json.items || json.items.length === 0) {
        toast.error("No investments detected in statement. Make sure it's a valid CAMS or NSDL CAS statement.");
        setParsedItems([]);
      } else {
        setParsedItems(json.items);
        setDetectedType(json.casType || "Generic CAS");
        toast.success(`Successfully parsed ${json.items.length} investment holdings!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to parse CAS statement");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setParsedItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleExecuteImport = async () => {
    const selected = parsedItems.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error("Please select at least one investment to import.");
      return;
    }

    setImporting(true);
    try {
      const res = await importCASPortfolio(
        selected.map((i) => ({
          assetClass: i.assetClass,
          name: i.name,
          symbolOrSchemeCode: i.symbolOrSchemeCode,
          unitsOrQuantity: i.unitsOrQuantity,
          currentNavOrPrice: i.currentNavOrPrice,
        }))
      );

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || "Portfolio imported successfully!");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to import portfolio");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsedItems.filter((i) => i.selected).length;
  const totalValuation = parsedItems
    .filter((i) => i.selected)
    .reduce((acc, curr) => acc + curr.totalValuation, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">CAMS / NSDL CAS Investment Parser</h2>
              <p className="text-xs text-white/50">Bulk import Mutual Funds & Stocks from CAMS, KFintech, CDSL, & NSDL CAS statements</p>
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
          {/* Mode Switch & Password Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Input Method</label>
              <div className="flex bg-[#1a1d28] p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setPasteMode(false)}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
                    !pasteMode ? "bg-purple-500 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  Upload PDF File
                </button>
                <button
                  type="button"
                  onClick={() => setPasteMode(true)}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
                    pasteMode ? "bg-purple-500 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  Paste Statement Text
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">PDF Password (if encrypted)</label>
              <input
                type="password"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="e.g. PAN (capitalized) or DOB"
                className="w-full bg-[#1a1d28] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Upload or Text Paste Area */}
          {!pasteMode ? (
            <div className="border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-6 text-center transition bg-white/[0.01]">
              <input
                type="file"
                accept=".pdf,.txt,.csv"
                id="cas-file-input"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="cas-file-input" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedFile ? selectedFile.name : "Click to upload CAMS or NSDL CAS PDF Statement"}
                  </p>
                  <p className="text-xs text-white/40 mt-1">Supports CAMS, KFintech, CDSL, and NSDL statements</p>
                </div>
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-white/60 mb-1">Paste CAS Statement Text</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste statement text here..."
                rows={5}
                className="w-full bg-[#1a1d28] border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {/* Parse Button */}
          <button
            onClick={handleParseCAS}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Parsing CAS Statement..." : "Parse Portfolio Holdings"}
          </button>

          {/* Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Parsed Portfolio Items ({selectedCount}/{parsedItems.length} selected)
                  </h3>
                  <p className="text-xs text-white/50">
                    Statement Format: <span className="text-purple-400 font-bold uppercase">{detectedType}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleSelectAll(true)} className="text-xs text-purple-400 hover:underline">
                    Select All
                  </button>
                  <span className="text-white/20">|</span>
                  <button onClick={() => handleSelectAll(false)} className="text-xs text-white/50 hover:underline">
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs text-white/80">
                  <thead className="bg-[#1a1d28] text-white/60 sticky top-0 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Select</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Investment Name</th>
                      <th className="p-3 text-right">Units / Qty</th>
                      <th className="p-3 text-right">NAV / Price</th>
                      <th className="p-3 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsedItems.map((item) => (
                      <tr key={item.id} className={item.selected ? "bg-purple-500/5" : "opacity-40"}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded border-white/20 bg-transparent text-purple-500 focus:ring-0"
                          />
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                              item.assetClass === "mutual_fund"
                                ? "bg-sky-500/10 border-sky-500/20 text-sky-400"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {item.assetClass === "mutual_fund" ? "Mutual Fund" : "Stock"}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate" title={item.name}>
                          {item.name}
                        </td>
                        <td className="p-3 text-right font-mono">{item.unitsOrQuantity.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">₹{item.currentNavOrPrice.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-medium text-purple-300">
                          ₹{item.totalValuation.toLocaleString()}
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
        {parsedItems.length > 0 && (
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="text-xs text-white/70">
              Total Portfolio Inflow: <span className="text-purple-400 font-bold text-sm">₹{totalValuation.toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs text-white/70 hover:bg-white/5 transition">
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={importing || selectedCount === 0}
                className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? "Importing Portfolio..." : `Import ${selectedCount} Holdings`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
