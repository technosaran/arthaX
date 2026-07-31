import { describe, it, expect } from "@jest/globals";
import { getBankDomain, getBankLogoSources, searchBanks } from "@/lib/banks";

describe("Bank Logo and Domain Resolution", () => {
  it("resolves major Indian public sector bank domains correctly", () => {
    expect(getBankDomain("State Bank of India")).toBe("sbi.co.in");
    expect(getBankDomain("SBI")).toBe("sbi.co.in");
    expect(getBankDomain("SBI Savings Account")).toBe("sbi.co.in");
    expect(getBankDomain("HDFC Bank")).toBe("hdfcbank.com");
    expect(getBankDomain("HDFCBANK")).toBe("hdfcbank.com");
    expect(getBankDomain("ICICI Bank")).toBe("icicibank.com");
    expect(getBankDomain("ICICIBANK")).toBe("icicibank.com");
    expect(getBankDomain("Axis Bank")).toBe("axisbank.com");
    expect(getBankDomain("AXISBANK")).toBe("axisbank.com");
    expect(getBankDomain("Kotak Mahindra Bank")).toBe("kotak.com");
    expect(getBankDomain("Kotak 811")).toBe("kotak.com");
    expect(getBankDomain("Punjab National Bank")).toBe("pnbindia.in");
    expect(getBankDomain("PNB")).toBe("pnbindia.in");
    expect(getBankDomain("Bank of Baroda")).toBe("bankofbaroda.in");
    expect(getBankDomain("BOB")).toBe("bankofbaroda.in");
    expect(getBankDomain("Canara Bank")).toBe("canarabank.com");
    expect(getBankDomain("Union Bank of India")).toBe("unionbankofindia.co.in");
    expect(getBankDomain("Bank of India")).toBe("bankofindia.co.in");
    expect(getBankDomain("Indian Bank")).toBe("indianbank.in");
  });

  it("resolves private, small finance & payment banks correctly", () => {
    expect(getBankDomain("IDFC First Bank")).toBe("idfcfirstbank.com");
    expect(getBankDomain("IDFCFIRST")).toBe("idfcfirstbank.com");
    expect(getBankDomain("IndusInd Bank")).toBe("indusind.com");
    expect(getBankDomain("Yes Bank")).toBe("yesbank.in");
    expect(getBankDomain("Federal Bank")).toBe("federalbank.co.in");
    expect(getBankDomain("RBL Bank")).toBe("rblbank.com");
    expect(getBankDomain("Bandhan Bank")).toBe("bandhanbank.com");
    expect(getBankDomain("AU Small Finance Bank")).toBe("aubank.in");
    expect(getBankDomain("Equitas Small Finance Bank")).toBe("equitasbank.com");
    expect(getBankDomain("Ujjivan Small Finance Bank")).toBe("ujjivansfb.in");
    expect(getBankDomain("Paytm Payments Bank")).toBe("paytmbank.com");
    expect(getBankDomain("Airtel Payments Bank")).toBe("airtel.in");
  });

  it("resolves co-operative and regional banks correctly", () => {
    expect(getBankDomain("Saraswat Bank")).toBe("saraswatbank.com");
    expect(getBankDomain("Cosmos Bank")).toBe("cosmosbank.com");
    expect(getBankDomain("TJSB Bank")).toBe("tjsbbank.co.in");
    expect(getBankDomain("SVC Bank")).toBe("svcbank.com");
    expect(getBankDomain("Karur Vysya Bank")).toBe("kvb.co.in");
    expect(getBankDomain("South Indian Bank")).toBe("southindianbank.com");
  });

  it("resolves neo-banks and brokers correctly", () => {
    expect(getBankDomain("Jupiter")).toBe("jupiter.money");
    expect(getBankDomain("Fi Money")).toBe("fi.money");
    expect(getBankDomain("Zerodha")).toBe("zerodha.com");
    expect(getBankDomain("Groww")).toBe("groww.in");
    expect(getBankDomain("Upstox")).toBe("upstox.com");
    expect(getBankDomain("Angel One")).toBe("angelone.in");
  });

  it("generates multi-CDN online logo sources correctly", () => {
    const sources = getBankLogoSources("HDFC Bank");
    expect(sources.length).toBeGreaterThanOrEqual(5);
    expect(sources[0]).toBe("https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks@master/assets/logos/hdfc.svg");
    expect(sources).toContain("https://api.iconhorse.com/v1/hdfcbank.com");
    expect(sources).toContain("https://logo.clearbit.com/hdfcbank.com");
    expect(sources).toContain("https://api.faviconkit.com/hdfcbank.com/128");
    expect(sources).toContain("https://icons.duckduckgo.com/ip3/hdfcbank.com.ico");
  });


  it("searches banks cleanly", () => {
    const results = searchBanks("SBI");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].domain).toBe("sbi.co.in");
  });
});
