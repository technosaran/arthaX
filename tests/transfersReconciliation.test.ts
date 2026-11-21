import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileInternalTransfers, syncCanonicalTransactionToLedger, evaluateTransferEvidence } from "@/utils/transfers";
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

// Helper for type-safe PostgrestSingleResponse mocks
function postgrestMock<T>(data: T, error: any = null): any {
  return {
    data,
    error,
    count: null,
    status: error ? 400 : 200,
    statusText: error ? "Bad Request" : "OK",
  };
}

describe("Internal Transfer Reconciliation & Ledger Ingestion Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles matching debit and credit pairs across accounts within 3 days using narration evidence", async () => {
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

    // Mock RPC returning error so it exercises fallback matching engine
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
      postgrestMock(null, { message: "RPC not available in unit test" })
    );

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
      if (table === "accounts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "acc-source-sbi", name: "SBI Savings", last_four: "1111" },
                { id: "acc-dest-hdfc", name: "HDFC Salary", last_four: "2222" },
              ],
              error: null,
            }),
          }),
        };
      }
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

  it("does not match false-positive transactions based solely on equal amounts and dates", async () => {
    const userId = "usr-false-positive-test";
    // Debit for food delivery
    const debitTx = {
      id: "tx-debit-swiggy",
      account_id: "acc-sbi-1",
      direction: "DEBIT",
      amount: 450,
      transaction_date: "2026-03-10",
      original_narration: "UPI/SWIGGY/ORDER999",
      normalized_narration: "Swiggy Food Delivery",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    // Coincidental credit on another account (e.g. cashback or refund)
    const creditTx = {
      id: "tx-credit-cashback",
      account_id: "acc-hdfc-2",
      direction: "CREDIT",
      amount: 450,
      transaction_date: "2026-03-10", // Same day!
      original_narration: "CASHBACK CREDITED FOR BILLPAY",
      normalized_narration: "Cashback",
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
      postgrestMock(null, { message: "RPC not available" })
    );

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
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

    // Verified: Ambiguous match without transfer evidence is NOT matched
    expect(result.success).toBe(true);
    expect(result.transfersReconciled).toBe(0);
  });

  it("enforces strict 1-to-1 uniqueness: one credit cannot match multiple debits", async () => {
    const userId = "usr-one-to-one-test";
    // Two debits of ₹10,000
    const debitTx1 = {
      id: "tx-debit-1",
      account_id: "acc-sbi-1",
      direction: "DEBIT",
      amount: 10000,
      transaction_date: "2026-03-10",
      original_narration: "TRF TO HDFC SALARY",
      normalized_narration: "Transfer to HDFC",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    const debitTx2 = {
      id: "tx-debit-2",
      account_id: "acc-sbi-1",
      direction: "DEBIT",
      amount: 10000,
      transaction_date: "2026-03-10",
      original_narration: "TRF TO HDFC SALARY",
      normalized_narration: "Transfer to HDFC",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    // Only ONE credit of ₹10,000 exists
    const creditTx1 = {
      id: "tx-credit-1",
      account_id: "acc-hdfc-2",
      direction: "CREDIT",
      amount: 10000,
      transaction_date: "2026-03-10",
      original_narration: "TRF FROM SBI SAVINGS",
      normalized_narration: "Transfer from SBI",
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
      postgrestMock(null, { message: "RPC not available" })
    );

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === "canonical_transactions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [debitTx1, debitTx2, creditTx1],
                  error: null,
                }),
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "transfers") {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "expenses" || table === "income") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await reconcileInternalTransfers(userId, 60);

    // Verified: Exactly 1 pair matched. The second debit is left unmatched!
    expect(result.success).toBe(true);
    expect(result.transfersReconciled).toBe(1);
  });

  it("handles concurrent reconciliation safely when a counterpart is locked or updated concurrently", async () => {
    const userId = "usr-concurrency-test";
    const debitTx = {
      id: "tx-debit-c",
      account_id: "acc-sbi-1",
      direction: "DEBIT",
      amount: 2000,
      transaction_date: "2026-03-10",
      original_narration: "TRF TO AXIS",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    const creditTx = {
      id: "tx-credit-c",
      account_id: "acc-axis-2",
      direction: "CREDIT",
      amount: 2000,
      transaction_date: "2026-03-10",
      original_narration: "TRF FROM SBI",
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
      postgrestMock(null, { message: "RPC not available" })
    );

    // Simulate concurrent worker updating debitTx first, so our update returns a conflict/error
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
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
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: "Row locked concurrently" } }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await reconcileInternalTransfers(userId, 60);
    // Verified: Safely skipped the pair without throwing or double-inserting
    expect(result.success).toBe(true);
    expect(result.transfersReconciled).toBe(0);
  });

  it("does not match transactions across the same account", async () => {
    const userId = "usr-reconcile-same-acc";
    const debitTx = {
      id: "tx-debit-same",
      account_id: "acc-sbi-1",
      direction: "DEBIT",
      amount: 5000,
      transaction_date: "2026-03-10",
      original_narration: "TRF TO SELF",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    const creditTx = {
      id: "tx-credit-same",
      account_id: "acc-sbi-1", // SAME account
      direction: "CREDIT",
      amount: 5000,
      transaction_date: "2026-03-10",
      original_narration: "TRF FROM SELF",
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
      postgrestMock(null, { message: "RPC not available" })
    );

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
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
      original_narration: "TRF TO HDFC",
      is_transfer: false,
      transfer_counterpart_id: null,
    };
    const creditTx = {
      id: "tx-credit-new",
      account_id: "acc-hdfc-2",
      direction: "CREDIT",
      amount: 5000,
      transaction_date: "2026-03-10", // 9 days later (> 3 days)
      original_narration: "TRF FROM SBI",
      is_transfer: false,
      transfer_counterpart_id: null,
    };

    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
      postgrestMock(null, { message: "RPC not available" })
    );

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string): any => {
      if (table === "accounts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
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

  it("syncCanonicalTransactionToLedger strictly rejects transfer when destination is missing or self-transfer", async () => {
    // Missing destination account
    const missingDestRes = await syncCanonicalTransactionToLedger({
      userId: "usr-valid-1",
      accountId: "acc-1",
      direction: "DEBIT",
      amount: 1000,
      transactionDate: "2026-03-15",
      title: "Transfer missing dest",
      isTransfer: true,
      transferToAccountId: undefined, // Missing!
    });
    expect(missingDestRes.success).toBe(false);
    expect(missingDestRes.error).toContain("Destination transfer account must be provided");

    // Self-transfer (source equals destination)
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

  it("evaluates evidence correctly with confidence scoring", () => {
    // 1. Exact reference match -> 0.99
    const ev1 = evaluateTransferEvidence(
      { transaction_reference: "UPI12345678" },
      { transaction_reference: "UPI12345678" }
    );
    expect(ev1.isMatch).toBe(true);
    expect(ev1.confidence).toBe(0.99);

    // 2. Narration transfer keyword -> match
    const ev2 = evaluateTransferEvidence(
      { original_narration: "TRF TO SALARY ACC" },
      { original_narration: "TRF FROM SAVINGS" }
    );
    expect(ev2.isMatch).toBe(true);
    expect(ev2.confidence).toBeGreaterThanOrEqual(0.85);

    // 3. Unrelated purchase narrations -> no match
    const ev3 = evaluateTransferEvidence(
      { original_narration: "AMAZON PAY RETAIL" },
      { original_narration: "UBER TRIP MUMBAI" }
    );
    expect(ev3.isMatch).toBe(false);
    expect(ev3.confidence).toBe(0);
  });
});
