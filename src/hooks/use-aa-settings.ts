import { useState } from "react";
import { toast } from "react-hot-toast";

export interface AADiscoveredAccount {
  accountRefId: string;
  bankName: string;
  accountType: "savings" | "checking" | "deposit";
  maskedAccountNumber: string;
  fipId: string;
  balance: number;
  currency: string;
}

export function useAccountAggregator() {
  const [loading, setLoading] = useState(false);
  const [consentHandleId, setConsentHandleId] = useState<string | null>(null);
  const [discoveredAccounts, setDiscoveredAccounts] = useState<AADiscoveredAccount[]>([]);
  const [activeStep, setActiveStep] = useState<"phone" | "discover" | "otp" | "success">("phone");

  const initiateConsent = async (mobileNumber: string): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/link-aa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initiate", mobileNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to initiate bank consent.");
        return false;
      }

      setConsentHandleId(data.consentHandleId);
      setDiscoveredAccounts(data.discoveredAccounts || []);
      setActiveStep("discover");
      toast.success("Bank accounts discovered! Select accounts to link.");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to connect with Account Aggregator.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndSync = async (
    mobileNumber: string,
    otp: string,
    selectedAccountIds: string[]
  ): Promise<boolean> => {
    if (!consentHandleId) {
      toast.error("Consent handle missing. Please start over.");
      return false;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/accounts/link-aa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          consentHandleId,
          otp,
          mobileNumber,
          selectedAccountIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to verify OTP or sync bank accounts.");
        return false;
      }

      setActiveStep("success");
      toast.success(data.message || "Bank accounts synced successfully!");
      return true;
    } catch (err: any) {
      toast.error(err.message || "An error occurred during bank sync.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setConsentHandleId(null);
    setDiscoveredAccounts([]);
    setActiveStep("phone");
  };

  return {
    loading,
    consentHandleId,
    discoveredAccounts,
    activeStep,
    setActiveStep,
    initiateConsent,
    verifyOtpAndSync,
    reset,
  };
}
