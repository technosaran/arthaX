# ArthaX — Data Flow & Lifecycle Specifications

**Date**: November 22, 2026  
**Version**: 2.4.0

---

## 1. Bank Statement Ingestion & Reconciliation Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant Web as Next.js API (/statements/upload)
    participant Idem as Idempotency Guard (DB)
    participant Outbox as Job Outbox (DB)
    participant Py as Python FastAPI Service
    participant DB as PostgreSQL (Supabase)
    participant Cache as Upstash Redis

    User->>Web: Upload Statement PDF/CSV + Metadata
    Web->>Idem: Claim Idempotency Key (SHA-256 Payload Hash)
    Idem-->>Web: Lock Acquired (isFirstAttempt=true)
    Web->>Py: Send File Bytes & Context
    Py->>Py: Parse PDF/CSV -> Extract Transactions
    Py->>Py: Reconcile Opening/Closing Balances
    Py-->>Web: Normalized Transactions + Confidence Scores
    Web->>DB: Begin Transaction: Insert Canonical Records & Provenance
    Web->>DB: Update Account Balances (Atomic RPC)
    DB-->>Web: Commit Transaction
    Web->>Cache: Invalidate User Cache (ACCOUNTS, LEDGER)
    Web->>Idem: Complete Idempotency Record (Status 200)
    Web-->>User: Ingestion Success Summary
```

---

## 2. Hardened Google OAuth & Gmail Synchronization Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant Route as Next.js /oauth Route
    participant NonceDB as oauth_state_nonces (DB)
    participant Google as Google Accounts OAuth 2.0
    participant Callback as Next.js /callback Route
    participant Crypto as AES-256-GCM Crypto

    User->>Route: Initiate Gmail Connection (GET /api/v1/integrations/gmail/oauth)
    Route->>Route: Generate PKCE Verifier & Challenge
    Route->>Route: Generate Cryptographic Nonce
    Route->>NonceDB: Insert Nonce (Fail-Closed)
    Route->>Route: Sign State using OAUTH_STATE_SECRET (HMAC-SHA256)
    Route-->>User: Set HTTP-Only Cookies (arthax_oauth_nonce, arthax_oauth_verifier) & Redirect to Google
    User->>Google: Consent to Gmail Read-Only Access
    Google-->>Callback: Redirect with Authorization Code & State
    Callback->>Callback: Verify Signed State (Timing-Safe constantTimeCompare)
    Callback->>Callback: Validate Session Binding (auth.userId == state.userId)
    Callback->>Callback: Validate CSRF Nonce Cookie against State Nonce
    Callback->>NonceDB: Atomically Consume Nonce (fn_consume_oauth_nonce)
    Callback->>Callback: Require PKCE code_verifier Cookie
    Callback->>Google: Exchange Code + PKCE Verifier for Tokens
    Google-->>Callback: Return Access Token & Refresh Token
    Callback->>Crypto: Encrypt Tokens (enc:v1:...) using ENCRYPTION_MASTER_KEY
    Callback->>NonceDB: Upsert gmail_integrations Record
    Callback-->>User: Redirect to Settings with Success Banner
```

---

## 3. Transactional Outbox Worker Processing Flow

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Vercel Cron / Daemon Worker
    participant RPC as fn_claim_outbox_jobs (DB)
    participant Queue as job_outbox Table
    participant Handler as Job Handler Execution
    participant Complete as fn_complete_outbox_job (DB)
    participant Fail as fn_fail_outbox_job (DB)

    Cron->>RPC: Call fn_claim_outbox_jobs(workerId, batchSize=5)
    Note over RPC: Enforces caller_role == 'service_role'
    RPC->>Queue: SELECT FOR UPDATE SKIP LOCKED WHERE status='QUEUED'
    RPC->>Queue: UPDATE status='PROCESSING', locked_by=workerId
    RPC-->>Cron: Return Claimed Batch
    loop For each job in batch
        Cron->>Handler: Execute Worker Logic (e.g., GMAIL_SYNC)
        alt Execution Succeeded
            Cron->>Complete: fn_complete_outbox_job(jobId, resultJson)
        else Execution Failed
            Cron->>Fail: fn_fail_outbox_job(jobId, errorText)
            Note over Fail: Retries with exponential backoff or DEAD_LETTER if max_attempts exceeded
        end
    end
```
