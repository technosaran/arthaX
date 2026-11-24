"use client";

import React, { useState, useEffect } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import BankLogo from "@/components/BankLogo";
import { getBankPasswordFormatDescription } from "@/utils/bankPasswords";

export interface StatementPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  banks: string[];
  hints?: Record<string, string>;
  noticeMessage?: string;
  onDecrypt: (passwords: Record<string, string>, storeForFuture: boolean) => Promise<boolean | void>;
  isSubmitting?: boolean;
}

function getBankDisplayName(bank: string): string {
  const norm = (bank || "").trim().toUpperCase();
  if (norm === "SBI" || norm.includes("STATE BANK")) return "State Bank of India (SBI)";
  if (norm === "INDIAN_BANK" || norm.includes("INDIAN BANK") || norm === "INDBANK") return "Indian Bank";
  if (norm === "HDFC") return "HDFC Bank";
  if (norm === "ICICI") return "ICICI Bank";
  if (norm === "AXIS") return "Axis Bank";
  if (norm === "KOTAK") return "Kotak Mahindra Bank";
  if (norm === "PNB" || norm.includes("PUNJAB")) return "Punjab National Bank (PNB)";
  if (norm === "CANARA") return "Canara Bank";
  if (norm === "BOB" || norm.includes("BARODA")) return "Bank of Baroda";
  if (norm === "UNION") return "Union Bank of India";
  if (norm === "YES_BANK" || norm.includes("YES")) return "Yes Bank";
  if (norm === "IDFC") return "IDFC FIRST Bank";
  return bank.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StatementPasswordModal: React.FC<StatementPasswordModalProps> = ({
  isOpen,
  onClose,
  banks,
  hints = {},
  noticeMessage,
  onDecrypt,
  isSubmitting = false,
}) => {
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [storeForFuture, setStoreForFuture] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize password inputs when banks change
  useEffect(() => {
    if (isOpen && banks.length > 0) {
      setPasswords((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const b of banks) {
          if (next[b] === undefined) {
            next[b] = "";
          }
        }
        return next;
      });
      setErrorMessage(null);
    }
  }, [isOpen, banks]);

  const handlePasswordChange = (bank: string, val: string) => {
    setPasswords((prev) => ({ ...prev, [bank]: val }));
    if (errorMessage) setErrorMessage(null);
  };

  const toggleShowPassword = (bank: string) => {
    setShowPassword((prev) => ({ ...prev, [bank]: !prev[bank] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate that at least one password is provided
    const provided = Object.entries(passwords).filter(([_, pwd]) => pwd && pwd.trim().length > 0);
    if (provided.length === 0) {
      setErrorMessage("Please enter the decryption password for at least one statement.");
      return;
    }

    try {
      const cleanPasswords: Record<string, string> = {};
      for (const [b, p] of Object.entries(passwords)) {
        if (p && p.trim()) {
          cleanPasswords[b] = p.trim();
        }
      }
      await onDecrypt(cleanPasswords, storeForFuture);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to decrypt statements with provided password(s).");
    }
  };

  const hasAtLeastOnePassword = Object.values(passwords).some((p) => p && p.trim().length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
            <Lock size={15} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--app-fg)]">
              Statement Password Required
            </h3>
            <p className="text-[11px] opacity-60 font-normal">
              Enter password to decrypt and import statement transactions
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Notice banner */}
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-[11px] text-amber-200">
              New statement(s) found requiring decryption password
            </p>
            <p className="text-[11px] opacity-90 leading-relaxed">
              ArthaX discovered monthly statement(s) from{" "}
              <strong>{banks.map(getBankDisplayName).join(", ")}</strong>. Because these PDFs are encrypted by the bank, please enter your password below to unlock and extract your transactions.
            </p>
          </div>
        </div>

        {/* Error alert if retry failed */}
        {errorMessage && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-150">
            <AlertTriangle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Bank password input cards */}
        <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
          {banks.map((bank) => {
            const rawHint = hints[bank] || getBankPasswordFormatDescription(bank);
            const isVisible = Boolean(showPassword[bank]);
            const val = passwords[bank] || "";

            return (
              <div
                key={bank}
                className="p-3.5 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg)]/80 space-y-2.5 transition-colors focus-within:border-emerald-500/50"
              >
                {/* Bank Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-card)] flex items-center justify-center p-1">
                      <BankLogo name={bank} size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[var(--app-fg)]">
                        {getBankDisplayName(bank)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="amber" size="xs">
                    Password Protected
                  </Badge>
                </div>

                {/* Password Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--app-muted)]">
                    <KeyRound size={13} />
                  </div>
                  <input
                    type={isVisible ? "text" : "password"}
                    value={val}
                    onChange={(e) => handlePasswordChange(bank, e.target.value)}
                    placeholder="Enter decryption password"
                    autoComplete="off"
                    className="w-full text-xs font-mono pl-8 pr-9 py-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-emerald-500/60 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowPassword(bank)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-colors cursor-pointer"
                    title={isVisible ? "Hide password" : "Show password"}
                  >
                    {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                {/* Bank Format Hint */}
                {rawHint && (
                  <div className="p-2 rounded-lg bg-[var(--app-card)]/90 border border-[var(--app-border-subtle)] text-[11px] text-[var(--app-muted)] flex items-start gap-1.5 leading-snug">
                    <HelpCircle size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[var(--app-fg)] opacity-90">Format Hint:</strong> {rawHint}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Store for future checkbox */}
        <div className="p-3 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-bg-subtle)] flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <label
                htmlFor="store-pwd-checkbox"
                className="text-xs font-semibold text-[var(--app-fg)] cursor-pointer select-none"
              >
                Store securely for future statements
              </label>
              <p className="text-[11px] opacity-60 leading-tight mt-0.5">
                Zero-knowledge encrypted with AES-256-GCM. Future monthly statements from these banks will automatically decrypt in the background without prompting you.
              </p>
            </div>
          </div>
          <input
            id="store-pwd-checkbox"
            type="checkbox"
            checked={storeForFuture}
            onChange={(e) => setStoreForFuture(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer mt-0.5"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--app-border-subtle)]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isSubmitting}
            disabled={isSubmitting || !hasAtLeastOnePassword}
            icon={isSubmitting ? undefined : <CheckCircle2 size={13} />}
            className="shadow-sm font-semibold text-xs min-w-[140px]"
          >
            {isSubmitting ? "Decrypting Statements..." : "Decrypt & Import"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
export default StatementPasswordModal;
