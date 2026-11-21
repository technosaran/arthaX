import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncUserGmailStatements } from "@/utils/gmail";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { logger } from "@/utils/logger";

vi.mock("@/utils/supabase/admin", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    supabaseAdmin: {
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

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

describe("Gmail Synchronization Checkpoint & Retry Reliability Suite", () => {
  const userId = "usr-gmail-checkpoint-test";

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  function createChainedMock(options?: {
    singleData?: any;
    maybeSingleData?: any;
    queryData?: any[];
    onUpsert?: (data: any) => void;
    onUpdate?: (data: any) => void;
    errorMap?: Record<string, any>;
  }) {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation(() => {
        if (options?.errorMap?.insert) {
          return Promise.resolve({ data: null, error: options.errorMap.insert });
        }
        return chain;
      }),
      update: vi.fn().mockImplementation((data: any) => {
        if (options?.onUpdate) options.onUpdate(data);
        if (options?.errorMap?.update) {
          return Promise.resolve({ data: null, error: options.errorMap.update });
        }
        return chain;
      }),
      upsert: vi.fn().mockImplementation((data: any) => {
        if (options?.onUpsert) options.onUpsert(data);
        if (options?.errorMap?.upsert) {
          return Promise.resolve({ data: null, error: options.errorMap.upsert });
        }
        return chain;
      }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => Promise.resolve({ data: options?.queryData ?? [], error: null })),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: options?.maybeSingleData ?? null, error: null })),
      single: vi.fn().mockImplementation(() => {
        if (options?.errorMap?.single) {
          return Promise.resolve({ data: null, error: options.errorMap.single });
        }
        return Promise.resolve({ data: options?.singleData ?? { id: "test-id" }, error: null });
      }),
    };
    return chain;
  }

  it("passes configurable bounded batch size to Python calculation service", async () => {
    let capturedPayload: any = null;

    vi.mocked(global.fetch).mockImplementation(async (url: any, init?: any) => {
      if (typeof url === "string" && url.includes("/api/py/statements/gmail/sync")) {
        capturedPayload = JSON.parse(init?.body || "{}");
        return {
          ok: true,
          json: async () => ({ statements: [] }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "gmail_integrations") {
        return createChainedMock({
          maybeSingleData: {
            id: "int-1",
            user_id: userId,
            sync_status: "ACTIVE",
            access_token_encrypted: "plain-access-token",
            token_expiry: new Date(Date.now() + 3600000).toISOString(),
            last_sync_at: "2026-03-01T00:00:00.000Z",
          },
        });
      }
      return createChainedMock();
    });

    const result = await syncUserGmailStatements(userId, { maxMessages: 50 });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    // Verified: Configurable batch size of 50 passed
    expect(capturedPayload.max_messages).toBe(50);
  });

  it("tracks attachment states in statement_attachment_jobs with stable deterministic identifiers (no random strings)", async () => {
    const recordedAttachmentJobs: any[] = [];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statements: [
          {
            success: true,
            file_name: "sbi_success.pdf",
            file_hash: "hash-success-123",
            message_id: "gmail_msg_101",
            attachment_id: "gmail_att_202",
            bank_name: "SBI",
            email_metadata: { message_id: "gmail_msg_101", date: "2026-03-05" },
            metadata: { opening_balance: 1000, closing_balance: 2000 },
            validation: { is_valid: true, total_credits: 1000, total_debits: 0, errors: [] },
            transactions: [],
          },
        ],
      }),
    } as any);

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "gmail_integrations") {
        return createChainedMock({
          maybeSingleData: {
            id: "int-1",
            user_id: userId,
            sync_status: "ACTIVE",
            access_token_encrypted: "plain-access-token",
            token_expiry: new Date(Date.now() + 3600000).toISOString(),
            last_sync_at: "2026-03-01T00:00:00.000Z",
          },
        });
      }
      if (table === "statement_attachment_jobs") {
        return createChainedMock({
          onUpsert: (data) => {
            recordedAttachmentJobs.push(data);
          },
        });
      }
      return createChainedMock();
    });

    const result = await syncUserGmailStatements(userId);

    expect(result.success).toBe(true);
    expect(recordedAttachmentJobs).toHaveLength(1);
    // Verified: Stable durable message and attachment IDs are preserved
    expect(recordedAttachmentJobs[0].message_id).toBe("gmail_msg_101");
    expect(recordedAttachmentJobs[0].attachment_id).toBe("gmail_att_202");
    expect(recordedAttachmentJobs[0].status).toBe("RECONCILED");
  });

  it("does not advance last_sync_at past a failed message's timestamp (durable checkpointing)", async () => {
    let updatedLastSyncAt: string | null = null;
    const initialCheckpoint = "2026-03-01T00:00:00.000Z";

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statements: [
          {
            success: false,
            file_name: "corrupt.pdf",
            email_metadata: { message_id: "msg-fail", date: "2026-03-03T10:00:00.000Z" },
            errors: ["Corrupted PDF stream"],
          },
        ],
      }),
    } as any);

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "gmail_integrations") {
        return createChainedMock({
          maybeSingleData: {
            id: "int-1",
            user_id: userId,
            sync_status: "ACTIVE",
            access_token_encrypted: "plain-access-token",
            token_expiry: new Date(Date.now() + 3600000).toISOString(),
            last_sync_at: initialCheckpoint,
          },
          onUpdate: (data) => {
            if (data.last_sync_at) updatedLastSyncAt = data.last_sync_at;
          },
        });
      }
      return createChainedMock();
    });

    const result = await syncUserGmailStatements(userId);

    expect(result.status).toBe("FAILED");
    // Verified: When all statements fail, last_sync_at is NOT advanced to now, preserving initial checkpoint
    expect(updatedLastSyncAt).toBe(initialCheckpoint);
  });

  it("does not swallow Supabase write errors when recording statement attachment jobs", async () => {
    const errorSpy = vi.spyOn(logger, "error");

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        statements: [
          {
            success: false,
            file_name: "statement_write_err.pdf",
            message_id: "msg_err_101",
            attachment_id: "att_err_202",
            errors: ["Password required"],
          },
        ],
      }),
    } as any);

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "gmail_integrations") {
        return createChainedMock({
          maybeSingleData: {
            id: "int-1",
            user_id: userId,
            sync_status: "ACTIVE",
            access_token_encrypted: "plain-access-token",
            token_expiry: new Date(Date.now() + 3600000).toISOString(),
          },
        });
      }
      if (table === "statement_attachment_jobs") {
        return createChainedMock({
          errorMap: {
            upsert: { message: "Database connection failed during attachment job write" },
          },
        });
      }
      return createChainedMock();
    });

    await syncUserGmailStatements(userId);

    // Verified: Error is NOT swallowed; logged with high severity
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to persist failed statement attachment job",
      "GmailService",
      expect.objectContaining({ message: expect.stringContaining("Database connection failed") }),
      expect.any(Object)
    );
  });
});
