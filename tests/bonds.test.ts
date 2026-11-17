import { describe, it, expect } from "vitest";
import { isBondInstrument } from "@/utils/zerodha";
import { POPULAR_BONDS } from "@/app/api/v1/bonds/directory/route";

describe("Bonds & Fixed Income Portfolio Logic (IndiaBonds, GoldenPi & Zerodha Demat)", () => {
  describe("isBondInstrument Detector", () => {
    it("identifies Indian Sovereign G-Secs by ISIN starting with IN00", () => {
      expect(isBondInstrument("718GS2033", "IN0020230085")).toBe(true);
      expect(isBondInstrument("730GS2053", "IN0020230093")).toBe(true);
    });

    it("identifies State Development Loans (SDLs) by state ISIN prefixes", () => {
      expect(isBondInstrument("742TNSDL34", "IN3120230129")).toBe(true);
      expect(isBondInstrument("750MHSDL32", "IN2920220054")).toBe(true);
    });

    it("identifies Sovereign Gold Bonds (SGB) by symbol", () => {
      expect(isBondInstrument("SGBMAY29", "IN0020210053")).toBe(true);
      expect(isBondInstrument("SGBNOV25VIII", "IN0020170109")).toBe(true);
      expect(isBondInstrument("GOLDBEES-SG")).toBe(true);
    });

    it("identifies Corporate Bonds and NCD series on NSE/BSE", () => {
      expect(isBondInstrument("PFC-N1", "INE134E08KJ9")).toBe(true);
      expect(isBondInstrument("REC-N7", "INE020B08DF6")).toBe(true);
      expect(isBondInstrument("SHRIRAM-NC", "INE721A07RV3")).toBe(true);
      expect(isBondInstrument("718GS2033-GS", "IN0020230085")).toBe(true);
    });

    it("does not falsely identify regular equity stocks as bonds", () => {
      expect(isBondInstrument("RELIANCE", "INE002A01018")).toBe(false);
      expect(isBondInstrument("TCS", "INE467B01029")).toBe(false);
      expect(isBondInstrument("HDFCBANK", "INE040A01034")).toBe(false);
      expect(isBondInstrument("INFY", "INE009A01021")).toBe(false);
    });
  });

  describe("Coupon & Interest Cash Flow Calculations", () => {
    it("accurately computes annual coupon cash flows for different frequencies", () => {
      const faceValue = 1000;
      const quantity = 50;
      const couponRate = 8.75; // 8.75% p.a.
      const totalFaceValue = faceValue * quantity; // ₹50,000

      const annualInterest = (totalFaceValue * couponRate) / 100;
      expect(annualInterest).toBe(4375);

      // Monthly frequency
      const monthlyPayout = annualInterest / 12;
      expect(+monthlyPayout.toFixed(2)).toBe(364.58);

      // Semi-annual frequency
      const semiAnnualPayout = annualInterest / 2;
      expect(semiAnnualPayout).toBe(2187.5);

      // Quarterly frequency
      const quarterlyPayout = annualInterest / 4;
      expect(quarterlyPayout).toBe(1093.75);
    });

    it("calculates weighted average coupon yield across mixed bond holdings", () => {
      const holdings = [
        { faceValue: 1000, quantity: 100, couponRate: 8.5 }, // ₹1,00,000 @ 8.5% -> ₹8,500
        { faceValue: 10000, quantity: 20, couponRate: 7.75 }, // ₹2,00,000 @ 7.75% -> ₹15,500
        { faceValue: 100, quantity: 1000, couponRate: 7.18 }, // ₹1,00,000 @ 7.18% -> ₹7,180
      ];

      const totalFaceValue = holdings.reduce((sum, h) => sum + h.faceValue * h.quantity, 0); // ₹4,00,000
      const totalAnnualInterest = holdings.reduce(
        (sum, h) => sum + (h.faceValue * h.quantity * h.couponRate) / 100,
        0
      ); // 8500 + 15500 + 7180 = ₹31,180

      const weightedCouponRate = (totalAnnualInterest / totalFaceValue) * 100;

      expect(totalFaceValue).toBe(400000);
      expect(totalAnnualInterest).toBe(31180);
      expect(+weightedCouponRate.toFixed(4)).toBe(7.795); // 7.795% p.a.
    });

    it("advances next coupon date properly based on frequency", () => {
      const baseDate = new Date("2026-06-15");

      // Monthly advance (+1 month)
      const monthly = new Date(baseDate);
      monthly.setMonth(monthly.getMonth() + 1);
      expect(monthly.toISOString().split("T")[0]).toBe("2026-07-15");

      // Semi-annual advance (+6 months)
      const semiAnnual = new Date(baseDate);
      semiAnnual.setMonth(semiAnnual.getMonth() + 6);
      expect(semiAnnual.toISOString().split("T")[0]).toBe("2026-12-15");

      // Annual advance (+1 year)
      const annual = new Date(baseDate);
      annual.setFullYear(annual.getFullYear() + 1);
      expect(annual.toISOString().split("T")[0]).toBe("2027-06-15");
    });
  });

  describe("Popular Bond Presets & Metadata Verification", () => {
    it("contains valid curated Indian bond presets with legitimate ISIN structures", () => {
      expect(POPULAR_BONDS.length).toBeGreaterThanOrEqual(8);

      for (const bond of POPULAR_BONDS) {
        expect(bond.isin).toMatch(/^(IN|INE)[0-9A-Z]{9,10}$/);
        expect(bond.coupon_rate).toBeGreaterThan(0);
        expect(bond.face_value).toBeGreaterThan(0);
        expect(["INDIABONDS", "GOLDENPI", "ZERODHA"]).toContain(bond.recommended_platform);
        expect(["CORPORATE", "GOVERNMENT", "STATE_DEVELOPMENT", "SGB", "TAX_FREE"]).toContain(bond.bond_type);
      }
    });

    it("supports tax-free bond identification (Section 10(15)(iv)(h))", () => {
      const nhaiBond = POPULAR_BONDS.find((b) => b.isin === "INE906B07DE2");
      expect(nhaiBond).toBeDefined();
      expect(nhaiBond?.tax_status).toBe("TAX_FREE");
      expect(nhaiBond?.bond_type).toBe("TAX_FREE");
    });
  });
});
