# ArthaX Deployment, Runbooks & Operational Guide

**Document Version:** 2.0.0  
**Domain:** Cloud Infrastructure, Vercel Serverless, Background Workers, CI/CD, Observability  
**Target:** ArthaX Production (`https://arthax.vercel.app`)

---

## 1. Production Architecture & Environment Configuration

ArthaX deploys on Vercel Serverless (Next.js App Router) coupled with Supabase Managed PostgreSQL and Upstash Serverless Redis.

### 1.1 Mandatory Environment Variables Matrix

| Variable Name | Environment | Required | Description & Security Policy |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public / Client | Yes | HTTPS endpoint of the Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public / Client | Yes | Supabase public anon key for client-side Auth sessions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | Yes | Privileged service role key. Never exposed to browser. |
| `ENCRYPTION_MASTER_KEY` | Server-Only | Yes | 32-byte (256-bit) hex key for AES-256-GCM data encryption. |
| `ENCRYPTION_MASTER_KEY_PREVIOUS` | Server-Only | Optional | Previous 32-byte key used for zero-downtime key rotation. |
| `OAUTH_STATE_SECRET` | Server-Only | Yes | Cryptographic HMAC secret for signing OAuth state nonces. |
| `UPSTASH_REDIS_REST_URL` | Server-Only | Yes | HTTPS REST URL for Upstash Redis cluster. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-Only | Yes | REST authorization token for Upstash Redis. |
| `GMAIL_CLIENT_ID` | Server-Only | Yes | Google Cloud OAuth 2.0 Client ID for Gmail API. |
| `GMAIL_CLIENT_SECRET` | Server-Only | Yes | Google Cloud OAuth 2.0 Client Secret. |
| `CRON_SECRET` | Server-Only | Yes | Shared secret for authenticating Vercel Cron triggers. |
| `APP_URL` | Server-Only | Yes | Canonical production origin (`https://arthax.vercel.app`). |

---

## 2. Background Outbox Worker Operation

Large statement processing, OCR extraction, and recurring Gmail synchronizations are executed via the asynchronous job outbox.

### 2.1 Outbox Processor Execution Model
- **Worker Invocation:** Can run as a persistent containerized process (`python calculation_engine/workers/outbox_worker.py`) or as a scheduled serverless function triggering `POST /api/v1/jobs/recurring`.
- **Claim Batching:** Workers call `fn_claim_outbox_jobs(p_batch_size => 10, p_lease_seconds => 300)`.
- **Worker Concurrency:** Multiple workers execute in parallel without collisions due to PostgreSQL's `FOR UPDATE SKIP LOCKED`.
- **Stale Job Sweep:** Scheduled cron periodically executes `fn_recover_stale_outbox_jobs()` to reset abandoned or timed-out leases back to `PENDING` state.

---

## 3. Observability & Alerting Runbooks

### 3.1 Health Check Endpoints
- **Application Health:** `GET /api/health`
  - Validates Next.js runtime status, database connectivity, and Redis responsiveness.
- **Automation Status:** `GET /api/v1/automation/status`
  - Returns timestamp of latest cron execution, active integrations, and error counts.

### 3.2 Error Logging & Monitoring
- **Structured Logging (`src/utils/logger.ts`):** All logs emit standardized JSON with timestamps, log levels (`INFO`, `WARN`, `ERROR`), request IDs, and context tags (`SecurityGuard`, `StatementUpload`, `GmailService`).
- **PII / Financial Data Protection:** Statement PDF raw contents, OAuth secrets, account passwords, and raw balance tokens are strictly stripped and masked before logging.
- **Sentry Integration:** Client and server exceptions report to Sentry via `/sentry-tunnel`, bypassing ad-blockers while preserving tenant privacy.

### 3.3 Incident Runbook: High Discrepancy Alert
1. **Trigger:** Automated reconciliation alerts `health_score < 85%` or discrepant statements detected.
2. **Investigation:** Query `GET /api/v1/reconciliation/dashboard` to inspect list of discrepant accounts and statements.
3. **Audit Invariants:** Check if latest statement closing balance does not equal `Opening + Credits - Debits`.
4. **Remediation:** If missing internal transfer pairings exist, trigger `POST /api/v1/reconciliation/dashboard` with `action: TRIGGER_TRANSFER_RECONCILIATION`.
