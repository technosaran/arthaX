# ArthaX — Production Deployment Runbook

**Date**: November 22, 2026  
**Auditor**: DevOps & Site Reliability Engineering Team  
**Platform**: Vercel Serverless + Supabase PostgreSQL + Upstash Redis

---

## 1. Pre-Deployment Verification Checklist

Before deploying changes to production, execute the automated quality gate locally or in CI:

```bash
# 1. Verify TypeScript types
npm run typecheck

# 2. Run all TypeScript / Next.js tests
npm test

# 3. Run all Python calculation engine tests
python -m pytest calculation_engine/testing

# 4. Run Turbopack production build
npm run build
```

---

## 2. Environment Variables Configuration (Vercel)

Ensure the following production secrets are configured in the Vercel Project Settings (`Settings -> Environment Variables`):

| Variable | Environment | Description |
| :--- | :---: | :--- |
| `OAUTH_STATE_SECRET` | Production | 32+ character high-entropy secret for HMAC-SHA256 OAuth state signing. |
| `ENCRYPTION_MASTER_KEY` | Production | 32+ character dedicated master key for AES-256-GCM token encryption. |
| `ENCRYPTION_MASTER_KEY_PREVIOUS` | Optional | Set during zero-downtime key rotation campaigns. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Administrative database key (strictly for backend Supabase client). |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Canonical URL of the Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Public anonymous client key. |
| `GOOGLE_CLIENT_ID` | Production | Google Cloud Console OAuth 2.0 Web Client ID. |
| `GOOGLE_CLIENT_SECRET` | Production | Google Cloud Console OAuth 2.0 Client Secret. |
| `NEXT_PUBLIC_APP_URL` | Production | `https://arthax.vercel.app` (enforces trusted canonical origins). |
| `CRON_SECRET` | Production | Bearer token protecting Vercel automation cron jobs. |
| `UPSTASH_REDIS_REST_URL` | Production | Upstash Redis connection endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Upstash Redis REST authorization token. |

---

## 3. Database Migration Deployment Procedure

Execute migrations against the production database sequentially:

```bash
# Verify connection
supabase db ping --project-ref <PROJECT_ID>

# Apply pending migrations
supabase db push
```

Alternatively, apply the SQL migrations via the Supabase Dashboard SQL Editor:
1. `supabase/migrations/20261127000000_database_idempotency_outbox_and_provenance.sql`
2. `supabase/migrations/20261127000001_harden_rpc_security_and_outbox_authorization.sql`

---

## 4. Rollback Plan

### Code Rollback
Vercel supports 1-click instantaneous deployment rollbacks:
1. Navigate to `Deployments` in Vercel.
2. Select the previous stable deployment (e.g., commit `49448c8` or earlier).
3. Click `Instant Rollback`.

### Database Rollback
The migrations are additive:
- If `20261127000001` or `20261127000000` need rollback, execute:
  ```sql
  DROP FUNCTION IF EXISTS public.fn_claim_outbox_jobs;
  DROP FUNCTION IF EXISTS public.fn_complete_outbox_job;
  DROP FUNCTION IF EXISTS public.fn_fail_outbox_job;
  DROP FUNCTION IF EXISTS public.fn_recover_stale_outbox_jobs;
  DROP FUNCTION IF EXISTS public.fn_consume_oauth_nonce;
  DROP FUNCTION IF EXISTS public.fn_claim_idempotency_key;
  DROP FUNCTION IF EXISTS public.fn_complete_idempotency_key;
  ```
  Existing transactions, accounts, and budgets are unaffected.
