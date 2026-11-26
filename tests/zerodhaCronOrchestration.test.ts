import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("Zerodha Multi-Owner Session Deduplication & Unified Automation Cron", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    (process.env as Record<string, string>).NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("calls performZerodhaAutoLogin only once when multiple authorized users share the same Kite account", async () => {
    process.env.ZERODHA_AUTHORIZED_USER_ID = "user-one,user-two";
    process.env.ZERODHA_USER_ID = "AB1234";
    process.env.ZERODHA_PASSWORD = "pw";
    process.env.ZERODHA_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    process.env.ZERODHA_API_KEY = "kite_key_1";
    process.env.ZERODHA_API_SECRET = "kite_secret_1";

    const performMock = vi.fn().mockResolvedValue({
      success: true,
      accessToken: "fresh-token-xyz",
      publicToken: "pub-token",
      requestToken: "req-token",
      profile: { client_id: "AB1234", user_name: "Test User" },
    });

    const syncMock = vi.fn().mockResolvedValue({
      success: true,
      stocksSynced: 3,
      bondsSynced: 1,
      fnoSynced: 0,
      mfSynced: 2,
      walletBalance: 500,
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    vi.doMock("@/utils/supabase/admin", () => ({
      supabaseAdmin: {
        from: vi.fn().mockReturnValue({
          upsert: upsertMock,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      },
    }));

    vi.doMock("@/utils/zerodha", () => ({
      getZerodhaIntegration: vi.fn().mockResolvedValue({
        configured: true,
        connected: false,
        isTokenExpired: true,
        integration: {
          id: "int-1",
          user_id: "user-one",
          api_key: "kite_key_1",
          api_secret: "kite_secret_1",
          access_token: null,
          public_token: null,
          request_token: null,
          token_generated_at: null,
          user_profile: null,
          last_sync_at: null,
          last_sync_status: null,
          last_sync_error: null,
          last_sync_summary: null,
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      }),
      syncAllZerodhaSections: syncMock,
    }));

    vi.doMock("@/utils/zerodhaAutoLogin", async () => {
      const actual = await vi.importActual<typeof import("@/utils/zerodhaAutoLogin")>("@/utils/zerodhaAutoLogin");
      return {
        ...actual,
        performZerodhaAutoLogin: performMock,
      };
    });

    const { runZerodhaCronSync } = await import("@/utils/zerodhaCron");
    const summary = await runZerodhaCronSync({ skipLock: true });

    expect(summary.success).toBe(true);
    expect(summary.status).toBe("completed");
    expect(summary.results).toHaveLength(2);
    expect(summary.results.every((r) => r.autoLoginSuccess && r.syncSuccess)).toBe(true);
    expect(performMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(syncMock).toHaveBeenCalledTimes(2);
    expect(syncMock).toHaveBeenNthCalledWith(1, "user-one");
    expect(syncMock).toHaveBeenNthCalledWith(2, "user-two");
  });

  it("awaits runRecurringJobs and runZerodhaCronSync in-process during unified automation cron", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    process.env.RUN_SUB_CRONS_IN_TEST = "1";

    const runRecurringMock = vi.fn().mockResolvedValue({
      success: true,
      processed: 2,
    });
    const runZerodhaMock = vi.fn().mockResolvedValue({
      status: "completed",
      success: true,
      results: [{ userId: "user-one", autoLoginSuccess: true, syncSuccess: true, stocksSynced: 5 }],
      timestamp: new Date().toISOString(),
    });

    vi.doMock("@/utils/recurringJobs", () => ({
      runRecurringJobs: runRecurringMock,
      computeNextRunDate: vi.fn(),
    }));

    vi.doMock("@/utils/zerodhaCron", () => ({
      runZerodhaCronSync: runZerodhaMock,
    }));

    vi.doMock("@/utils/supabase/admin", () => ({
      supabaseAdmin: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({ data: [], error: null }),
          neq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      },
    }));

    vi.doMock("@/utils/rateLimit", () => ({
      checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
    }));

    const { GET } = await import("@/app/api/v1/automation/cron/route");
    const req = new NextRequest("https://arthax.vercel.app/api/v1/automation/cron", {
      method: "GET",
      headers: { authorization: "Bearer cron-secret-123" },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(runRecurringMock).toHaveBeenCalledTimes(1);
    expect(runZerodhaMock).toHaveBeenCalledTimes(1);
    expect(body.recurringJobs).toEqual({ success: true, processed: 2 });
    expect(body.zerodhaSync.success).toBe(true);
    expect(body.zerodhaSync.results[0].stocksSynced).toBe(5);
  });

  it("queries api_key (not api_key_encrypted) in /api/v1/automation/status", async () => {
    const selectedCols: string[] = [];

    vi.doMock("@/utils/auth", () => ({
      getAuthenticatedUser: vi.fn().mockResolvedValue({
        user: { id: "user-1" },
        userId: "user-1",
        error: null,
      }),
    }));

    vi.doMock("@/utils/supabase/admin", () => ({
      supabaseAdmin: {
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockImplementation((cols: string) => {
            if (table === "zerodha_integrations") selectedCols.push(cols);
            return {
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "z-1", api_key: "key" }, error: null }),
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
                then: (resolve: (v: { data: never[]; count: number }) => void) =>
                  resolve({ data: [], count: 0 }),
              }),
            };
          }),
        })),
      },
    }));

    const { GET } = await import("@/app/api/v1/automation/status/route");
    const req = new NextRequest("https://arthax.vercel.app/api/v1/automation/status");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(selectedCols[0]).toContain("api_key");
    expect(selectedCols[0]).not.toContain("api_key_encrypted");
  });
});
