# ArthaX Database Architecture & Migration Guide

**Document Version:** 2.0.0  
**Target Database:** Supabase PostgreSQL 15+  
**Architecture Review:** PostgreSQL Database Architect & Lead DBA

---

## 1. Schema & Migration Summary

All ArthaX database schema modifications are version-controlled under `supabase/migrations/`. Every migration is designed to be strictly additive, non-destructive, and forward-compatible.

### 1.1 Latest Migration: `20261127000000_database_idempotency_outbox_and_provenance.sql`
This migration adds database-enforced idempotency, a transactional background job outbox, one-time OAuth state nonces, and financial transaction provenance columns.

```sql
-- Core Additions:
1. public.idempotency_keys:
   - Stores idempotency_key, user_id, request_hash (SHA-256), status, response_code, response_body.
   - Unique index on (user_id, idempotency_key).
   - Functions: fn_claim_idempotency_key, fn_complete_idempotency_key.

2. public.oauth_state_nonces:
   - Persists cryptographically random nonces with user binding and expiration timestamps.
   - Function: fn_consume_oauth_nonce (strictly one-time consumption to prevent replay).

3. public.job_outbox:
   - Supports transactional background job claiming with FOR UPDATE SKIP LOCKED.
   - Enforces max_attempts, exponential backoff (backoff_delay_ms), lease timeouts, and dead-lettering.
   - Functions: fn_claim_outbox_jobs, fn_complete_outbox_job, fn_fail_outbox_job, fn_recover_stale_outbox_jobs.

4. Financial Provenance Columns:
   - Added source_statement_id, source_type, and provenance_metadata JSONB to:
     * public.expenses
     * public.income
     * public.transfers
   - Created foreign key indexes referencing public.bank_statements(id) ON DELETE SET NULL.
```

---

## 2. Row-Level Security (RLS) Policy Audit

Every financial table in ArthaX is protected by PostgreSQL Row-Level Security. Unauthenticated or cross-tenant database access is rejected at the database engine level.

| Table Name | RLS Enabled | Tenant Scoping Rule | Permitted Roles | Notes |
|---|---|---|---|---|
| `accounts` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Strict tenant isolation. |
| `expenses` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Strict tenant isolation. |
| `income` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Strict tenant isolation. |
| `transfers` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Cross-account transfer audit. |
| `bank_statements` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | PDF statement records and file hashes. |
| `canonical_transactions` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Ingested transactions. |
| `idempotency_keys` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Claimed via SECURITY DEFINER RPC. |
| `job_outbox` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Worker claims via SECURITY DEFINER RPC. |
| `oauth_state_nonces` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | Consumed via SECURITY DEFINER RPC. |
| `user_classification_rules` | Yes | `user_id = auth.uid()` | `authenticated`, `service_role` | User transaction categorization rules. |

---

## 3. Critical Database Stored Procedures & Invariants

### 3.1 Idempotency Claim (`fn_claim_idempotency_key`)
```sql
CREATE OR REPLACE FUNCTION public.fn_claim_idempotency_key(
    p_key TEXT,
    p_user_id UUID,
    p_request_hash TEXT,
    p_ttl_seconds INT DEFAULT 3600
)
RETURNS TABLE (
    status TEXT,
    cached_response_code INT,
    cached_response_body JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
...
-- Performs FOR UPDATE row-level lock. Returns 'CACHED' if already executed with identical payload hash,
-- 'LOCKED' if currently in-flight by a concurrent worker, or 'CLAIMED' to allow execution.
$$;
```

### 3.2 Outbox Batch Claiming (`fn_claim_outbox_jobs`)
```sql
CREATE OR REPLACE FUNCTION public.fn_claim_outbox_jobs(
    p_batch_size INT DEFAULT 10,
    p_lease_seconds INT DEFAULT 300,
    p_job_types TEXT[] DEFAULT NULL
)
RETURNS SETOF public.job_outbox
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH available_jobs AS (
        SELECT id
        FROM public.job_outbox
        WHERE status = 'PENDING'
          AND scheduled_for <= NOW()
          AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
        ORDER BY scheduled_for ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.job_outbox j
    SET status = 'PROCESSING',
        attempts = j.attempts + 1,
        locked_until = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    FROM available_jobs a
    WHERE j.id = a.id
    RETURNING j.*;
END;
$$;
```

---

## 4. Disaster Recovery & Migration Rollback Protocol

1. **Pre-Migration Safety Snapshot:** Before executing any migration in production, take an automated point-in-time recovery (PITR) backup through the Supabase Dashboard.
2. **Backward-Compatibility Verification:** Ensure application servers are deployed with code compatible with both the previous and next database schemas before applying DDL changes.
3. **Rollback Procedures:**
   - Drop new RPCs if necessary: `DROP FUNCTION IF EXISTS public.fn_claim_idempotency_key;`
   - Revert provenance columns: `ALTER TABLE public.expenses DROP COLUMN IF EXISTS source_statement_id;`
   - **Never drop tables containing financial data without taking a verified export dump first.**
