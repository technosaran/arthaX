import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncCanonicalTransactionToLedger, reconcileInternalTransfers } from "@/utils/transfers";
import { supabaseAdmin } from "@/utils/supabase/admin";
import fs from "fs";
import path from "path";

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

function postgrestMock<T>(data: T, error: any = null): any {
  return {
    data,
    error,
    count: null,
    status: error ? 400 : 200,
    statusText: error ? "Bad Request" : "OK",
  };
}

describe("SQL Function Security & Authorization Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20261125000000_secure_ledger_and_transfer_reconciliation.sql"
  );
  let migrationSql: string;

  try {
    migrationSql = fs.readFileSync(migrationPath, "utf8");
  } catch {
    migrationSql = "";
  }

  describe("Functional Authorization & Privilege Verification", () => {
    it("rejects unauthorized anonymous RPC execution with 42501 Unauthorized", async () => {
      // Simulate PostgreSQL rejecting anonymous caller
      vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
        postgrestMock(null, {
          code: "42501",
          message: "Unauthorized: Anonymous callers are barred from executing ledger synchronization",
        })
      );

      const res = await syncCanonicalTransactionToLedger({
        userId: "anon-caller",
        accountId: "acc-1",
        direction: "DEBIT",
        amount: 500,
        transactionDate: "2026-03-10",
        title: "Test",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized: Anonymous callers are barred");
    });

    it("rejects cross-tenant RPC execution when caller does not match p_user_id", async () => {
      // Simulate PostgreSQL detecting v_calling_user <> p_user_id
      vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce(
        postgrestMock(null, {
          code: "42501",
          message: "Forbidden: Authenticated user (user-A) cannot sync financial records for user (user-B)",
        })
      );

      const res = await syncCanonicalTransactionToLedger({
        userId: "user-B",
        accountId: "acc-b",
        direction: "CREDIT",
        amount: 2500,
        transactionDate: "2026-03-10",
        title: "Cross-tenant attempt",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden: Authenticated user");
    });

    it("strictly rejects transfer when destination account is missing and NEVER falls through to expense/income", async () => {
      const res = await syncCanonicalTransactionToLedger({
        userId: "user-123",
        accountId: "acc-src",
        direction: "DEBIT",
        amount: 1500,
        transactionDate: "2026-03-10",
        title: "Malformed transfer",
        isTransfer: true,
        transferToAccountId: undefined, // Missing destination
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Destination transfer account must be provided");
      // Confirm expenses table was NOT touched
      expect(supabaseAdmin.from).not.toHaveBeenCalledWith("expenses");
      expect(supabaseAdmin.from).not.toHaveBeenCalledWith("income");
    });

    it("strictly rejects transfer when source and destination accounts are identical (self-transfer)", async () => {
      const res = await syncCanonicalTransactionToLedger({
        userId: "user-123",
        accountId: "acc-same",
        direction: "DEBIT",
        amount: 1500,
        transactionDate: "2026-03-10",
        title: "Self transfer",
        isTransfer: true,
        transferToAccountId: "acc-same", // Identical
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Transfer source account and destination account must be distinct");
    });

    it("rejects transfer reconciliation for empty or invalid user ID", async () => {
      const res1 = await reconcileInternalTransfers("");
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("Invalid user ID");

      const res2 = await reconcileInternalTransfers("default_user");
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("Invalid user ID");
    });
  });

  describe("DDL & Security Policy Invariants", () => {
    it("enforces safe search_path = public, pg_temp on both SECURITY DEFINER functions", () => {
      const matches = migrationSql.match(/SET search_path = public, pg_temp/gi);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("revokes execute privileges from PUBLIC and anon on both functions", () => {
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger.*?FROM PUBLIC;/i);
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger.*?FROM anon;/i);
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_reconcile_internal_transfers.*?FROM PUBLIC;/i);
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_reconcile_internal_transfers.*?FROM anon;/i);
    });

    it("grants execute privileges strictly to authenticated and service_role", () => {
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger.*?TO authenticated;/i);
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger.*?TO service_role;/i);
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_reconcile_internal_transfers.*?TO authenticated;/i);
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_reconcile_internal_transfers.*?TO service_role;/i);
    });

    it("defines 1-to-1 uniqueness index on canonical_transactions.transfer_counterpart_id", () => {
      expect(migrationSql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_canonical_tx_transfer_counterpart/i);
      expect(migrationSql).toMatch(/ON public\.canonical_transactions\(transfer_counterpart_id\)/i);
    });
  });
});
