import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("SQL Function Security & Authorization Audit Suite", () => {
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

  it("verifies the latest migration file exists and is readable", () => {
    expect(migrationSql.length).toBeGreaterThan(100);
  });

  describe("fn_sync_canonical_transaction_to_ledger Security Defenses", () => {
    it("enforces safe search_path = public, pg_temp to prevent schema hijacking", () => {
      expect(migrationSql).toMatch(/SET search_path\s*=\s*public,\s*pg_temp/i);
    });

    it("verifies and rejects anonymous callers (auth.role() = 'anon')", () => {
      expect(migrationSql).toMatch(/IF v_calling_role\s*=\s*'anon'\s*THEN/i);
      expect(migrationSql).toMatch(/RAISE EXCEPTION 'Unauthorized: Anonymous callers are barred/i);
    });

    it("verifies authenticated caller identity against p_user_id (cross-tenant prevention)", () => {
      expect(migrationSql).toMatch(/IF v_calling_user IS NOT NULL AND v_calling_role <> 'service_role' THEN/i);
      expect(migrationSql).toMatch(/IF v_calling_user <> p_user_id THEN/i);
      expect(migrationSql).toMatch(/Forbidden: Authenticated user \(%\) cannot sync financial records for user \(%\)/i);
    });

    it("verifies source account ownership belongs to p_user_id", () => {
      expect(migrationSql).toMatch(/SELECT 1 FROM public\.accounts\s+WHERE id = p_account_id AND user_id = p_user_id/i);
      expect(migrationSql).toMatch(/Source account \(%\) does not exist or does not belong to user \(%\)/i);
    });

    it("verifies destination account ownership belongs to the same user during transfers", () => {
      expect(migrationSql).toMatch(/SELECT 1 FROM public\.accounts\s+WHERE id = p_transfer_to_account_id AND user_id = p_user_id/i);
      expect(migrationSql).toMatch(/Destination transfer account \(%\) does not exist or does not belong to user \(%\)/i);
    });

    it("enforces distinct source and destination accounts for transfers", () => {
      expect(migrationSql).toMatch(/IF p_account_id = p_transfer_to_account_id THEN/i);
      expect(migrationSql).toMatch(/Transfer source account and destination account must be distinct/i);
    });

    it("verifies canonical transaction ownership belongs to the same account and user", () => {
      expect(migrationSql).toMatch(/SELECT 1 FROM public\.canonical_transactions\s+WHERE id = p_canonical_tx_id AND user_id = p_user_id AND account_id = p_account_id/i);
      expect(migrationSql).toMatch(/Canonical transaction \(%\) does not exist or does not match account/i);
    });

    it("enforces positive monetary amount greater than zero", () => {
      expect(migrationSql).toMatch(/IF p_amount IS NULL OR p_amount <= 0 THEN/i);
      expect(migrationSql).toMatch(/Transaction amount must be strictly positive and greater than 0/i);
    });

    it("revokes execute privileges from PUBLIC and anon, granting strictly to authenticated and service_role", () => {
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger\(.*?\) FROM PUBLIC;/i);
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger\(.*?\) FROM anon;/i);
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger\(.*?\) TO authenticated;/i);
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_sync_canonical_transaction_to_ledger\(.*?\) TO service_role;/i);
    });
  });

  describe("fn_reconcile_internal_transfers Security Defenses", () => {
    it("enforces safe search_path = public, pg_temp", () => {
      const match = migrationSql.match(/FUNCTION public\.fn_reconcile_internal_transfers[\s\S]*?SET search_path = public, pg_temp/i);
      expect(match).not.toBeNull();
    });

    it("verifies caller identity and blocks cross-tenant execution", () => {
      expect(migrationSql).toMatch(/Forbidden: Cannot reconcile transfers for user \(%\)/i);
    });

    it("revokes execute from PUBLIC and anon, granting strictly to authenticated and service_role", () => {
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_reconcile_internal_transfers\(text, integer\) FROM PUBLIC;/i);
      expect(migrationSql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_reconcile_internal_transfers\(text, integer\) FROM anon;/i);
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_reconcile_internal_transfers\(text, integer\) TO authenticated;/i);
      expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_reconcile_internal_transfers\(text, integer\) TO service_role;/i);
    });
  });

  describe("statement_attachment_jobs Table Schema & RLS", () => {
    it("defines attachment lifecycle status check constraint", () => {
      expect(migrationSql).toMatch(/'DISCOVERED',\s*'DOWNLOADED',\s*'PARSED',\s*'RECONCILED',\s*'IMPORTED',\s*'FAILED',\s*'RETRY_PENDING'/);
    });

    it("enables Row Level Security and creates strict tenant isolation policies", () => {
      expect(migrationSql).toMatch(/ALTER TABLE public\.statement_attachment_jobs ENABLE ROW LEVEL SECURITY;/);
      expect(migrationSql).toMatch(/auth\.uid\(\)::text = user_id/);
    });
  });
});
