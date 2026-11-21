import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as uploadStatement } from "@/app/api/v1/statements/upload/route";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/utils/redis", () => ({
  invalidateCachedData: vi.fn().mockResolvedValue(true),
  getUserCacheKey: vi.fn((uid, key) => `arthax:cache:${uid}:${key}`),
  CACHE_KEYS: {
    ACCOUNTS: "accounts",
    EXPENSES: "expenses",
    INCOME: "income",
    PORTFOLIO: "portfolio",
    LEDGER: "ledger",
    TRANSFERS: "transfers",
  },
}));

vi.mock("@/utils/transfers", () => ({
  reconcileInternalTransfers: vi.fn().mockResolvedValue({
    success: true,
    transfersReconciled: 0,
    expensesCleaned: 0,
    incomeCleaned: 0,
  }),
}));

vi.mock("@/utils/supabase/admin", () => {
  const mockFrom = vi.fn();
  return {
    supabaseAdmin: {
      from: mockFrom,
    },
  };
});

describe("Account Balance Reconciliation & Out-of-Order Import Suite", () => {
  const userId = "usr-balance-reconcile-test";
  const targetAccountId = "acc-sbi-reconcile-999";

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  function createChainedMock(options?: {
    singleData?: any;
    maybeSingleData?: any;
    queryData?: any[];
    onUpdate?: (data: any) => void;
  }) {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation((data: any) => {
        if (options?.onUpdate) options.onUpdate(data);
        return chain;
      }),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => Promise.resolve({ data: options?.queryData ?? [], error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: options?.maybeSingleData ?? null, error: null })),
      single: vi.fn().mockImplementation(() => Promise.resolve({ data: options?.singleData ?? { id: "test-stmt-id" }, error: null })),
    };
    return chain;
  }

  it("updates account balance when uploading the latest verified statement", async () => {
    const { getAuthenticatedUser } = await import("@/utils/auth");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: userId } as any,
      userId,
      error: null,
    });

    // Mock Python backend calculation response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          bank_name: "SBI",
          parser_version: "2.1.0",
          metadata: {
            statement_period_start: "2026-02-01",
            statement_period_end: "2026-02-28",
            opening_balance: 50000,
            closing_balance: 75000,
          },
          validation: {
            is_valid: true,
            total_credits: 30000,
            total_debits: 5000,
            errors: [],
          },
          transactions: [],
        },
      }),
    } as any);

    let updatedAccountBalance: number | null = null;

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return createChainedMock({
          onUpdate: (data) => {
            updatedAccountBalance = data.balance;
          },
        });
      }
      if (table === "bank_statements") {
        return createChainedMock({
          maybeSingleData: null, // No duplicate file
          singleData: { id: "stmt-feb-2026" },
          queryData: [], // No newer statements exist
        });
      }
      return createChainedMock();
    });

    const formData = new FormData();
    formData.append("file", new File(["test pdf content"], "sbi_feb_2026.pdf", { type: "application/pdf" }));
    formData.append("accountId", targetAccountId);

    const req = new NextRequest("http://localhost:3000/api/v1/statements/upload", {
      method: "POST",
      body: formData,
    });

    const res = await uploadStatement(req);
    expect(res.status).toBe(200);

    // Verified: Account balance was updated to 75000
    expect(updatedAccountBalance).toBe(75000);
  });

  it("preserves newer account balance when an older statement is uploaded out-of-order", async () => {
    const { getAuthenticatedUser } = await import("@/utils/auth");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: userId } as any,
      userId,
      error: null,
    });

    // Mock Python backend calculation response for older statement (January 2026)
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          bank_name: "SBI",
          parser_version: "2.1.0",
          metadata: {
            statement_period_start: "2026-01-01",
            statement_period_end: "2026-01-31", // Older period
            opening_balance: 40000,
            closing_balance: 50000, // Should NOT overwrite Feb balance
          },
          validation: {
            is_valid: true,
            total_credits: 15000,
            total_debits: 5000,
            errors: [],
          },
          transactions: [],
        },
      }),
    } as any);

    let accountUpdated = false;

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return createChainedMock({
          onUpdate: () => {
            accountUpdated = true;
          },
        });
      }
      if (table === "bank_statements") {
        return createChainedMock({
          maybeSingleData: null, // No duplicate file
          singleData: { id: "stmt-jan-2026" },
          queryData: [{ id: "stmt-feb-2026", period_end: "2026-02-28" }], // A newer verified statement exists!
        });
      }
      return createChainedMock();
    });

    const formData = new FormData();
    formData.append("file", new File(["test pdf content"], "sbi_jan_2026.pdf", { type: "application/pdf" }));
    formData.append("accountId", targetAccountId);

    const req = new NextRequest("http://localhost:3000/api/v1/statements/upload", {
      method: "POST",
      body: formData,
    });

    const res = await uploadStatement(req);
    expect(res.status).toBe(200);

    // Verified: Account balance was NOT updated because a newer verified statement exists!
    expect(accountUpdated).toBe(false);
  });

  it("does not update account balance when statement validation fails with discrepancy", async () => {
    const { getAuthenticatedUser } = await import("@/utils/auth");
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: userId } as any,
      userId,
      error: null,
    });

    // Mock statement with mathematical discrepancy (validation.is_valid = false)
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          bank_name: "SBI",
          parser_version: "2.1.0",
          metadata: {
            statement_period_start: "2026-03-01",
            statement_period_end: "2026-03-31",
            opening_balance: 50000,
            closing_balance: 999999, // Unverified closing balance
          },
          validation: {
            is_valid: false,
            total_credits: 10000,
            total_debits: 2000,
            errors: ["Mathematical discrepancy: opening + credits - debits != closing"],
          },
          transactions: [],
        },
      }),
    } as any);

    let accountUpdated = false;

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return createChainedMock({
          onUpdate: () => {
            accountUpdated = true;
          },
        });
      }
      if (table === "bank_statements") {
        return createChainedMock({
          maybeSingleData: null,
          singleData: { id: "stmt-discrepancy" },
        });
      }
      return createChainedMock();
    });

    const formData = new FormData();
    formData.append("file", new File(["test pdf content"], "sbi_mar_2026.pdf", { type: "application/pdf" }));
    formData.append("accountId", targetAccountId);

    const req = new NextRequest("http://localhost:3000/api/v1/statements/upload", {
      method: "POST",
      body: formData,
    });

    const res = await uploadStatement(req);
    expect(res.status).toBe(200);

    // Verified: Discrepant statement does not touch account balance
    expect(accountUpdated).toBe(false);
  });
});
