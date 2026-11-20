# ArthaX Environment Variables & Secrets Reference

All environment variables used across Next.js, FastAPI, database migrations, and CI workflows are documented below with their security scope and sensitivity.

## 1. Public Variables (Client-Safe)

| Variable Name | Required | Default / Format | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://<project-ref>.supabase.co` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOi...` | Supabase Anonymous Client Key (governed by RLS) |
| `NEXT_PUBLIC_APP_URL` | No | `https://arthax.vercel.app` | Base URL for absolute redirect callbacks |

---

## 2. Server-Only Secrets (Never Expose to Frontend)

| Variable Name | Required | Purpose | Security Notes |
| :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side database admin operations & fallback decryption | Highly privileged; bypasses RLS; keep confidential |
| `SUPABASE_JWT_SECRET` | Yes | Cryptographic signature verification of user JWT tokens | Required for FastAPI token decoding |
| `ENCRYPTION_MASTER_KEY` | Yes | Master AES-256-GCM encryption key for broker & bot secrets | Minimum 32 characters; rotating requires re-encrypting credentials |
| `CRON_SECRET` | Yes | Bearer token authenticating Vercel Cron and scheduled syncs | High entropy secret compared with constant-time equality |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST endpoint URL | Required for distributed rate-limiting and user caching |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis authentication token | Keep confidential |

---

## 3. External Integrations (Encrypted / Server-Side)

| Variable Name | Required | Purpose |
| :--- | :--- | :--- |
| `ZERODHA_API_KEY` | Optional | Zerodha Kite Connect API Key |
| `ZERODHA_API_SECRET` | Optional | Zerodha Kite Connect API Secret |
| `ZERODHA_AUTHORIZED_USER_ID` | Optional | Supabase User UUID permitted to run automated portfolio sync |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram Bot Father API token for financial assistant |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | Meta Cloud API Phone Number ID for WhatsApp logging |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Meta Graph API access token |
| `WHATSAPP_APP_SECRET` | Optional | Secret used to verify incoming webhook HMAC-SHA256 signatures |
| `WHATSAPP_VERIFY_TOKEN` | Optional | Challenge verification token for Meta webhook subscription |
| `SENTRY_DSN` | Optional | Sentry telemetry and error tracking DSN |
