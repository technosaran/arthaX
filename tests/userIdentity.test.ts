import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getUserIdentity, POST as saveUserIdentity } from "@/app/api/v1/user/identity/route";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { encryptSensitiveData } from "@/utils/crypto";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/utils/redis", () => ({
  invalidateCachedData: vi.fn().mockResolvedValue(true),
  getUserCacheKey: vi.fn((uid, key) => `user:${uid}:${key}`),
  CACHE_KEYS: {
    ACCOUNTS: "accounts",
    PORTFOLIO: "portfolio",
    LEDGER: "ledger",
  },
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
}));

describe("User Identity & Basic Details API Suite", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedSupabase = vi.mocked(supabaseAdmin);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/user/identity returns masked details when identity exists", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_test_1" } as any,
      userId: "user_test_1",
      error: null,
    });

    const encryptedIdentity = encryptSensitiveData(
      JSON.stringify({ pan: "ABCDE1234F", dob: "1995-01-15", phone: "9876543210" }),
      "statement-passwords"
    );

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "statement_password_hints") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "hint_1",
                  bank_name: "ALL",
                  hint_pattern: "BANKING_IDENTITY",
                  encrypted_secret: encryptedIdentity,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/user/identity", { method: "GET" });
    const res = await getUserIdentity(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.bankingIdentity.hasPan).toBe(true);
    expect(json.data.bankingIdentity.panMasked).toBe("AB****4F");
    expect(json.data.bankingIdentity.hasDob).toBe(true);
    expect(json.data.bankingIdentity.dobMasked).toBe("****-**-15");
    expect(json.data.bankingIdentity.hasPhone).toBe(true);
    expect(json.data.bankingIdentity.phoneMasked).toBe("******3210");
  });

  it("POST /api/v1/user/identity encrypts and saves basic details and updates name", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_test_1" } as any,
      userId: "user_test_1",
      error: null,
    });

    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "statement_password_hints") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: upsertSpy,
        };
      }
      if (table === "user_settings") {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {};
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/user/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alex Morgan",
        pan: "ABCDE1234F",
        dob: "1995-01-15",
        phone: "9876543210",
      }),
    });

    const res = await saveUserIdentity(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(upsertSpy).toHaveBeenCalled();
  });
});
