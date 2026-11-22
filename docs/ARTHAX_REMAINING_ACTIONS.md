# ArthaX Remaining Actions & Production Deployment Checklist

**Document Version:** 2.0.0  
**Status:** Ready for Operations Review & Production Application  
**Target:** ArthaX Production Deployment

---

## 1. Actions Requiring Production Administrator Execution

The following administrative tasks require production credentials or external cloud console access outside the local codebase:

### 1.1 Apply Database Migration `20261127000000` to Hosted Supabase
- **File:** `supabase/migrations/20261127000000_database_idempotency_outbox_and_provenance.sql`
- **Action:** Execute migration against the production Supabase database (`fvpfzbuoizzjwgekuhot`).
- **Command (via Supabase CLI):**
  ```bash
  supabase db push --linked
  ```
  *Or copy and execute the script inside the Supabase SQL Editor.*
- **Impact:** Provisions `idempotency_keys`, `job_outbox`, `oauth_state_nonces`, stored procedures, and provenance columns. Non-destructive and forward-compatible.

### 1.2 Configure Dedicated Production Secrets in Vercel
Set the following environment variables in the Vercel Project Settings (`https://vercel.com/technosaran/arthax/settings/environment-variables`):
- `ENCRYPTION_MASTER_KEY`: Generate a cryptographically secure 32-byte hex string:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `OAUTH_STATE_SECRET`: Generate a cryptographically secure 32-byte hex string:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `APP_URL`: Set to canonical origin: `https://arthax.vercel.app`.

### 1.3 Google Cloud OAuth Verification & Consent Screen
- For Gmail bank statement synchronization to operate in production without test user restrictions, submit the Google Cloud OAuth Consent Screen for external verification for the restricted scope:
  `https://www.googleapis.com/auth/gmail.readonly`
- Add canonical authorized redirect URI in Google Cloud Console:
  `https://arthax.vercel.app/api/v1/integrations/gmail/callback`

### 1.4 Optional Worker Service for High-Volume Statement Outbox
- For heavy asynchronous PDF processing and background cron sweeps, deploy the background outbox worker:
  `python calculation_engine/workers/outbox_worker.py`
  on Railway, Render, or an existing Python container service with environment variable `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Unresolved Residual Risks & Mitigations

1. **Third-Party Bank Statement Format Drift:** Indian banks occasionally alter their statement PDF layout, column headings, or password conventions.
   - *Mitigation:* The Generic PDF Adapter acts as an automated heuristic fallback. Users can upload statements with custom passwords, and the Reconciliation Dashboard flags any mathematical balance discrepancies immediately.
2. **Upstash Redis Tier Rate Limits:** Heavy concurrent API traffic could reach Upstash free-tier quota.
   - *Mitigation:* The two-tier idempotency system falls back directly to PostgreSQL `idempotency_keys`, ensuring critical financial mutations are never lost or corrupted even if Redis is unavailable.
