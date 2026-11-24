import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/v1/integrations/gmail/sync/route";
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
  },
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
}));

describe("Gmail Statement Auto-Sync API Suite", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedSupabase = vi.mocked(supabaseAdmin);
  const mockedSync = vi.mocked(syncUserGmailStatements);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: null,
      userId: null,
      error: "No authorization header",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when Gmail integration is not configured or disconnected", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_test_1" } as any,
      userId: "user_test_1",
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.message || json.error).toMatch(/Gmail integration is not connected/i);
  });

  it("triggers syncUserGmailStatements and returns telemetry on successful sync", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_test_1" } as any,
      userId: "user_test_1",
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { sync_status: "ACTIVE", email_address: "finance@test.com" },
            error: null,
          }),
        }),
      }),
    });
    mockedSupabase.from = mockFrom as any;

    mockedSync.mockResolvedValueOnce({
      success: true,
      statementsCount: 3,
      transactionsImported: 45,
      duplicatesSkipped: 5,
      transfersMatched: 2,
      status: "COMPLETED",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxMessages: 25 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(mockedSync).toHaveBeenCalledWith("user_test_1", {
      maxMessages: 25,
      customQuery: undefined,
    });
    expect(json.success).toBe(true);
    expect(json.statementsCount).toBe(3);
    expect(json.transactionsImported).toBe(45);
  });

  it("passes lookbackDays and afterDate to syncUserGmailStatements when supplied", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_test_1" } as any,
      userId: "user_test_1",
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { sync_status: "ACTIVE", email_address: "finance@test.com" },
            error: null,
          }),
        }),
      }),
    });
    mockedSupabase.from = mockFrom as any;

    mockedSync.mockResolvedValueOnce({
      success: true,
      statementsCount: 1,
      transactionsImported: 10,
      duplicatesSkipped: 0,
      transfersMatched: 0,
      status: "COMPLETED",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lookbackDays: 90, afterDate: "2026/08/01" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockedSync).toHaveBeenCalledWith("user_test_1", {
      maxMessages: 30,
      customQuery: undefined,
      lookbackDays: 90,
      afterDate: "2026/08/01",
    });
  });

  it("POST returns partial status with enhanced password guidance hint", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_test_1" } as any,
      userId: "user_test_1",
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { sync_status: "ACTIVE", email_address: "finance@test.com" },
            error: null,
          }),
        }),
      }),
    });
    mockedSupabase.from = mockFrom as any;

    const sbiPasswordHint =
      "Password required for SBI statement(s). Hint: YONO uses DDMM@last 4 digits of mobile (e.g. 0101@9876); NetBanking uses DDMM + last 5 digits of mobile, or PAN. Add your details in Settings > Bank Passwords.";

    mockedSync.mockResolvedValueOnce({
      success: false,
      statementsCount: 2,
      transactionsImported: 12,
      duplicatesSkipped: 0,
      transfersMatched: 0,
      accountsCreated: ["SBI Credit Card"],
      failedCount: 1,
      status: "PARTIAL",
      error: sbiPasswordHint,
    });

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("PARTIAL");
    expect(json.error).toBe(sbiPasswordHint);
    expect(json.accountsCreated).toContain("SBI Credit Card");
  });

  it("GET returns current connection telemetry", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: { id: "user_test_1" } as any,
      userId: "user_test_1",
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "gmail_integrations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  email_address: "user@gmail.com",
                  sync_status: "ACTIVE",
                  last_sync_at: "2026-11-20T10:00:00Z",
                  error_details: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
        }),
      };
    });
    mockedSupabase.from = mockFrom as any;

    const req = new NextRequest("http://localhost:3000/api/v1/integrations/gmail/sync", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.connected).toBe(true);
    expect(json.email).toBe("user@gmail.com");
    expect(json.syncStatus).toBe("ACTIVE");
  });
});
