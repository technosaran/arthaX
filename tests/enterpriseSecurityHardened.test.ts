import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getOAuthStateSigningSecret, getTrustedOrigin, GET as oauthStart } from "@/app/api/v1/integrations/gmail/oauth/route";
import { GET as oauthCallback } from "@/app/api/v1/integrations/gmail/callback/route";
import { encryptSensitiveData, decryptSensitiveData, rotateEncryptionKey } from "@/utils/crypto";
import { claimDatabaseIdempotency, completeDatabaseIdempotency, computeRequestFingerprint } from "@/lib/backend/databaseIdempotency";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import crypto from "crypto";

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

    it("requires dedicated OAUTH_STATE_SECRET and fails closed in production when missing", () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origSecret = process.env.OAUTH_STATE_SECRET;
      const origMaster = process.env.ENCRYPTION_MASTER_KEY;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        delete process.env.OAUTH_STATE_SECRET;
        delete process.env.ENCRYPTION_MASTER_KEY;

        expect(() => getOAuthStateSigningSecret()).toThrow(/OAUTH_STATE_SECRET or ENCRYPTION_MASTER_KEY must be configured/);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
        if (origSecret) process.env.OAUTH_STATE_SECRET = origSecret;
        if (origMaster) process.env.ENCRYPTION_MASTER_KEY = origMaster;
      }
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
  });

  describe("Cryptographic Key Management & Key Rotation", () => {
    it("encrypts and decrypts sensitive financial payloads using AES-256-GCM", () => {
      const secretToken = "ya29.a0AfH6SMD_ultra_sensitive_oauth_token_123456";
      const encrypted = encryptSensitiveData(secretToken, "gmail-tokens");
      expect(encrypted).toMatch(/^enc:v1:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/);

      const decrypted = decryptSensitiveData(encrypted, "gmail-tokens");
      expect(decrypted).toBe(secretToken);
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
});
