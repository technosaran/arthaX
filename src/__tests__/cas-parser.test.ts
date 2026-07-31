import { parseCASText, detectCASType } from "@/lib/cas-parser/cas-parser-engine";

describe("CAS Statement Parser Engine", () => {
  it("detects CAS statement type correctly", () => {
    expect(detectCASType("CAMS Consolidated Account Statement")).toBe("CAMS CAS");
    expect(detectCASType("KFintech Account Statement")).toBe("KFintech CAS");
    expect(detectCASType("NSDL Depository Holding Statement")).toBe("NSDL CAS");
    expect(detectCASType("CDSL Holding Statement")).toBe("CDSL CAS");
  });

  it("parses mutual fund schemes from CAMS statement text", () => {
    const mockText = `
      CAMS Consolidated Account Statement
      Folio No: 1234567/89
      HDFC Top 100 Fund - Direct Plan - Growth 150.250 85.40 12831.35
      SBI Small Cap Fund - Direct Growth 200.500 145.20 29112.60
    `;

    const result = parseCASText(mockText);
    expect(result.success).toBe(true);
    expect(result.casType).toBe("CAMS CAS");
    expect(result.items.length).toBe(2);

    const mf1 = result.items[0];
    expect(mf1.assetClass).toBe("mutual_fund");
    expect(mf1.name).toContain("HDFC Top 100 Fund");
    expect(mf1.unitsOrQuantity).toBe(150.25);
    expect(mf1.currentNavOrPrice).toBe(85.4);

    expect(result.totalValuation).toBeGreaterThan(40000);
  });

  it("parses stock holdings from NSDL/CDSL statement text", () => {
    const mockText = `
      NSDL Statement
      INE002A01018 RELIANCE INDUSTRIES LTD 100 2950.00 295000.00
      INE238A01034 AXIS BANK LTD 50 1120.00 56000.00
    `;

    const result = parseCASText(mockText);
    expect(result.success).toBe(true);
    expect(result.items.length).toBe(2);

    const stock1 = result.items[0];
    expect(stock1.assetClass).toBe("stock");
    expect(stock1.name).toBe("RELIANCE INDUSTRIES LTD");
    expect(stock1.unitsOrQuantity).toBe(100);
    expect(stock1.currentNavOrPrice).toBe(2950);
  });
});
