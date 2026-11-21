import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileInternalTransfers, syncCanonicalTransactionToLedger } from "@/utils/transfers";
import { supabaseAdmin } from "@/utils/supabase/admin";

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

describe("Internal Transfer Reconciliation & Ledger Ingestion Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles matching debit and credit pairs across accounts within 3 days", async () => {
    const userId = "usr-reconcile-1";
    const debitTx = {
      id: "tx-debit-101",
      account_id: "acc-source-sbi",
      direction: "DEBIT",
      amount: 15000,
      transaction_date: "2026-03-10",
      original_narration: "UPI/TRANSFER TO HDFC/12345",
      normalized_narration: "Transfer to HDFC",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    const creditTx = {
      id: "tx-credit-202",
      account_id: "acc-dest-hdfc",
      direction: "CREDIT",
      amount: 15000,
      transaction_date: "2026-03-11", // 1 day difference (within 3-day window)
      original_narration: "UPI/TRANSFER FROM SBI/12345",
      normalized_narration: "Transfer from SBI",
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    // Mock RPC returning null/error so it exercises fallback matching engine
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: "RPC not available in unit test" } as any,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "canonical_transactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [debitTx, creditTx],
                  error: null,
                }),
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "transfers") {
        return { upsert: mockUpsert };
      }
      if (table === "expenses" || table === "income") {
        return { delete: mockDelete };
      }
      return {};
    });

    const result = await reconcileInternalTransfers(userId, 60);

    expect(result.success).toBe(true);
    expect(result.transfersReconciled).toBe(1);
    expect(result.expensesCleaned).toBe(1);
    expect(result.incomeCleaned).toBe(1);

    // Verify canonical transactions were updated to transfer
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_transfer: true,
        transfer_counterpart_id: creditTx.id,
      })
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_transfer: true,
        transfer_counterpart_id: debitTx.id,
      })
    );

    // Verify persisted in public.transfers
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        from_account_id: debitTx.account_id,
        to_account_id: creditTx.account_id,
        amount: 15000,
        canonical_transfer_id: debitTx.id,
      }),
      expect.objectContaining({ onConflict: "user_id,canonical_transfer_id", ignoreDuplicates: true })
    );

    // Verify premature expense and income records were deleted
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  it("does not match transactions across same account", async () => {
    const userId = "usr-reconcile-same-acc";
    const debitTx = {
      id: "tx-debit-same",
      account_id: "acc-sbi-1",
      direction: "DEBIT",
      amount: 5000,
      transaction_date: "2026-03-10",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    const creditTx = {
      id: "tx-credit-same",
      account_id: "acc-sbi-1", // SAME account
      direction: "CREDIT",
      amount: 5000,
      transaction_date: "2026-03-10",
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: "RPC not available" } as any,
    });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "canonical_transactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [debitTx, creditTx],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await reconcileInternalTransfers(userId, 60);
    expect(result.success).toBe(true);
    expect(result.transfersReconciled).toBe(0);
  });

  it("does not match transactions outside the 3-day settlement window", async () => {
    const userId = "usr-reconcile-timing";
    const debitTx = {
      id: "tx-debit-old",
      account_id: "acc-sbi-1",
      direction: "DEBIT",
      amount: 5000,
      transaction_date: "2026-03-01",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    const creditTx = {
      id: "tx-credit-new",
      account_id: "acc-hdfc-2",
      direction: "CREDIT",
      amount: 5000,
      transaction_date: "2026-03-10", // 9 days later (> 3 days)
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: "RPC not available" } as any,
    });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "canonical_transactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [debitTx, creditTx],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await reconcileInternalTransfers(userId, 60);
    expect(result.success).toBe(true);
    expect(result.transfersReconciled).toBe(0);
  });

  it("rejects unauthorized and empty user IDs", async () => {
    const res1 = await reconcileInternalTransfers("");
    expect(res1.success).toBe(false);
    expect(res1.error).toContain("Invalid user ID");

    const res2 = await reconcileInternalTransfers("default_user");
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("Invalid user ID");
  });

  it("syncCanonicalTransactionToLedger strictly validates amounts and accounts", async () => {
    const invalidAmountRes = await syncCanonicalTransactionToLedger({
      userId: "usr-valid-1",
      accountId: "acc-1",
      direction: "DEBIT",
      amount: -500, // Negative amount
      transactionDate: "2026-03-15",
      title: "Negative test",
    });
    expect(invalidAmountRes.success).toBe(false);
    expect(invalidAmountRes.error).toContain("cannot be negative");

    const sameAccountTransfer = await syncCanonicalTransactionToLedger({
      userId: "usr-valid-1",
      accountId: "acc-same",
      direction: "DEBIT",
      amount: 1000,
      transactionDate: "2026-03-15",
      title: "Same account transfer",
      isTransfer: true,
      transferToAccountId: "acc-same", // Destination is same as source
    });
    expect(sameAccountTransfer.success).toBe(false);
    expect(sameAccountTransfer.error).toContain("must be distinct");
  });
});
