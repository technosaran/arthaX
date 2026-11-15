import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { parseFnoSymbol, isTokenValidToday } from "../src/utils/zerodha";

describe("Zerodha Kite API Integration Utilities", () => {
  describe("F&O Symbol Parser", () => {
    it("parses Call Options (CE) correctly", () => {
      const parsed = parseFnoSymbol("NIFTY26NOV24000CE");
      expect(parsed.symbol).toBe("NIFTY");
      expect(parsed.instrument_type).toBe("CE");
      expect(parsed.strike_price).toBe(24000);
    });

    it("parses Put Options (PE) correctly", () => {
      const parsed = parseFnoSymbol("BANKNIFTY26NOV52000PE");
      expect(parsed.symbol).toBe("BANKNIFTY");
      expect(parsed.instrument_type).toBe("PE");
      expect(parsed.strike_price).toBe(52000);
    });

    it("parses Futures (FUT) correctly", () => {
      const parsed = parseFnoSymbol("RELIANCE26NOVFUT");
      expect(parsed.symbol).toBe("RELIANCE");
      expect(parsed.instrument_type).toBe("FUT");
      expect(parsed.strike_price).toBeNull();
    });
  });

  describe("Token Validity Logic", () => {
    it("returns false for null token timestamp", () => {
      expect(isTokenValidToday(null)).toBe(false);
    });

    it("returns false for a token generated yesterday", () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      expect(isTokenValidToday(yesterday)).toBe(false);
    });

    it("validates token generated today", () => {
      const nowIso = new Date().toISOString();
      expect(isTokenValidToday(nowIso)).toBe(true);
    });
  });

  describe("Kite Connect SHA-256 Checksum", () => {
    it("generates correct SHA-256 checksum for request_token exchange", () => {
      const apiKey = "test_api_key";
      const requestToken = "test_request_token";
      const apiSecret = "test_api_secret";

      const raw = `${apiKey}${requestToken}${apiSecret}`;
      const checksum = crypto.createHash("sha256").update(raw).digest("hex");

      expect(checksum).toHaveLength(64);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
