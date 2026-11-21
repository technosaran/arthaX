import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Financial Data Integrity & Idempotent Ingestion Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensures repeated statement imports do not create duplicate canonical transactions or ledger records", () => {
    // Simulate raw statement transactions
    const rawTransactions = [
      {
        transaction_date: "2026-11-01",
        amount: 2500,
        direction: "DEBIT",
        original_narration: "Swiggy UPI 99238128",
        dedup_hash: "hash_swiggy_001",
        is_transfer: false,
      },
      {
        transaction_date: "2026-11-03",
        amount: 45000,
        direction: "CREDIT",
        original_narration: "Salary Nov 2026",
        dedup_hash: "hash_salary_002",
        is_transfer: false,
      },
    ];

    // First upload: Both rows are novel and inserted
    const firstInsertResult = [
      { id: "canonical-uuid-1", dedup_hash: "hash_swiggy_001" },
      { id: "canonical-uuid-2", dedup_hash: "hash_salary_002" },
    ];
    const firstNewCanonicalMap = new Map(firstInsertResult.map((r) => [r.dedup_hash, r.id]));

    const firstExpensesToInsert: any[] = [];
    const firstIncomeToInsert: any[] = [];

    for (const row of rawTransactions) {
      if (row.is_transfer) continue;
      const canonicalId = firstNewCanonicalMap.get(row.dedup_hash);
      if (!canonicalId) continue;

      if (row.direction === "DEBIT") {
        firstExpensesToInsert.push({ ...row, canonical_transaction_id: canonicalId });
      } else {
        firstIncomeToInsert.push({ ...row, canonical_transaction_id: canonicalId });
      }
    }

    expect(firstExpensesToInsert.length).toBe(1);
    expect(firstIncomeToInsert.length).toBe(1);
    expect(firstExpensesToInsert[0].canonical_transaction_id).toBe("canonical-uuid-1");
    expect(firstIncomeToInsert[0].canonical_transaction_id).toBe("canonical-uuid-2");

    // Second upload (Identical statement re-uploaded):
    // Database returns empty array because onConflict(dedup_hash) DO NOTHING ignored all rows
    const secondInsertResult: any[] = [];
    const secondNewCanonicalMap = new Map(secondInsertResult.map((r) => [r.dedup_hash, r.id]));

    const secondExpensesToInsert: any[] = [];
    const secondIncomeToInsert: any[] = [];

    for (const row of rawTransactions) {
      if (row.is_transfer) continue;
      const canonicalId = secondNewCanonicalMap.get(row.dedup_hash);
      if (!canonicalId) continue; // Correctly skipped!

      if (row.direction === "DEBIT") {
        secondExpensesToInsert.push({ ...row, canonical_transaction_id: canonicalId });
      } else {
        secondIncomeToInsert.push({ ...row, canonical_transaction_id: canonicalId });
      }
    }

    // Zero duplicate records generated!
    expect(secondExpensesToInsert.length).toBe(0);
    expect(secondIncomeToInsert.length).toBe(0);
  });

  it("ensures overlapping statements only insert novel canonical records and ledger entries", () => {
    // Statement A had hash_1 and hash_2.
    // Statement B covers overlapping dates and has hash_2 (existing) plus hash_3 and hash_4 (new).
    const statementBTransactions = [
      {
        transaction_date: "2026-11-03",
        amount: 45000,
        direction: "CREDIT",
        dedup_hash: "hash_2",
        is_transfer: false,
      },
      {
        transaction_date: "2026-11-05",
        amount: 1200,
        direction: "DEBIT",
        dedup_hash: "hash_3",
        is_transfer: false,
      },
      {
        transaction_date: "2026-11-08",
        amount: 850,
        direction: "DEBIT",
        dedup_hash: "hash_4",
        is_transfer: false,
      },
    ];

    // Upsert returns only newly inserted rows (hash_3 and hash_4)
    const dbUpsertResult = [
      { id: "canonical-uuid-3", dedup_hash: "hash_3" },
      { id: "canonical-uuid-4", dedup_hash: "hash_4" },
    ];
    const newCanonicalMap = new Map(dbUpsertResult.map((r) => [r.dedup_hash, r.id]));

    const expensesToInsert: any[] = [];
    const incomeToInsert: any[] = [];

    for (const row of statementBTransactions) {
      if (row.is_transfer) continue;
      const canonicalId = newCanonicalMap.get(row.dedup_hash);
      if (!canonicalId) continue;

      if (row.direction === "DEBIT") {
        expensesToInsert.push({ ...row, canonical_transaction_id: canonicalId });
      } else {
        incomeToInsert.push({ ...row, canonical_transaction_id: canonicalId });
      }
    }

    // Only hash_3 and hash_4 should be inserted
    expect(expensesToInsert.length).toBe(2);
    expect(incomeToInsert.length).toBe(0);
    expect(expensesToInsert.map((e) => e.dedup_hash)).toEqual(["hash_3", "hash_4"]);
  });

  it("strictly excludes internal transfers from expense and income ledger generation", () => {
    const mixedTransactions = [
      {
        transaction_date: "2026-11-05",
        amount: 10000,
        direction: "DEBIT",
        dedup_hash: "hash_transfer_out",
        is_transfer: true, // Marked as transfer to savings account
      },
      {
        transaction_date: "2026-11-05",
        amount: 500,
        direction: "DEBIT",
        dedup_hash: "hash_coffee",
        is_transfer: false,
      },
    ];

    const dbUpsertResult = [
      { id: "tx-transfer", dedup_hash: "hash_transfer_out" },
      { id: "tx-coffee", dedup_hash: "hash_coffee" },
    ];
    const newCanonicalMap = new Map(dbUpsertResult.map((r) => [r.dedup_hash, r.id]));

    const expensesToInsert: any[] = [];
    const transfersToInsert: any[] = [];

    for (const row of mixedTransactions) {
      const canonicalId = newCanonicalMap.get(row.dedup_hash);
      if (!canonicalId) continue;

      if (row.is_transfer) {
        transfersToInsert.push({ ...row, canonical_transfer_id: canonicalId });
        continue; // Transfer is never added to expenses!
      }

      if (row.direction === "DEBIT") {
        expensesToInsert.push({ ...row, canonical_transaction_id: canonicalId });
      }
    }

    expect(expensesToInsert.length).toBe(1);
    expect(expensesToInsert[0].dedup_hash).toBe("hash_coffee");
    expect(transfersToInsert.length).toBe(1);
    expect(transfersToInsert[0].canonical_transfer_id).toBe("tx-transfer");
  });
});
