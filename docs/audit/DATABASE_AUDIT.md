# ArthaX — Database & SQL Migration Audit

**Date**: November 22, 2026  
**Auditor**: Database Architecture & PostgreSQL Security Team  
**Scope**: Schema migrations, Row Level Security (RLS), SECURITY DEFINER functions, indexing efficiency, and concurrency control.

---

## 1. Schema & Migration History Assessment

The repository tracks 29 chronological migrations in `supabase/migrations/`:
- `20261111000000` through `20261126000000`: Foundational tables, RLS policies, family finance, investments (stocks, mutual funds, F&O, bullion), Zerodha integrations, and transaction reconciliation.
- `20261127000000_database_idempotency_outbox_and_provenance.sql`: Introduces `idempotency_keys`, `oauth_state_nonces`, `job_outbox`, and provenance columns.
- `20261127000001_harden_rpc_security_and_outbox_authorization.sql`: Hardening migration enforcing role checks and revoking unauthorized execution privileges.

### Live Database Application Status Check
- **Verification Performed**: Live Supabase instance was queried for table presence.
- **Result**: `idempotency_keys`, `job_outbox`, and `oauth_state_nonces` did not exist in the live schema cache, confirming that `20261127000000` had not yet been applied.
- **Action Taken**: Both `20261127000000` and forward migration `20261127000001` were hardened with caller authorization checks and explicit `REVOKE ALL ... FROM PUBLIC, anon, authenticated` statements, guaranteeing zero privilege leak regardless of whether migrations are executed afresh or sequentially.

---

## 2. Row Level Security (RLS) Matrix

| Table | RLS Status | Policies Enforced |
| :--- | :---: | :--- |
| `accounts` | ENABLED | Users select, insert, update, delete only where `auth.uid()::text = user_id` |
| `expenses` | ENABLED | Tenant-isolated via `auth.uid()::text = user_id` |
| `income` | ENABLED | Tenant-isolated via `auth.uid()::text = user_id` |
| `transfers` | ENABLED | Tenant-isolated via `auth.uid()::text = user_id` |
| `idempotency_keys` | ENABLED | Isolated view and mutation for authenticated owner |
| `oauth_state_nonces`| ENABLED | Authenticated owner view; atomic mutation via RPC |
| `job_outbox` | ENABLED | Authenticated owner view and insert; processing updates restricted to `service_role` |
| `zerodha_integrations` | ENABLED | Authenticated owner only; token encrypted at rest |
| `gmail_integrations` | ENABLED | Authenticated owner only; token encrypted at rest |

---

## 3. SECURITY DEFINER Stored Procedures Audit

| Function | Execution Role | Caller Verification Check | Search Path |
| :--- | :---: | :---: | :---: |
| `fn_claim_idempotency_key` | `authenticated, service_role` | `v_caller_role = 'service_role' OR auth.uid()::text = p_user_id` | `public, pg_temp` |
| `fn_complete_idempotency_key`| `authenticated, service_role` | `v_caller_role = 'service_role' OR auth.uid()::text = p_user_id` | `public, pg_temp` |
| `fn_consume_oauth_nonce` | `authenticated, service_role` | `v_caller_role = 'service_role' OR auth.uid()::text = p_user_id` | `public, pg_temp` |
| `fn_claim_outbox_jobs` | `service_role` ONLY | `v_caller_role = 'service_role'` (Raises exception on others) | `public, pg_temp` |
| `fn_complete_outbox_job` | `service_role` ONLY | `v_caller_role = 'service_role'` (Raises exception on others) | `public, pg_temp` |
| `fn_fail_outbox_job` | `service_role` ONLY | `v_caller_role = 'service_role'` (Raises exception on others) | `public, pg_temp` |
| `fn_recover_stale_outbox_jobs`| `service_role` ONLY | `v_caller_role = 'service_role'` (Raises exception on others) | `public, pg_temp` |

---

## 4. Concurrency & Locking Strategy

- **Atomic Job Claims**: `fn_claim_outbox_jobs` uses `FOR UPDATE SKIP LOCKED`, preventing multiple worker processes from colliding or blocking on identical job records.
- **Idempotency Claims**: `fn_claim_idempotency_key` uses row-level locking (`FOR UPDATE`) on the unique `(user_id, idempotency_key)` tuple.
- **Race Condition Prevention**: Prevents concurrent duplicate transaction processing across tabs or simultaneous webhook callbacks.
