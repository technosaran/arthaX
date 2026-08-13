"use client";

import { useState } from "react";
import { X, ShieldCheck, Building2, CheckCircle2, Lock, ArrowRight, Smartphone } from "lucide-react";
import { useAccountAggregator } from "@/hooks/use-aa-settings";
import { SUPPORTED_BANKS_AA } from "@/lib/account-aggregator/aa-config";

interface AccountAggregatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AccountAggregatorModal({ isOpen, onClose, onSuccess }: AccountAggregatorModalProps) {
  const {
    loading,
    discoveredAccounts,
    activeStep,
    setActiveStep,
    initiateConsent,
    verifyOtpAndSync,
    reset,
  } = useAccountAggregator();

  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("1234");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await initiateConsent(mobileNumber);
    if (ok) {
      // Default select all discovered
      setTimeout(() => {
        setSelectedAccountIds(discoveredAccounts.map((a) => a.accountRefId));
      }, 50);
    }
  };

  const handleProceedToOtp = () => {
    if (selectedAccountIds.length === 0) {
      return;
    }
    setActiveStep("otp");
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyOtpAndSync(mobileNumber, otp, selectedAccountIds);
    if (ok) {
      onSuccess();
    }
  };

  const toggleSelectAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-2xl overflow-hidden">
        {/* Top Glow Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 shadow-inner">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white">Direct Bank Sync</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-400 text-[10px] uppercase tracking-wider ring-1 ring-emerald-500/20">
                <ShieldCheck className="h-3 w-3" /> RBI Regulated AA
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              Securely auto-sync balances & statements via RBI Account Aggregator.
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 px-2 text-xs font-semibold text-slate-400 border-b border-slate-800 pb-3">
          <span className={activeStep === "phone" ? "text-emerald-400 font-bold flex items-center gap-1" : ""}>
            1. Phone Number
          </span>
          <span className={activeStep === "discover" ? "text-emerald-400 font-bold flex items-center gap-1" : ""}>
            2. Select Banks
          </span>
          <span className={activeStep === "otp" || activeStep === "success" ? "text-emerald-400 font-bold flex items-center gap-1" : ""}>
            3. OTP Verify
          </span>
        </div>

        {/* STEP 1: Phone Number Input */}
        {activeStep === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" /> Linked Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">+91</span>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-11 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none font-mono tracking-wider"
                />
              </div>
              <p className="text-slate-500 text-[11px] mt-1.5">
                Enter the mobile number linked to your HDFC, ICICI, SBI, Axis, or Kotak bank accounts.
              </p>
            </div>

            {/* Supported Banks Grid */}
            <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 space-y-2">
              <p className="text-slate-400 text-[11px] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Supported Bank Networks
              </p>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {SUPPORTED_BANKS_AA.slice(0, 8).map((b) => (
                  <div key={b.id} className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-medium text-center">
                    {b.name}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20 text-emerald-300 text-[11px] leading-relaxed flex items-start gap-2">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Zero Password Sharing:</strong> No Net Banking passwords or UPI PINs are ever requested. Data transfer is 100% Read-Only and encrypted.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || mobileNumber.length < 10}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {loading ? "Discovering Bank Accounts..." : "Discover Bank Accounts"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Discovered Bank Accounts Selection */}
        {activeStep === "discover" && (
          <div className="space-y-4">
            <p className="text-slate-300 text-xs font-medium">
              Found <strong className="text-emerald-400">{discoveredAccounts.length} bank account(s)</strong> linked to +91 {mobileNumber}:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {discoveredAccounts.map((acc) => {
                const isSelected = selectedAccountIds.includes(acc.accountRefId);
                return (
                  <div
                    key={acc.accountRefId}
                    onClick={() => toggleSelectAccount(acc.accountRefId)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border text-xs font-bold ${
                        isSelected ? "bg-emerald-500 border-emerald-400 text-black" : "border-slate-700"
                      }`}>
                        {isSelected ? "✓" : ""}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{acc.bankName}</p>
                        <p className="text-[11px] text-slate-400">{acc.accountType.toUpperCase()} • {acc.maskedAccountNumber}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">
                        ₹{acc.balance.toLocaleString("en-IN")}
                      </p>
                      <span className="text-[10px] text-slate-500">Live Balance</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setActiveStep("phone")}
                className="text-xs text-slate-400 hover:text-white"
              >
                Change Phone Number
              </button>
              <button
                type="button"
                onClick={handleProceedToOtp}
                disabled={selectedAccountIds.length === 0}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                Proceed to Approve OTP <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP Verification */}
        {activeStep === "otp" && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">
                Enter Bank Consent OTP
              </label>
              <input
                type="text"
                required
                placeholder="1234"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-slate-500 text-[11px] mt-1.5 text-center">
                OTP sent by your bank via SMS to +91 {mobileNumber} to authorize read-only balance sync.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !otp}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {loading ? "Verifying OTP & Syncing..." : "Verify OTP & Sync Accounts"}
            </button>
          </form>
        )}

        {/* STEP 4: Success */}
        {activeStep === "success" && (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Bank Sync Complete!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Your bank balances and accounts have been linked to your arthaX dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer"
            >
              Done & View Accounts
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
