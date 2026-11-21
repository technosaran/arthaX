import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as handleAutomationCronGet, POST as handleAutomationCronPost } from "@/app/api/v1/automation/cron/route";

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
      neq: vi.fn().mockResolvedValue({
        data: [
          {
            user_id: "user-123",
            email_address: "test@example.com",
            sync_status: "ACTIVE",
          },
        ],
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "job-123" }, error: null }),
    }),
  },
}));

vi.mock("@/utils/rateLimit", () => ({
  checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/utils/gmail", () => ({
  syncUserGmailStatements: vi.fn().mockResolvedValue({
    success: true,
    statementsCount: 1,
    transactionsImported: 15,
    duplicatesSkipped: 2,
  }),
}));

describe("Universal Automation Cron Route Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-cron-secret-12345" };
  });

  it("rejects unauthorized cron triggers with 401 when Bearer secret is wrong", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    delete (process.env as any).VITEST;

    const req = new NextRequest("http://localhost:3000/api/v1/automation/cron", {
      method: "GET",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });

    const res = await handleAutomationCronGet(req);
    expect(res.status).toBe(401);
  });

  it("handles valid GET requests from Vercel Crons with Bearer CRON_SECRET", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/automation/cron", {
      method: "GET",
      headers: {
        authorization: "Bearer test-cron-secret-12345",
      },
    });

    const res = await handleAutomationCronGet(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("completed");
    expect(json.processedUsers).toBe(1);
    expect(json.results[0].transactionsImported).toBe(15);
  });

  it("handles valid POST requests from external cron invokers", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/automation/cron", {
      method: "POST",
      headers: {
        authorization: "Bearer test-cron-secret-12345",
      },
    });

    const res = await handleAutomationCronPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("completed");
  });

  it("reports failed status when all user synchronizations fail", async () => {
    const { syncUserGmailStatements } = await import("@/utils/gmail");
    vi.mocked(syncUserGmailStatements).mockResolvedValueOnce({
      success: false,
      statementsCount: 1,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      error: "PASSWORD_REQUIRED: Decryption password missing",
    });

    const req = new NextRequest("http://localhost:3000/api/v1/automation/cron", {
      method: "GET",
      headers: {
        authorization: "Bearer test-cron-secret-12345",
      },
    });

    const res = await handleAutomationCronGet(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("failed");
    expect(json.results[0].success).toBe(false);
    expect(json.results[0].error).toContain("PASSWORD_REQUIRED");
  });

  describe("computeNextRunDate Schedule Integrity", () => {
    it("correctly clamps January 31st to February 28th/29th without skipping February", async () => {
      const { computeNextRunDate } = await import("@/app/api/v1/jobs/recurring/route");
      // Non-leap year 2026: Jan 31 -> Feb 28
      expect(computeNextRunDate("2026-01-31", "monthly")).toBe("2026-02-28");
      // Leap year 2024: Jan 31 -> Feb 29
      expect(computeNextRunDate("2024-01-31", "monthly")).toBe("2024-02-29");
      // March 31 quarterly -> June 30
      expect(computeNextRunDate("2026-03-31", "quarterly")).toBe("2026-06-30");
      // Daily
      expect(computeNextRunDate("2026-02-28", "daily")).toBe("2026-03-01");
      // Weekly
      expect(computeNextRunDate("2026-02-25", "weekly")).toBe("2026-03-04");
      // Yearly
      expect(computeNextRunDate("2024-02-29", "yearly")).toBe("2025-02-28");
    });
  });
});
