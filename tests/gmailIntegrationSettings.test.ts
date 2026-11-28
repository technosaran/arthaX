import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getGmailStatus, POST as connectGmail, DELETE as disconnectGmail } from "@/app/api/v1/integrations/gmail/route";
import { POST as syncGmail } from "@/app/api/v1/integrations/gmail/sync/route";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { syncUserGmailStatements } from "@/utils/gmail";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/utils/gmail", () => ({
  syncUserGmailStatements: vi.fn(),
  normalizeBankName: vi.fn((bank: string) => {
    if (/sbi|state\s*bank/i.test(bank)) return "SBI";
    return bank.toUpperCase();
  }),
}));

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

describe("Gmail Bank Statement Integration & Auto-Account Creation", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedSupabase = vi.mocked(supabaseAdmin);
  const mockedSync = vi.mocked(syncUserGmailStatements);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/v1/integrations/gmail returns disconnected status when no integration exists", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "gmail_integrations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "statement_password_hints") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail", { method: "GET" });
    const res = await getGmailStatus(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.connected).toBe(false);
    expect(json.syncStatus).toBe("DISCONNECTED");
    expect(json.passwordHintsCount).toBe(0);
  });

  it("POST /api/v1/integrations/gmail saves email and password hint as PENDING_AUTH when no OAuth tokens exist", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "gmail_integrations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "g_int_1",
                  user_id: "user_123",
                  email_address: "banking@gmail.com",
                  sync_status: "PENDING_AUTH",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "statement_password_hints") {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {};
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "banking@gmail.com",
        password_hint: "01011995",
        bank_name: "ALL",
      }),
    });

    const res = await connectGmail(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.connected).toBe(false);
    expect(json.email).toBe("banking@gmail.com");
    expect(json.syncStatus).toBe("PENDING_AUTH");
    expect(json.requiresAuth).toBe(true);
  });

  it("POST /api/v1/integrations/gmail preserves tokens and keeps status ACTIVE when updating email for existing OAuth integration", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    const realTokenEncrypted = "aes-gcm:real-google-access-token";

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "gmail_integrations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "g_int_1",
                  user_id: "user_123",
                  email_address: "old@gmail.com",
                  access_token_encrypted: realTokenEncrypted,
                  sync_status: "ACTIVE",
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "g_int_1",
                      user_id: "user_123",
                      email_address: "new@gmail.com",
                      access_token_encrypted: realTokenEncrypted,
                      sync_status: "ACTIVE",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new@gmail.com",
      }),
    });

    const res = await connectGmail(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.connected).toBe(true);
    expect(json.email).toBe("new@gmail.com");
    expect(json.syncStatus).toBe("ACTIVE");
    expect(json.requiresAuth).toBe(false);
  });

  it("POST /api/v1/integrations/gmail saves Banking Identity (PAN, DOB, Phone) and auto-generates permutations", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "statement_password_hints") {
        return { upsert: mockUpsert };
      }
      if (table === "gmail_integrations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {};
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pan: "ABCDE1234F",
        dob: "1995-08-15",
        phone: "9876543210",
      }),
    });

    const res = await connectGmail(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("DELETE /api/v1/integrations/gmail marks integration as DISCONNECTED", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "gmail_integrations") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      return {};
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail", { method: "DELETE" });
    const res = await disconnectGmail(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.connected).toBe(false);
  });

  it("POST /api/v1/integrations/gmail/sync discovers SBI statement and returns auto-created account cards", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "gmail_integrations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  sync_status: "ACTIVE",
                  email_address: "banking@gmail.com",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
    mockedSupabase.from = mockFrom as any;

    mockedSync.mockResolvedValueOnce({
      success: true,
      status: "COMPLETED",
      statementsCount: 1,
      transactionsImported: 3,
      transactionsExtracted: 3,
      duplicatesSkipped: 0,
      accountsCreated: ["SBI Savings Account"],
      details: {
        bank: "SBI",
        closingBalance: 72500,
      },
    });

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await syncGmail(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.statementsCount).toBe(1);
    expect(json.transactionsExtracted).toBe(3);
    expect(json.accountsCreated).toEqual(["SBI Savings Account"]);
  });
});
