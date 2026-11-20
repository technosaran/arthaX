# ArthaX Security Architecture & Threat Model

## 1. Overview
ArthaX is a multi-tenant personal wealth intelligence and portfolio management platform. Because it aggregates sensitive financial data across bank accounts, equities, mutual funds, bullion, crypto, and tax liabilities, its architecture is engineered with a **defense-in-depth** model.

Every layer—from browser state and CDN headers to API gateways, database engines, and external broker webhooks—implements cryptographic verification, zero-trust tenant isolation, and strict principle-of-least-privilege policies.

---

## 2. Authentication & Session Lifecycle

### 2.1 JWT Verification & Identity Derivation
- All protected API routes verify Supabase Auth JWT tokens using `getAuthenticatedUser(req)` located at `src/utils/auth.ts`.
- The user identity (`userId`) is extracted directly from the verified token claim (`sub`).
- **No Client Override**: Any attempt by a caller to supply an arbitrary `userId` or `user_id` query/payload parameter that differs from the authenticated JWT context is immediately rejected with HTTP 403 Forbidden.

### 2.2 Session Termination & Cache Purging
- When a user signs out via `AuthContext.signOut()`, the system:
  1. Invokes Supabase Auth `signOut()`.
  2. Calls `clearAllQueryCaches()`, which wipes all in-memory TanStack Query caches across all queries and mutations.
  3. Purges all user-scoped `localStorage` cache entries (`authax_cache_${userId}_*`).
  4. Flushes sensitive session variables, ensuring cross-user cache leakage on shared workstations is impossible.

---

## 3. Database Security & Row Level Security (RLS)

### 3.1 Strict RLS Enforcement
- RLS is permanently enabled across all 26 user-owned database tables (`accounts`, `income`, `expenses`, `budgets`, `stock_holdings`, `stock_transactions`, `crypto_holdings`, `crypto_trades`, `bullion_holdings`, `bond_holdings`, `user_settings`, etc.).
- Explicit policies enforce:
  - `SELECT`: `auth.uid()::text = user_id`
  - `INSERT`: `auth.uid()::text = user_id`
  - `UPDATE`: `auth.uid()::text = user_id` with `CHECK (auth.uid()::text = user_id)`
  - `DELETE`: `auth.uid()::text = user_id`
- Anonymous access (`anon` role) is explicitly revoked across all financial tables.

### 3.2 Workspace Wipe RPC Hardening (`fn_wipe_user_data`)
- Defined in migration `20261121000000_secure_master_wipe_and_integrity.sql`.
- Configured with `SECURITY DEFINER` and an explicit `SET search_path = public, pg_temp` to prevent search-path hijacking attacks.
- **BOLA Protection**: Enforces an un-bypassable authorization guard:
  ```sql
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access Denied: Cannot delete another user workspace';
  END IF;
  ```
- Executes an atomic, cascading deletion across all 26 user tables within a single database transaction, returning a structured JSON response indicating exact deleted record counts.

---

## 4. Cryptographic Operations & Secrets Management

### 4.1 Encryption Architecture (`src/utils/crypto.ts`)
- **Algorithm**: Authenticated Encryption with Associated Data (AEAD) using **AES-256-GCM**.
- **Nonce/IV**: A cryptographically random 12-byte IV is generated per encryption operation via `crypto.randomBytes(12)`. IVs are never reused.
- **Authentication Tag**: A 16-byte GCM authentication tag verifies ciphertext integrity and authenticity prior to decryption.
- **Key Derivation**: Keys are derived from `ENCRYPTION_MASTER_KEY` using SHA-256 (`crypto.createHash('sha256').update(masterKey).digest()`).
- **Zero-Downtime Fallback Strategy**:
  - Primary decryption attempts key derivation from `ENCRYPTION_MASTER_KEY`.
  - If decryption fails (e.g. legacy credentials encrypted prior to master key configuration), it safely attempts secondary fallback decryption using `SUPABASE_SERVICE_ROLE_KEY`.
  - If all keys fail or ciphertext is tampered with, it throws an explicit error rather than silently returning corrupted or plaintext data.

### 4.2 Credentials at Rest
- Sensitive external integration credentials (Zerodha API secrets, TOTP secrets, Binance API keys/secrets, Telegram bot tokens, WhatsApp webhooks) are encrypted before insertion into Supabase.
- Plaintext API tokens and passwords are never logged, returned in API responses, or exposed to frontend components.

---

## 5. API Protection & Network Boundaries

### 5.1 Rate Limiting & Abuse Prevention (`src/utils/rateLimit.ts`)
- Backed by Upstash Redis with deterministic sliding-window counters:
  - Financial read operations: 120 requests / minute per user.
  - Financial mutations (transactions, transfers): 30 requests / minute per user.
  - High-impact operations (workspace wipe, credentials update): 5 requests / 15 minutes per user.
- Graceful in-memory fallback protects local testing and ephemeral deployments when Redis is unreachable, while maintaining secure bounds.

### 5.2 Idempotency Enforcement
- Critical mutation endpoints (e.g., `POST /api/v1/transactions`, `POST /api/v1/transfers`) support the `Idempotency-Key` header.
- Idempotency keys are cached in Redis with a 24-hour TTL (`txn:${userId}:${idempotencyKey}`).
- Duplicate requests with identical keys are rejected with HTTP 409 Conflict to prevent duplicate debits or double transfers.

### 5.3 Webhook Verification
- **Telegram**: Validates secret path token / hash.
- **WhatsApp**: Enforces Cloud API HMAC-SHA256 signature verification (`X-Hub-Signature-256`) against `WHATSAPP_APP_SECRET`.
- **Zerodha / Cron**: Constant-time comparison (`constantTimeCompare`) of `CRON_SECRET` using `crypto.timingSafeEqual` prevents timing attacks.

---

## 6. Threat Model Matrix (STRIDE)

| Threat Category | Potential Attack Vector | Applied Mitigation | Verification |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker spoofs authenticated session | Supabase JWT verified cryptographically on every request; `auth.uid()` binding | Unit & integration tests |
| **Tampering** | Modifying financial balance or tax rates | Server-side Decimal calculation; immutable audit trail; GCM auth tags | Pytest AFCE & Vitest suites |
| **Repudiation** | Denying transaction or calculation action | Calculation logger records immutable calculation ID, timestamps, user ID, and hashes | `test_validation_dashboard_and_history_api` |
| **Information Disclosure** | Cross-tenant data leak via cache or RPC | Strict user-scoped cache keys (`getUserCacheKey`); RLS enforcement on all tables | Security regression test suite |
| **Denial of Service** | Flooding calculation engine with complex simulations | Redis rate limiting; input size limits (max 1000 items); execution timeouts | Rate limit tests |
| **Elevation of Privilege** | Normal user calling `fn_wipe_user_data` with another user's ID | Explicit authorization check (`auth.uid() = p_user_id`); revoked public grants | `tests/masterWipe.test.ts` |
