# ArthaX Deployment & Operations Guide

## 1. Hosting Architecture
- **Web & API Tier**: Hosted on [Vercel](https://arthax.vercel.app) with edge-optimized regions (`bom1` / Mumbai for low latency across Indian users).
- **Python Calculation Engine**: Deployed natively as Vercel Python Serverless Functions under `api/index.py` (`/api/py/*` and `/api/calculations/*`).
- **Database**: Managed PostgreSQL on Supabase (`ytqqzeemkzhifbtthanh`).
- **Distributed Cache & Rate Limiter**: Serverless Redis on Upstash.
- **Monitoring & Telemetry**: Sentry exception tracking and performance tracing.

---

## 2. Pre-Deployment Verification Checklist

Before deploying any release to staging or production, run the automated quality gates locally or ensure GitHub Actions CI completes:

```bash
# 1. Typecheck TypeScript across entire project
npm run typecheck

# 2. Run ESLint
npm run lint

# 3. Run frontend and API Vitest suite
npm test

# 4. Run Python calculation engine Pytest suite
python -m pytest

# 5. Execute production Next.js build
npm run build
```

---

## 3. Environment Variable Provisioning

Ensure the following production secrets are configured in Vercel and GitHub Actions secrets:

### Supabase & Auth:
- `NEXT_PUBLIC_SUPABASE_URL`: Production Supabase Project URL (`https://ytqqzeemkzhifbtthanh.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Client-safe anonymous key.
- `SUPABASE_SERVICE_ROLE_KEY`: Privileged server-side key.
- `SUPABASE_JWT_SECRET`: Secret used to cryptographically verify user JWT signatures.

### Cryptography & Security:
- `ENCRYPTION_MASTER_KEY`: 32-byte secret used for AES-256-GCM encryption of broker and bot tokens.
- `CRON_SECRET`: High-entropy bearer secret for triggering scheduled sync jobs.
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis credentials.

### External Integrations:
- `ZERODHA_API_KEY` & `ZERODHA_API_SECRET`: Kite Connect credentials.
- `ZERODHA_AUTHORIZED_USER_ID`: Supabase user UUID allowed to sync Zerodha.
- `TELEGRAM_BOT_TOKEN`: Token issued by BotFather for Telegram financial assistant.

---

## 4. Rollback & Disaster Mitigation Procedure

### 4.1 Immediate Instant Rollback on Vercel
If an issue is detected post-deployment:
1. Open the [Vercel Dashboard](https://vercel.com/technosaran/arthax/deployments).
2. Select the previous stable deployment.
3. Click **Instant Rollback**. Traffic is redirected instantly (< 2 seconds) with zero build delay.

### 4.2 Database Migration Reversion
- If a database migration introduced an unintended constraint or index:
  1. Never drop or reset production tables.
  2. Author a forward-compatible corrective migration in `supabase/migrations/` (e.g. `DROP INDEX CONCURRENTLY` or `ALTER TABLE ... DROP CONSTRAINT`).
  3. Apply migration safely via Supabase CLI or Dashboard SQL editor.
