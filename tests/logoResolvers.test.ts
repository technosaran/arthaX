import { describe, it, expect } from "vitest";
import { getBankDomain } from "@/utils/bankLogos";
import { getKnownBankMark } from "@/components/BankLogo";
import { getEntityDomain } from "@/utils/entityLogos";
import { getAppleWalletTheme } from "@/components/AppleWalletCard";
import {
  normalizeCryptoSymbol,
  getCryptoLogoSources,
  getCryptoFallbackColor,
  KNOWN_CRYPTO_BRANDS,
} from "@/utils/cryptoLogos";

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

  describe("Cryptocurrency Logo & Symbol Normalization", () => {
    it("normalizes spot cryptocurrency ticker symbols and identifies Binance Earn & wrapped assets", () => {
      // Direct spot assets
      expect(normalizeCryptoSymbol("BTC").cleanSymbol).toBe("BTC");
      expect(normalizeCryptoSymbol("ETH").cleanSymbol).toBe("ETH");
      expect(normalizeCryptoSymbol("sol").cleanSymbol).toBe("SOL");

      // Binance Earn assets
      const earnBtc = normalizeCryptoSymbol("LDBTC");
      expect(earnBtc.cleanSymbol).toBe("BTC");
      expect(earnBtc.isEarn).toBe(true);
      expect(earnBtc.displaySymbol).toBe("LDBTC");

      const earnUsdt = normalizeCryptoSymbol("LDUSDT");
      expect(earnUsdt.cleanSymbol).toBe("USDT");
      expect(earnUsdt.isEarn).toBe(true);

      // Wrapped and pegged tokens
      const wbtc = normalizeCryptoSymbol("WBTC");
      expect(wbtc.cleanSymbol).toBe("BTC");
      expect(wbtc.isWrapped).toBe(true);

      const btcb = normalizeCryptoSymbol("BTCB");
      expect(btcb.cleanSymbol).toBe("BTC");
      expect(btcb.isWrapped).toBe(true);

      // Trading pairs passed inadvertently
      const pair = normalizeCryptoSymbol("BTCUSDT");
      expect(pair.cleanSymbol).toBe("BTC");
    });

    it("generates multi-tier CDN fallbacks for crypto assets", () => {
      const sources = getCryptoLogoSources("SOL");
      expect(sources.length).toBeGreaterThanOrEqual(4);
      expect(sources[0]).toContain("assets.coincap.io/assets/icons/sol@2x.png");
      expect(sources[1]).toContain("spothq/cryptocurrency-icons@master/128/color/sol.png");
      expect(sources[2]).toContain("spothq/cryptocurrency-icons@master/svg/color/sol.svg");
      expect(sources[3]).toContain("trustwallet/assets/master/blockchains/binance/assets/SOL/logo.png");
    });

    it("has brand definitions with colors for major cryptocurrencies", () => {
      expect(KNOWN_CRYPTO_BRANDS.BTC.name).toBe("Bitcoin");
      expect(KNOWN_CRYPTO_BRANDS.BTC.color).toBe("#F7931A");

      expect(KNOWN_CRYPTO_BRANDS.ETH.name).toBe("Ethereum");
      expect(KNOWN_CRYPTO_BRANDS.ETH.color).toBe("#627EEA");

      expect(KNOWN_CRYPTO_BRANDS.SOL.name).toBe("Solana");
      expect(KNOWN_CRYPTO_BRANDS.BNB.name).toBe("BNB");
      expect(KNOWN_CRYPTO_BRANDS.USDT.name).toBe("Tether USD");
    });

    it("provides deterministic styling for unknown / unlisted coins", () => {
      const unknownFallback = getCryptoFallbackColor("CUSTOMCOIN");
      expect(unknownFallback.bg).toBeDefined();
      expect(unknownFallback.text).toBe("#FFFFFF");
    });
  });
});
