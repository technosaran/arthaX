import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { GET as getBankPasswords, POST as saveBankPassword, DELETE as deleteBankPassword } from "@/app/api/v1/user/bank-passwords/route";
import { POST as syncGmail } from "@/app/api/v1/integrations/gmail/sync/route";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { syncUserGmailStatements, fetchUserPasswordCandidates } from "@/utils/gmail";
import { getBankPasswordFormatDescription } from "@/utils/bankPasswords";
import { encryptSensitiveData, decryptSensitiveData } from "@/utils/crypto";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/utils/gmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/gmail")>();
  return {
    ...actual,
    syncUserGmailStatements: vi.fn(),
  };
});

vi.mock("@/utils/redis", () => ({
  invalidateCachedData: vi.fn().mockResolvedValue(true),
  getUserCacheKey: vi.fn((uid, key) => `user:${uid}:${key}`),
  CACHE_KEYS: {
    ACCOUNTS: "accounts",
    EXPENSES: "expenses",
    INCOME: "income",
    PORTFOLIO: "portfolio",
    LEDGER: "ledger",
    TRANSFERS: "transfers",
    ANALYTICS: "analytics",
  },
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
}));

describe("Bank Statement Decryption & Password Storage Suite", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedSupabase = vi.mocked(supabaseAdmin);
  const mockedSync = vi.mocked(syncUserGmailStatements);
  const userId = "usr-test-decrypt-99";
  const mockUser = { id: userId } as unknown as User;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bank Password Format Descriptions & Hints", () => {
    it("provides accurate format instructions for Indian Bank", () => {
      const hint = getBankPasswordFormatDescription("INDIAN_BANK");
      expect(hint.toLowerCase()).toContain("account number");
      expect(hint.toLowerCase()).toContain("ddmmyyyy");
    });

    it("provides accurate format instructions for SBI", () => {
      const hint = getBankPasswordFormatDescription("SBI");
      expect(hint.toLowerCase()).toContain("yono");
      expect(hint).toContain("@");
    });

    it("provides accurate format instructions for HDFC, ICICI, Axis, Kotak", () => {
      expect(getBankPasswordFormatDescription("HDFC").toLowerCase()).toContain("customer id");
      expect(getBankPasswordFormatDescription("ICICI").toLowerCase()).toContain("first 4 letters of name");
      expect(getBankPasswordFormatDescription("AXIS").toLowerCase()).toContain("pan");
      expect(getBankPasswordFormatDescription("KOTAK").toLowerCase()).toContain("crn");
    });
  });

  describe("/api/v1/user/bank-passwords API Endpoint", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: null,
        userId: null,
        error: "Missing authorization",
      });

      const req = new NextRequest("http://localhost:3000/api/v1/user/bank-passwords", { method: "GET" });
      const res = await getBankPasswords(req);
      expect(res.status).toBe(401);
    });

    it("GET returns configured bank passwords without leaking plaintext secrets", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: mockUser,
        userId,
        error: null,
      });

      mockedSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "hint-1",
                bank_name: "INDIAN_BANK",
                hint_pattern: "BANK_PASSWORD",
                created_at: "2026-11-20T10:00:00Z",
                updated_at: "2026-11-20T10:00:00Z",
              },
              {
                id: "hint-2",
                bank_name: "SBI",
                hint_pattern: "BANK_PASSWORD",
                created_at: "2026-11-21T10:00:00Z",
                updated_at: "2026-11-21T10:00:00Z",
              },
            ],
            error: null,
          }),
        }),
      }) as any;

      const req = new NextRequest("http://localhost:3000/api/v1/user/bank-passwords", { method: "GET" });
      const res = await getBankPasswords(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.bankPasswords).toHaveLength(2);
      expect(json.data.bankPasswords[0].bank).toBe("INDIAN_BANK");
      expect(json.data.bankPasswords[0].configured).toBe(true);
      expect(json.data.bankPasswords[1].bank).toBe("SBI");
      // Ensure no encrypted_secret or raw password is leaked in response
      expect(json.data.bankPasswords[0]).not.toHaveProperty("encrypted_secret");
      expect(json.data.bankPasswords[0]).not.toHaveProperty("password");
    });

    it("POST encrypts and stores bank password in statement_password_hints", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: mockUser,
        userId,
        error: null,
      });

      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      mockedSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        insert: mockInsert,
      }) as any;

      const req = new NextRequest("http://localhost:3000/api/v1/user/bank-passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank: "INDIAN_BANK",
          password: "010119951234",
        }),
      });

      const res = await saveBankPassword(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.savedBanks).toContain("INDIAN_BANK");

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const insertedRow = mockInsert.mock.calls[0][0];
      expect(insertedRow.user_id).toBe(userId);
      expect(insertedRow.bank_name).toBe("INDIAN_BANK");
      expect(insertedRow.hint_pattern).toBe("BANK_PASSWORD");
      // Verify stored secret is encrypted and decryptable
      const decrypted = decryptSensitiveData(insertedRow.encrypted_secret, "statement-passwords");
      expect(decrypted).toBe("010119951234");
    });

    it("DELETE removes stored bank statement password hint", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: mockUser,
        userId,
        error: null,
      });

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });
      mockedSupabase.from = vi.fn().mockReturnValue({
        delete: mockDelete,
      }) as any;

      const req = new NextRequest("http://localhost:3000/api/v1/user/bank-passwords?bank=INDIAN_BANK", {
        method: "DELETE",
      });

      const res = await deleteBankPassword(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("Gmail Sync Password Flow & Modal Integration", () => {
    it("returns PASSWORD_REQUIRED with structured passwordBanks when statements fail decryption", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: mockUser,
        userId,
        error: null,
      });

      mockedSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { sync_status: "ACTIVE", email_address: "finance@test.com" },
              error: null,
            }),
          }),
        }),
      }) as any;

      mockedSync.mockResolvedValueOnce({
        success: false,
        statementsCount: 2,
        transactionsImported: 0,
        transactionsExtracted: 0,
        duplicatesSkipped: 0,
        accountsCreated: [],
        failedCount: 2,
        status: "FAILED",
        error: "Password required for INDIAN_BANK, SBI statement(s).",
        passwordRequired: true,
        passwordBanks: ["INDIAN_BANK", "SBI"],
        passwordHints: {
          INDIAN_BANK: "Indian Bank uses your full Account Number (e.g. 10-16 digits)",
          SBI: "YONO uses DDMM@last 4 digits of mobile (e.g. 0101@9876)",
        },
      });

      const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookbackDays: 30 }),
      });

      const res = await syncGmail(req);
      // Status is 422 Unprocessable Content for PASSWORD_REQUIRED
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("PASSWORD_REQUIRED");
      expect(json.error.message).toContain("Password required for INDIAN_BANK, SBI");
      expect(json.error.details.passwordRequired).toBe(true);
      expect(json.error.details.passwordBanks).toEqual(["INDIAN_BANK", "SBI"]);
      expect(json.error.details.passwordHints).toHaveProperty("INDIAN_BANK");
      expect(json.error.details.passwordHints).toHaveProperty("SBI");
    });

    it("accepts bankPasswords in sync POST request and passes them to syncUserGmailStatements", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: mockUser,
        userId,
        error: null,
      });

      mockedSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { sync_status: "ACTIVE", email_address: "finance@test.com" },
              error: null,
            }),
          }),
        }),
      }) as any;

      mockedSync.mockResolvedValueOnce({
        success: true,
        statementsCount: 2,
        transactionsImported: 35,
        transactionsExtracted: 35,
        duplicatesSkipped: 0,
        accountsCreated: ["Indian Bank Account", "SBI Savings Account"],
        failedCount: 0,
        status: "COMPLETED",
      });

      const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookbackDays: 30,
          bankPasswords: {
            INDIAN_BANK: "123456789012",
            SBI: "0101@9876",
          },
          storePasswords: true,
        }),
      });

      const res = await syncGmail(req);
      expect(res.status).toBe(200);

      expect(mockedSync).toHaveBeenCalledWith(userId, {
        maxMessages: 30,
        lookbackDays: 30,
        customQuery: undefined,
        bankPasswords: {
          INDIAN_BANK: "123456789012",
          SBI: "0101@9876",
        },
        storePasswords: true,
      });

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.statementsCount).toBe(2);
      expect(json.transactionsImported).toBe(35);
      expect(json.accountsCreated).toContain("Indian Bank Account");
      expect(json.accountsCreated).toContain("SBI Savings Account");
    });
  });

  describe("Candidate Generation with Stored Custom Bank Passwords", () => {
    it("prioritizes stored custom bank passwords first in password candidates", async () => {
      const customIndianBankPwd = "123456789012";
      const customSbiPwd = "0101@9876";

      const encIndianBank = encryptSensitiveData(customIndianBankPwd, "statement-passwords");
      const encSbi = encryptSensitiveData(customSbiPwd, "statement-passwords");

      mockedSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { encrypted_secret: encIndianBank, hint_pattern: "BANK_PASSWORD" },
              { encrypted_secret: encSbi, hint_pattern: "BANK_PASSWORD" },
            ],
            error: null,
          }),
        }),
      }) as any;

      const candidates = await fetchUserPasswordCandidates(userId);

      expect(candidates[0]).toBe(customIndianBankPwd);
      expect(candidates[1]).toBe(customSbiPwd);
      expect(candidates.length).toBeLessThanOrEqual(20);
    });
  });

  describe("UI Component Integration Integrity", () => {
    it("verifies StatementPasswordModal exists and has required prop interface", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const modalPath = path.resolve(__dirname, "../src/components/StatementPasswordModal.tsx");
      expect(fs.existsSync(modalPath)).toBe(true);

      const modalSource = fs.readFileSync(modalPath, "utf-8");
      expect(modalSource).toContain("export interface StatementPasswordModalProps");
      expect(modalSource).toContain("banks: string[]");
      expect(modalSource).toContain("onDecrypt:");
      expect(modalSource).toContain("Store securely for future statements");
      expect(modalSource).toContain("Decrypt & Import");
    });

    it("verifies SettingsSection integrates StatementPasswordModal and bank passwords", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const settingsPath = path.resolve(__dirname, "../src/components/SettingsSection.tsx");
      const settingsSource = fs.readFileSync(settingsPath, "utf-8");

      expect(settingsSource).toContain("StatementPasswordModal");
      expect(settingsSource).toContain("passwordModalState");
      expect(settingsSource).toContain("handleDecryptModalSubmit");
      expect(settingsSource).toContain("Stored Bank Decryption Passwords");
      expect(settingsSource).toContain("handleSaveCustomBankPassword");
    });
  });
});
