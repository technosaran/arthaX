import { describe, it, expect } from "vitest";
import { getBankDomain } from "@/utils/bankLogos";
import { getKnownBankMark } from "@/components/BankLogo";
import { getEntityDomain } from "@/utils/entityLogos";
import { getAppleWalletTheme } from "@/components/AppleWalletCard";

describe("Bank and Entity Logo Resolvers", () => {
  describe("Bank Logo Matching", () => {
    it("should correctly identify all major Indian and global banks", () => {
      expect(getKnownBankMark("SBI")).toBe("sbi");
      expect(getKnownBankMark("SBI Savings Account")).toBe("sbi");
      expect(getKnownBankMark("State Bank of India")).toBe("sbi");

      expect(getKnownBankMark("ICICI")).toBe("icici");
      expect(getKnownBankMark("ICICI Bank")).toBe("icici");
      expect(getKnownBankMark("Icici Salary")).toBe("icici");

      expect(getKnownBankMark("HDFC")).toBe("hdfc");
      expect(getKnownBankMark("HDFC Bank Ltd")).toBe("hdfc");

      expect(getKnownBankMark("Axis")).toBe("axis");
      expect(getKnownBankMark("Axis Burgundy")).toBe("axis");

      expect(getKnownBankMark("Kotak")).toBe("kotak");
      expect(getKnownBankMark("Kotak 811")).toBe("kotak");

      expect(getKnownBankMark("Canara Bank")).toBe("canara");
      expect(getKnownBankMark("Bank of Baroda")).toBe("bob");
      expect(getKnownBankMark("Punjab National Bank")).toBe("pnb");
      expect(getKnownBankMark("Union Bank")).toBe("union");
      expect(getKnownBankMark("Bank of India")).toBe("boi");
      expect(getKnownBankMark("Indian Bank")).toBe("indianbank");
      expect(getKnownBankMark("IDBI Bank")).toBe("idbi");
      expect(getKnownBankMark("IndusInd Bank")).toBe("indusind");
      expect(getKnownBankMark("Yes Bank")).toBe("yes");
      expect(getKnownBankMark("IDFC FIRST Bank")).toBe("idfc");
      expect(getKnownBankMark("Federal Bank")).toBe("federal");
      expect(getKnownBankMark("Standard Chartered")).toBe("stanchart");
      expect(getKnownBankMark("Cash in Hand")).toBe("cash");
    });

    it("should never guess random .com domains for custom account names", () => {
      expect(getBankDomain("My Salary Account")).toBeNull();
      expect(getBankDomain("Personal Savings")).toBeNull();
      expect(getBankDomain("Emergency Fund")).toBeNull();
      expect(getBankDomain("Office Expenses")).toBeNull();
      expect(getBankDomain("Family Vault")).toBeNull();
      expect(getBankDomain("House Rent")).toBeNull();
      expect(getBankDomain("Primary Account")).toBeNull();
    });

    it("should resolve explicit bank domains correctly", () => {
      expect(getBankDomain("SBI")).toBe("sbi.co.in");
      expect(getBankDomain("ICICI")).toBe("icicibank.com");
      expect(getBankDomain("HDFC")).toBe("hdfcbank.com");
      expect(getBankDomain("Axis")).toBe("axisbank.com");
      expect(getBankDomain("Kotak")).toBe("kotak.com");
    });
  });

  describe("Entity Domain Matching", () => {
    it("should never guess random .com domains for transaction title words", () => {
      expect(getEntityDomain("Dinner with friends")).toBeNull();
      expect(getEntityDomain("Auto to railway station")).toBeNull();
      expect(getEntityDomain("Gift for mom")).toBeNull();
      expect(getEntityDomain("College semester fee")).toBeNull();
      expect(getEntityDomain("Room rent payment")).toBeNull();
      expect(getEntityDomain("Car wash and cleaning")).toBeNull();
      expect(getEntityDomain("Temple donation")).toBeNull();
    });

    it("should not trigger false positives on words like credit or primary", () => {
      expect(getEntityDomain("Credit card bill payment")).toBeNull();
      expect(getEntityDomain("Primary account transfer")).toBeNull();
    });

    it("should correctly identify verified merchants", () => {
      expect(getEntityDomain("Swiggy")).toBe("swiggy.com");
      expect(getEntityDomain("Zomato")).toBe("zomato.com");
      expect(getEntityDomain("Amazon")).toBe("amazon.com");
      expect(getEntityDomain("Flipkart")).toBe("flipkart.com");
      expect(getEntityDomain("Netflix")).toBe("netflix.com");
      expect(getEntityDomain("Spotify")).toBe("spotify.com");
      expect(getEntityDomain("Uber")).toBe("uber.com");
      expect(getEntityDomain("Google Play")).toBe("google.com");
    });
  });

  describe("Apple Wallet Theme and Network Detection", () => {
    it("should override card network if specified in name or type", () => {
      const sbiRupay = getAppleWalletTheme("SBI", "Savings");
      expect(sbiRupay.network).toBe("rupay");

      const sbiVisa = getAppleWalletTheme("SBI Visa Platinum", "Debit");
      expect(sbiVisa.network).toBe("visa");

      const iciciMastercard = getAppleWalletTheme("ICICI Mastercard", "Debit");
      expect(iciciMastercard.network).toBe("mastercard");

      const iciciRupay = getAppleWalletTheme("ICICI Coral RuPay", "Credit");
      expect(iciciRupay.network).toBe("rupay");
    });
  });
});
