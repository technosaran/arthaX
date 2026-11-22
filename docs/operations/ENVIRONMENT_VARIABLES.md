# ArthaX — Environment Variables & Secrets Reference

**Date**: November 22, 2026  
**Auditor**: Infrastructure & Security Team

---

## 1. Required Production Variables

| Variable Name | Required | Minimum Length | Example Format | Purpose & Security Constraint |
| :--- | :---: | :---: | :--- | :--- |
| `OAUTH_STATE_SECRET` | **YES** | 32 chars | `a8f3b9c1d4e2...` | High-entropy HMAC signing key for Google & Gmail OAuth state parameter. Must NEVER be reused or defaulted. |
| `ENCRYPTION_MASTER_KEY` | **YES** | 32 chars | `e7c4f1a2d8b5...` | Primary key for AES-256-GCM envelope encryption of broker credentials and tokens at rest. |
| `ENCRYPTION_MASTER_KEY_PREVIOUS` | NO | 32 chars | `b2f4c9a1...` | Secondary key during zero-downtime key rotation campaigns. |
| `NEXT_PUBLIC_SUPABASE_URL` | **YES** | URL | `https://xxxx.supabase.co` | Supabase API URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **YES** | JWT | `eyJhbGci...` | Public client anonymous Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | JWT | `eyJhbGci...` | Server-side administrative key. Never exposed to browser or client bundles. |
| `GOOGLE_CLIENT_ID` | **YES** | Text | `xxxx.apps.googleusercontent.com` | Google Cloud OAuth 2.0 Web Client ID for Gmail ingestion. |
| `GOOGLE_CLIENT_SECRET` | **YES** | Text | `GOCSPX-xxxx...` | Google Cloud OAuth 2.0 Web Client Secret. |
| `NEXT_PUBLIC_APP_URL` | **YES** | URL | `https://arthax.vercel.app` | Canonical app URL for callback validation and open-redirect defense. |
| `CRON_SECRET` | **YES** | 16+ chars | `sec_cron_991...` | Bearer authorization secret protecting `/api/v1/automation/cron`. |
| `UPSTASH_REDIS_REST_URL` | **YES** | URL | `https://xxxx.upstash.io` | Upstash Redis REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | **YES** | Text | `AXxx...` | Upstash Redis REST bearer token. |

---

## 2. Optional & Development Variables

| Variable Name | Environment | Description |
| :--- | :---: | :--- |
| `ZERODHA_AUTHORIZED_USER_ID` | Production/Dev | Restricts Zerodha environment auto-login credentials to a specific authorized user UUID. |
| `TELEGRAM_BOT_TOKEN` | Production | Telegram Bot API token for notifications and statement digests. |
| `PYTHON_SERVICE_URL` | Production | URL for dedicated external Python processing cluster (defaults to internal serverless routes). |
