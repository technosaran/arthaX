import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  base32Decode,
  generateTOTP,
  mergeCookies,
  getAutoLoginCredentials,
  performZerodhaAutoLogin,
} from "../src/utils/zerodhaAutoLogin";

describe("Zerodha Automated TOTP & Auto-Login Utilities", () => {
  describe("Base32 Decoding", () => {
    it("decodes valid Base32 strings correctly", () => {
      // "JBSWY3DPEHPK3PXP" is Base32 for "Hello!\xde\xad\xbe\xef"
      const buf = base32Decode("JBSWY3DPEHPK3PXP");
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBe(10);
    });

    it("handles whitespace, hyphens, and lowercase characters", () => {
      const clean = base32Decode("jbsw y3dp-ehpk 3pxp==");
      const standard = base32Decode("JBSWY3DPEHPK3PXP");
      expect(clean.equals(standard)).toBe(true);
    });

    it("returns empty buffer for invalid or empty input", () => {
      const buf = base32Decode("");
      expect(buf.length).toBe(0);
    });
  });

  describe("RFC 6238 TOTP Standard Test Vectors", () => {
    // Standard RFC 6238 test key: "12345678901234567890" -> Base32: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    it("computes correct 6-digit TOTP at T=59s (vector 1)", () => {
      const code = generateTOTP(rfcSecret, 59 * 1000);
      expect(code).toBe("287082");
    });

    it("computes correct 6-digit TOTP at T=1111111109s (vector 2)", () => {
      const code = generateTOTP(rfcSecret, 1111111109 * 1000);
      expect(code).toBe("081804");
    });

    it("computes correct 6-digit TOTP at T=1234567890s (vector 3)", () => {
      const code = generateTOTP(rfcSecret, 1234567890 * 1000);
      expect(code).toBe("005924");
    });

    it("always produces a 6-digit numeric string with zero-padding", () => {
      const code = generateTOTP(rfcSecret, Date.now());
      expect(code).toMatch(/^\d{6}$/);
    });

    it("throws error for empty secret", () => {
      expect(() => generateTOTP("")).toThrow("Invalid or empty Base32 TOTP secret key");
    });
  });

  describe("Cookie Merging", () => {
    it("merges initial and incoming Set-Cookie headers properly", () => {
      const existing = "kf_session=abc1234; user_id=AB1234";
      const newHeaders = [
        "public_token=xyz789; Path=/; Secure; HttpOnly",
        "enctoken=token555; Domain=kite.zerodha.com",
      ];
      const merged = mergeCookies(existing, newHeaders);
      expect(merged).toContain("kf_session=abc1234");
      expect(merged).toContain("user_id=AB1234");
      expect(merged).toContain("public_token=xyz789");
      expect(merged).toContain("enctoken=token555");
    });

    it("overwrites existing cookie when matching key is updated", () => {
      const existing = "kf_session=old_val; user_id=AB1234";
      const newHeaders = ["kf_session=new_val; Path=/"];
      const merged = mergeCookies(existing, newHeaders);
      expect(merged).toContain("kf_session=new_val");
      expect(merged).not.toContain("kf_session=old_val");
    });
  });

  describe("Auto-Login Credentials Extractor", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("returns null when environment variables are not set", () => {
      delete process.env.ZERODHA_USER_ID;
      delete process.env.ZERODHA_PASSWORD;
      delete process.env.ZERODHA_TOTP_SECRET;
      expect(getAutoLoginCredentials(null)).toBeNull();
    });

    it("extracts credentials when all required env vars are present", () => {
      process.env.ZERODHA_USER_ID = "AB1234";
      process.env.ZERODHA_PASSWORD = "secret_password";
      process.env.ZERODHA_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
      process.env.ZERODHA_API_KEY = "test_api_key";
      process.env.ZERODHA_API_SECRET = "test_api_secret";

      const creds = getAutoLoginCredentials(null);
      expect(creds).not.toBeNull();
      expect(creds?.userId).toBe("AB1234");
      expect(creds?.password).toBe("secret_password");
      expect(creds?.totpSecret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
      expect(creds?.apiKey).toBe("test_api_key");
      expect(creds?.apiSecret).toBe("test_api_secret");
    });

    it("prevents other users from accessing credentials if ZERODHA_AUTHORIZED_USER_ID is set", () => {
      process.env.ZERODHA_AUTHORIZED_USER_ID = "owner-uuid-1234";
      process.env.ZERODHA_USER_ID = "AB1234";
      process.env.ZERODHA_PASSWORD = "secret_password";
      process.env.ZERODHA_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
      process.env.ZERODHA_API_KEY = "test_api_key";
      process.env.ZERODHA_API_SECRET = "test_api_secret";

      // Stranger user
      const strangerCreds = getAutoLoginCredentials(null, "stranger-uuid-5678");
      expect(strangerCreds).toBeNull();

      // Owner user
      const ownerCreds = getAutoLoginCredentials(null, "owner-uuid-1234");
      expect(ownerCreds).not.toBeNull();
      expect(ownerCreds?.userId).toBe("AB1234");

      // Multiple comma-separated authorized user IDs
      process.env.ZERODHA_AUTHORIZED_USER_ID = "owner-uuid-1234, second-owner-uuid-5678";
      const secondOwnerCreds = getAutoLoginCredentials(null, "second-owner-uuid-5678");
      expect(secondOwnerCreds).not.toBeNull();
      expect(secondOwnerCreds?.userId).toBe("AB1234");

      const thirdStrangerCreds = getAutoLoginCredentials(null, "unauthorized-stranger-9999");
      expect(thirdStrangerCreds).toBeNull();
    });
  });

  describe("Safety & Error Handling in performZerodhaAutoLogin", () => {
    it("fails gracefully and stops without looping if required fields are missing", async () => {
      const result = await performZerodhaAutoLogin({
        userId: "",
        password: "",
        totpSecret: "",
        apiKey: "api_key",
        apiSecret: "api_secret",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required auto-login credentials");
    });

    it("aborts safely if Zerodha rejects step 1 password authentication", async () => {
      vi.spyOn(global, "fetch").mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            status: "error",
            message: "Invalid username or password.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      });

      const result = await performZerodhaAutoLogin({
        userId: "WRONG_USER",
        password: "WRONG_PASSWORD",
        totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        apiKey: "test_key",
        apiSecret: "test_secret",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Zerodha authentication failed: Invalid username or password.");
      vi.restoreAllMocks();
    });
  });
});
