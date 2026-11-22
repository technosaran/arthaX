import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getOAuthStateSigningSecret, getTrustedOrigin, GET as oauthStart } from "@/app/api/v1/integrations/gmail/oauth/route";
import { GET as oauthCallback } from "@/app/api/v1/integrations/gmail/callback/route";
import {
  createSignedOAuthState,
} from "@/utils/oauthSecurity";
import {
  encryptSensitiveData,
  decryptSensitiveData,
  rotateEncryptionKey,
  migrateLegacyPlaintextToEncrypted,
} from "@/utils/crypto";
import {
  claimDatabaseIdempotency,
  computeRequestFingerprint,
} from "@/lib/backend/databaseIdempotency";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { parseExpenseMessage, escapeRegExp } from "@/utils/expenseParser";
import { classifyFinancialMessage } from "@/utils/financeParser";
import { computeNextRunDate } from "@/app/api/v1/jobs/recurring/route";
import crypto from "crypto";
import fs from "fs";
import path from "path";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("ArthaX Enterprise Security Hardening Suite (OAuth, Crypto & Database Idempotency)", () => {
  const mockedAuth = vi.mocked(getAuthenticatedUser);
  const mockedSupabase = vi.mocked(supabaseAdmin);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Gmail OAuth Security Lifecycle", () => {
    it("derives trusted canonical origin and rejects untrusted forwarded host headers", () => {
      // 1. Untrusted forwarded host should be ignored in favor of request origin
      const reqUntrusted = new NextRequest("https://arthax.vercel.app/api/v1/integrations/gmail/oauth", {
        headers: {
          "x-forwarded-host": "evil-phishing-site.com",
          "x-forwarded-proto": "https",
        },
      });
      const origin1 = getTrustedOrigin(reqUntrusted);
      expect(origin1).toBe("https://arthax.vercel.app");

      // 2. Allowed development or vercel domains are accepted
      const reqAllowed = new NextRequest("http://127.0.0.1:3000/api/v1/integrations/gmail/oauth", {
        headers: {
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        },
      });
      const origin2 = getTrustedOrigin(reqAllowed);
      expect(origin2).toBe("http://localhost:3000");
    });

    it("requires dedicated OAUTH_STATE_SECRET and fails closed in production when missing (no service-role fallback)", () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origSecret = process.env.OAUTH_STATE_SECRET;
      const origMaster = process.env.ENCRYPTION_MASTER_KEY;
      const origService = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        delete process.env.OAUTH_STATE_SECRET;
        process.env.ENCRYPTION_MASTER_KEY = "master-key-that-should-not-be-reused";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "supabase-service-role-key-never-used-as-oauth-secret";

        expect(() => getOAuthStateSigningSecret()).toThrow(
          /OAUTH_STATE_SECRET is not configured in production environment/
        );
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
        if (origSecret) process.env.OAUTH_STATE_SECRET = origSecret;
        if (origMaster) process.env.ENCRYPTION_MASTER_KEY = origMaster;
        if (origService) process.env.SUPABASE_SERVICE_ROLE_KEY = origService;
      }
    });

    it("fails closed on OAuth start if database fails to persist nonce", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: { id: "test-user-123" } as any,
        userId: "test-user-123",
        error: null,
      });

      mockedSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          error: { message: "Database connection refused" },
        }),
      } as any);

      process.env.GOOGLE_CLIENT_ID = "test-google-client-id";

      const req = new NextRequest("https://arthax.vercel.app/api/v1/integrations/gmail/oauth");
      const res = await oauthStart(req);

      expect(res.status).toBe(307);
      const loc = res.headers.get("location") || "";
      expect(loc).toContain("Database%20error");
    });

    it("rejects OAuth callback if state signature is forged or tampered with", async () => {
      const tamperedPayload = JSON.stringify({ userId: "user-123", nonce: "nonce-1", exp: Date.now() + 600000 });
      const badState = Buffer.from(
        JSON.stringify({ payload: tamperedPayload, sig: "0000000000000000000000000000000000000000000000000000000000000000" })
      ).toString("base64url");

      const req = new NextRequest(`https://arthax.vercel.app/api/v1/integrations/gmail/callback?code=test-code&state=${badState}`);
      const res = await oauthCallback(req);

      expect(res.status).toBe(307);
      const loc = res.headers.get("location") || "";
      expect(loc).toContain("error=Invalid%20state%20signature");
    });

    it("rejects OAuth callback if state has expired", async () => {
      const secret = getOAuthStateSigningSecret();
      const expiredPayload = JSON.stringify({ userId: "user-123", nonce: "nonce-1", exp: Date.now() - 5000 });
      const sig = crypto.createHmac("sha256", secret).update(expiredPayload).digest("hex");
      const expiredState = Buffer.from(JSON.stringify({ payload: expiredPayload, sig })).toString("base64url");

      const req = new NextRequest(`https://arthax.vercel.app/api/v1/integrations/gmail/callback?code=test-code&state=${expiredState}`);
      const res = await oauthCallback(req);

      expect(res.status).toBe(307);
      const loc = res.headers.get("location") || "";
      expect(loc).toContain("OAuth%20state%20expired");
    });

    it("rejects OAuth callback if initiating user does not match currently authenticated session (Session Binding)", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: { id: "victim-user-456" } as any,
        userId: "victim-user-456",
        error: null,
      });

      const secret = getOAuthStateSigningSecret();
      const statePayload = JSON.stringify({ userId: "attacker-user-123", nonce: "nonce-xyz", exp: Date.now() + 600000 });
      const sig = crypto.createHmac("sha256", secret).update(statePayload).digest("hex");
      const validState = Buffer.from(JSON.stringify({ payload: statePayload, sig })).toString("base64url");

      const req = new NextRequest(`https://arthax.vercel.app/api/v1/integrations/gmail/callback?code=test-code&state=${validState}`);
      const res = await oauthCallback(req);

      expect(res.status).toBe(307);
      const loc = res.headers.get("location") || "";
      expect(loc).toContain("User%20session%20mismatch");
    });

    it("rejects OAuth callback if CSRF nonce cookie is missing (Fail Closed)", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        userId: "user-123",
        error: null,
      });

      const state = createSignedOAuthState({ userId: "user-123", nonce: "nonce-abc-123" });
      const req = new NextRequest(`https://arthax.vercel.app/api/v1/integrations/gmail/callback?code=test-code&state=${state}`);
      // No cookie set on request
      const res = await oauthCallback(req);

      expect(res.status).toBe(307);
      const loc = res.headers.get("location") || "";
      expect(loc).toContain("Missing%20CSRF%20nonce%20cookie");
    });

    it("rejects OAuth callback if PKCE code verifier cookie is missing (Fail Closed)", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        userId: "user-123",
        error: null,
      });

      mockedSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      } as any);

      const state = createSignedOAuthState({ userId: "user-123", nonce: "nonce-abc-123" });
      const req = new NextRequest(`https://arthax.vercel.app/api/v1/integrations/gmail/callback?code=test-code&state=${state}`, {
        headers: {
          cookie: "arthax_oauth_nonce=nonce-abc-123", // Nonce present, but verifier missing
        },
      });

      const res = await oauthCallback(req);
      expect(res.status).toBe(307);
      const loc = res.headers.get("location") || "";
      expect(loc).toContain("Missing%20PKCE%20code%20verifier%20cookie");
    });

    it("rejects OAuth callback if atomic database nonce consumption fails (Fail Closed)", async () => {
      mockedAuth.mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        userId: "user-123",
        error: null,
      });

      // Simulate nonce already consumed or database RPC error
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: false,
        error: null,
      } as any);

      const state = createSignedOAuthState({ userId: "user-123", nonce: "nonce-consumed-already" });
      const req = new NextRequest(`https://arthax.vercel.app/api/v1/integrations/gmail/callback?code=test-code&state=${state}`, {
        headers: {
          cookie: "arthax_oauth_nonce=nonce-consumed-already; arthax_oauth_verifier=pkce-verifier-123",
        },
      });

      const res = await oauthCallback(req);
      expect(res.status).toBe(307);
      const loc = res.headers.get("location") || "";
      expect(loc).toContain("already%20been%20used");
    });
  });

  describe("Cryptographic Key Management & Key Rotation", () => {
    it("encrypts and decrypts sensitive financial payloads using AES-256-GCM", () => {
      const secretToken = "ya29.a0AfH6SMD_ultra_sensitive_oauth_token_123456";
      const encrypted = encryptSensitiveData(secretToken, "gmail-tokens");
      expect(encrypted).toMatch(/^enc:v1:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/);

      const decrypted = decryptSensitiveData(encrypted, "gmail-tokens");
      expect(decrypted).toBe(secretToken);
    });

    it("strictly requires ENCRYPTION_MASTER_KEY in production and fails closed without service-role fallback", () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origMaster = process.env.ENCRYPTION_MASTER_KEY;
      const origService = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        delete process.env.ENCRYPTION_MASTER_KEY;
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-that-must-never-be-used";

        expect(() => encryptSensitiveData("secret-data", "broker-credentials")).toThrow(
          /ENCRYPTION_MASTER_KEY is not configured in production environment/
        );
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
        if (origMaster) process.env.ENCRYPTION_MASTER_KEY = origMaster;
        if (origService) process.env.SUPABASE_SERVICE_ROLE_KEY = origService;
      }
    });

    it("rejects unencrypted legacy values as plaintext in production to prevent silent degradation", () => {
      const origNodeEnv = process.env.NODE_ENV;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";

        expect(() => decryptSensitiveData("raw-unencrypted-secret", "broker-credentials")).toThrow(
          /Plaintext fallback is forbidden in production/
        );

        // However, with explicit allowPlaintextFallback option for migration, it returns plaintext
        const migrated = decryptSensitiveData("raw-unencrypted-secret", "broker-credentials", {
          allowPlaintextFallback: true,
        });
        expect(migrated).toBe("raw-unencrypted-secret");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
      }
    });

    it("migrates legacy unencrypted records to AES-256-GCM versioned envelopes with round-trip verification", () => {
      const legacySecret = "my-old-broker-password";
      const result = migrateLegacyPlaintextToEncrypted(legacySecret, "broker-credentials");

      expect(result.status).toBe("migrated");
      expect(result.value).toMatch(/^enc:v1:/);

      // Verify that the migrated envelope decrypts cleanly to original value
      const decrypted = decryptSensitiveData(result.value, "broker-credentials");
      expect(decrypted).toBe(legacySecret);

      // Verify that running migration again is idempotent
      const idempotent = migrateLegacyPlaintextToEncrypted(result.value, "broker-credentials");
      expect(idempotent.status).toBe("already_encrypted");
      expect(idempotent.value).toBe(result.value);
    });

    it("supports zero-downtime key rotation using ENCRYPTION_MASTER_KEY_PREVIOUS", () => {
      const oldKey = "old-secret-key-32-chars-long-abc!";
      const newKey = "new-secret-key-32-chars-long-xyz!";

      // 1. Encrypt with old key
      const origEnv = process.env.ENCRYPTION_MASTER_KEY;
      process.env.ENCRYPTION_MASTER_KEY = oldKey;
      const originalCiphertext = encryptSensitiveData("secret-broker-password", "broker-credentials");

      // 2. Rotate environment: new key is active, old key is previous
      process.env.ENCRYPTION_MASTER_KEY = newKey;
      process.env.ENCRYPTION_MASTER_KEY_PREVIOUS = oldKey;

      try {
        // Decryption succeeds through previous key fallback
        const decrypted = decryptSensitiveData(originalCiphertext, "broker-credentials");
        expect(decrypted).toBe("secret-broker-password");

        // Re-encrypt under new key
        const reEncrypted = rotateEncryptionKey(originalCiphertext, "broker-credentials");
        expect(reEncrypted).not.toBeNull();
        expect(reEncrypted).not.toBe(originalCiphertext);

        // Verify re-encrypted value decrypts under active new key alone
        delete process.env.ENCRYPTION_MASTER_KEY_PREVIOUS;
        const decryptedNew = decryptSensitiveData(reEncrypted, "broker-credentials");
        expect(decryptedNew).toBe("secret-broker-password");
      } finally {
        process.env.ENCRYPTION_MASTER_KEY = origEnv;
        delete process.env.ENCRYPTION_MASTER_KEY_PREVIOUS;
      }
    });
  });

  describe("Database-Enforced Idempotency & Request Fingerprinting", () => {
    it("generates deterministic SHA-256 fingerprints across distinct key ordering in payloads", () => {
      const payloadA = { amount: 1500, to_account: "acc-1", from_account: "acc-2" };
      const payloadB = { from_account: "acc-2", to_account: "acc-1", amount: 1500 };

      const fpA = computeRequestFingerprint(payloadA);
      const fpB = computeRequestFingerprint(payloadB);
      expect(fpA).toBe(fpB);
    });

    it("claims idempotency key through stored procedure and returns action", async () => {
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: { action: "CLAIMED" },
        error: null,
      } as any);

      const claim = await claimDatabaseIdempotency("user-1", "idem-uuid-001", "TRANSFER", { amount: 500 });
      expect(claim.action).toBe("CLAIMED");
      expect(claim.isFirstAttempt).toBe(true);
      expect(mockedSupabase.rpc).toHaveBeenCalledWith("fn_claim_idempotency_key", expect.objectContaining({
        p_user_id: "user-1",
        p_key: "idem-uuid-001",
        p_operation_type: "TRANSFER",
      }));
    });

    it("detects and returns cached response for already completed idempotency keys", async () => {
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: {
          action: "CACHED_RESPONSE",
          response_status: 201,
          response_body: { transfer_id: "tr-999", amount: 500 },
        },
        error: null,
      } as any);

      const claim = await claimDatabaseIdempotency("user-1", "idem-uuid-001", "TRANSFER", { amount: 500 });
      expect(claim.action).toBe("CACHED_RESPONSE");
      expect(claim.isFirstAttempt).toBe(false);
      expect(claim.cachedResponse?.status).toBe(201);
      expect(claim.cachedResponse?.body).toEqual({ transfer_id: "tr-999", amount: 500 });
    });

    it("rejects concurrent in-flight conflict for simultaneously executed requests", async () => {
      mockedSupabase.rpc.mockResolvedValueOnce({
        data: {
          action: "IN_FLIGHT_CONFLICT",
          message: "Concurrent operation with same idempotency key is actively processing",
        },
        error: null,
      } as any);

      const claim = await claimDatabaseIdempotency("user-1", "idem-uuid-001", "TRANSFER", { amount: 500 });
      expect(claim.action).toBe("IN_FLIGHT_CONFLICT");
      expect(claim.isFirstAttempt).toBe(false);
      expect(claim.message).toContain("Concurrent operation");
    });
  });

  describe("Database RPC Security & Least-Privilege Grants Verification", () => {
    const migrationFile = path.join(
      process.cwd(),
      "supabase/migrations/20261127000000_database_idempotency_outbox_and_provenance.sql"
    );
    const hardeningMigrationFile = path.join(
      process.cwd(),
      "supabase/migrations/20261127000001_harden_rpc_security_and_outbox_authorization.sql"
    );

    const sql1 = fs.readFileSync(migrationFile, "utf8");
    const sql2 = fs.readFileSync(hardeningMigrationFile, "utf8");

    it("enforces service_role caller checks in fn_claim_outbox_jobs", () => {
      expect(sql1).toContain("IF v_caller_role != 'service_role' THEN");
      expect(sql1).toContain("Only service_role worker processes may claim outbox jobs");
      expect(sql2).toContain("IF v_caller_role != 'service_role' THEN");
    });

    it("enforces service_role caller checks in fn_complete_outbox_job, fn_fail_outbox_job, and fn_recover_stale_outbox_jobs", () => {
      expect(sql1).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_complete_outbox_job[\s\S]*?IF v_caller_role != 'service_role'/);
      expect(sql1).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_fail_outbox_job[\s\S]*?IF v_caller_role != 'service_role'/);
      expect(sql1).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_recover_stale_outbox_jobs[\s\S]*?IF v_caller_role != 'service_role'/);

      expect(sql2).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_complete_outbox_job[\s\S]*?IF v_caller_role != 'service_role'/);
      expect(sql2).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_fail_outbox_job[\s\S]*?IF v_caller_role != 'service_role'/);
      expect(sql2).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_recover_stale_outbox_jobs[\s\S]*?IF v_caller_role != 'service_role'/);
    });

    it("enforces strict caller identity in fn_consume_oauth_nonce", () => {
      expect(sql1).toContain("IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN");
      expect(sql2).toContain("IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN");
    });

    it("revokes execute from PUBLIC, anon, and authenticated on worker functions", () => {
      expect(sql1).toContain("REVOKE ALL ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;");
      expect(sql1).toContain("REVOKE ALL ON FUNCTION public.fn_complete_outbox_job(UUID, JSONB) FROM PUBLIC, anon, authenticated;");
      expect(sql1).toContain("REVOKE ALL ON FUNCTION public.fn_fail_outbox_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;");
      expect(sql1).toContain("REVOKE ALL ON FUNCTION public.fn_recover_stale_outbox_jobs(INTEGER) FROM PUBLIC, anon, authenticated;");

      expect(sql2).toContain("REVOKE ALL ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;");
      expect(sql2).toContain("REVOKE ALL ON FUNCTION public.fn_complete_outbox_job(UUID, JSONB) FROM PUBLIC, anon, authenticated;");
      expect(sql2).toContain("REVOKE ALL ON FUNCTION public.fn_fail_outbox_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;");
      expect(sql2).toContain("REVOKE ALL ON FUNCTION public.fn_recover_stale_outbox_jobs(INTEGER) FROM PUBLIC, anon, authenticated;");
    });

    it("grants worker functions strictly to service_role and never to authenticated", () => {
      expect(sql1).toContain("GRANT EXECUTE ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;");
      expect(sql1).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_claim_outbox_jobs.*?TO authenticated/);

      expect(sql2).toContain("GRANT EXECUTE ON FUNCTION public.fn_claim_outbox_jobs(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;");
      expect(sql2).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_claim_outbox_jobs.*?TO authenticated/);
    });
  });

  describe("Parser Robustness, Regex Safety & Cron Reliability", () => {
    it("safely handles account names with special regex characters without throwing SyntaxError", () => {
      const specialAccounts = [
        { id: "1", name: "HDFC (Salary) [Primary]", type: "Savings", balance: 50000, last_four: "1234" },
        { id: "2", name: "SBI + ICICI (Joint*Savings?)", type: "Savings", balance: 25000, last_four: "5678" },
        { id: "3", name: "Axis Bank [FD/RD] {Tax}", type: "Deposit", balance: 100000, last_four: "9999" },
      ];

      expect(() => {
        const parsed = parseExpenseMessage("Dinner 450 HDFC (Salary) [Primary]", specialAccounts);
        expect(parsed.amount).toBe(450);
        expect(parsed.accountQuery).toBe("HDFC (Salary) [Primary]");
      }).not.toThrow();

      expect(() => {
        const classified = classifyFinancialMessage("Salary 80000 into SBI + ICICI (Joint*Savings?)", specialAccounts);
        expect(classified.type).toBe("income");
      }).not.toThrow();

      expect(escapeRegExp("Test (a|b) [c]*+?^${}")).toBe("Test \\(a\\|b\\) \\[c\\]\\*\\+\\?\\^\\$\\{\\}");
    });

    it("computeNextRunDate gracefully falls back on malformed or empty date strings without throwing RangeError", () => {
      expect(() => {
        const res1 = computeNextRunDate("", "monthly");
        expect(res1).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        const res2 = computeNextRunDate("invalid-date", "daily");
        expect(res2).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        const res3 = computeNextRunDate("2026-01-31", "monthly");
        expect(res3).toBe("2026-02-28");
      }).not.toThrow();
    });
  });
});
