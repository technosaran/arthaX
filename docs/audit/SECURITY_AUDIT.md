# ArthaX — Security Audit & Hardening Remediation Report

**Date**: November 22, 2026  
**Auditor**: Application Security Engineering Team  
**Scope**: Cryptography, OAuth 2.0 / OpenID Connect, Database RPC privileges, API authorization, and tenant isolation.

---

## 1. Executive Summary

This report documents the security audit and comprehensive remediation undertaken on the ArthaX codebase. The audit identified four critical vulnerabilities (P0) concerning cryptographic key derivation, OAuth flow fail-closed handling, database procedure privilege escalation, and credential storage. All vulnerabilities were remediated and verified with automated regression tests.

---

## 2. Remediated Critical Vulnerabilities (P0)

### Vulnerability 1: OAuth State Signing Secret Asymmetry & Fallback Weakness
- **Impact**: High / Critical
- **Affected Files**:
  - `src/app/api/v1/integrations/gmail/oauth/route.ts`
  - `src/app/api/v1/integrations/gmail/callback/route.ts`
- **Root Cause**:
  In commit `49448c8`, `getOAuthStateSigningSecret()` was updated to derive a state-signing secret from `SUPABASE_SERVICE_ROLE_KEY` using HMAC with a hardcoded salt. However:
  1. The callback route historically used either `OAUTH_STATE_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` directly, risking cryptographic key mismatch.
  2. Database credentials (`SUPABASE_SERVICE_ROLE_KEY`) must never be repurposed as OAuth state signing secrets or encryption master keys.
  3. Exporting route utilities across Next.js app directory endpoints violated route boundaries.
- **Remediation**:
  Created `src/utils/oauthSecurity.ts` containing:
  - `getOAuthStateSigningSecret()`: strictly enforces `OAUTH_STATE_SECRET` in production and throws an explicit security error if missing. Never falls back to `SUPABASE_SERVICE_ROLE_KEY` or `ENCRYPTION_MASTER_KEY`.
  - `createSignedOAuthState()` & `verifySignedOAuthState()`: unified state creation and timing-safe verification.
  - Constant-time verification pre-hashed with SHA-256 to eliminate timing side-channels and length leakage.

---

### Vulnerability 2: OAuth Nonce & PKCE Fail-Closed Verification
- **Impact**: Critical
- **Affected Files**:
  - `src/app/api/v1/integrations/gmail/oauth/route.ts`
  - `src/app/api/v1/integrations/gmail/callback/route.ts`
- **Root Cause**:
  1. Nonce insertion errors into `oauth_state_nonces` were swallowed with an empty `catch` block.
  2. If the `arthax_oauth_nonce` cookie was missing, the callback flow did not abort.
  3. Nonce consumption errors (`fn_consume_oauth_nonce`) were ignored if an RPC error occurred.
  4. The PKCE `code_verifier` cookie was optional in token exchange.
- **Remediation**:
  1. **Fail-Closed Nonce Persistence**: If database insertion fails during initiation, the route aborts and redirects with a database error.
  2. **Mandatory Nonce Cookie**: If `arthax_oauth_nonce` is missing or mismatched, callback redirects with `Missing CSRF nonce cookie`.
  3. **Atomic Consumption Verification**: `fn_consume_oauth_nonce` must succeed and return `consumed === true`. Any RPC error or false return immediately stops the flow.
  4. **Mandatory PKCE Verifier**: The `code_verifier` cookie must be present. If missing, callback immediately halts.

---

### Vulnerability 3: Elevated Privileges on Database SECURITY DEFINER Functions
- **Impact**: Critical (Cross-Tenant Authorization Risk)
- **Affected Migration**:
  - `supabase/migrations/20261127000000_database_idempotency_outbox_and_provenance.sql`
  - `supabase/migrations/20261127000001_harden_rpc_security_and_outbox_authorization.sql`
- **Root Cause**:
  PostgreSQL `SECURITY DEFINER` functions run with owner privileges.
  1. `fn_claim_outbox_jobs`, `fn_complete_outbox_job`, `fn_fail_outbox_job`, `fn_recover_stale_outbox_jobs` were granted to `authenticated`. An ordinary user could invoke `fn_claim_outbox_jobs` and inspect or claim another user's financial tasks.
  2. These procedures lacked caller role checks.
  3. `fn_consume_oauth_nonce` had no caller authorization check.
  4. Functions did not revoke default execution rights from `PUBLIC` and `anon`.
- **Remediation**:
  1. Added internal caller checks:
     ```sql
     IF v_caller_role != 'service_role' THEN
       RAISE EXCEPTION '... Access denied. Only service_role worker processes may claim outbox jobs.';
     END IF;
     ```
  2. Added caller check in `fn_consume_oauth_nonce`:
     ```sql
     IF v_caller_role != 'service_role' AND (v_caller_id IS NULL OR v_caller_id != p_user_id) THEN
       RAISE EXCEPTION '... Unauthorized caller % attempting to consume nonce for %', v_caller_id, p_user_id;
     END IF;
     ```
  3. Executed `REVOKE ALL ... FROM PUBLIC, anon, authenticated` on all worker functions.
  4. Granted execution strictly to `service_role`.

---

### Vulnerability 4: Financial Credential Protection & Plaintext Fallback
- **Impact**: Critical
- **Affected File**: `src/utils/crypto.ts`
- **Root Cause**:
  1. `getDerivedKey` fell back to `SUPABASE_SERVICE_ROLE_KEY` if `ENCRYPTION_MASTER_KEY` was missing in production.
  2. `decryptSensitiveData` silently returned unencrypted plaintext in production.
  3. On decryption failure, `decryptSensitiveData` attempted a fallback derivation using `SUPABASE_SERVICE_ROLE_KEY`.
- **Remediation**:
  1. Removed all references to `SUPABASE_SERVICE_ROLE_KEY` in `src/utils/crypto.ts`.
  2. Enforced fail-closed behavior in production: if `ENCRYPTION_MASTER_KEY` is missing, encryption and decryption throw an explicit exception.
  3. Prohibited silent plaintext return in production: `decryptSensitiveData` throws an error if plaintext is encountered, unless explicitly running under `allowPlaintextFallback: true` during migration.
  4. Added `migrateLegacyPlaintextToEncrypted()` utility with immediate round-trip verification and secret-safe audit logging.
  5. Tested key rotation via `ENCRYPTION_MASTER_KEY_PREVIOUS`.

---

## 3. Verification & Regression Evidence

All remediations were validated using automated tests:
```bash
npx vitest run tests/enterpriseSecurityHardened.test.ts
```
Results:
- 23 of 23 security assertions passed in 25ms.
- Full repository test run: 53 test files, 429 tests passed in 3.56s.
- TypeScript strict check: 0 errors.
- Python security tests in `calculation_engine/testing`: 88 passed.
