# ArthaX — Next.js API Routes & Backend Architecture Audit

**Date**: November 22, 2026  
**Auditor**: Backend & Cloud Architecture Team  
**Scope**: Next.js App Router API endpoints, request validation, authentication context, rate limiting, and information disclosure.

---

## 1. Architectural Overview

The ArthaX API layer operates within the Next.js 16 App Router (`src/app/api/`). It provides serverless REST endpoints for dashboard analytics, bank statement processing, transaction operations, investment tracking, and OAuth integrations.

---

## 2. Endpoint Authorization & Identity Binding Matrix

| Route | Method | Auth Mechanism | User ID Binding | Idempotency |
| :--- | :---: | :---: | :---: | :---: |
| `/api/v1/transactions` | GET/POST | Supabase Session / Bearer | `auth.userId` strictly extracted | DB Idempotency Key |
| `/api/v1/transfers` | POST | Supabase Session | `auth.userId` strictly extracted | DB Idempotency Key |
| `/api/v1/statements/upload` | POST | Supabase Session | `auth.userId` strictly extracted | File hash deduplication |
| `/api/v1/integrations/gmail/oauth` | GET | Supabase Session | `auth.userId` in signed state | Nonce table + cookie |
| `/api/v1/integrations/gmail/callback` | GET | Direct Google OAuth | Bound to signed `userId` | Nonce consumption RPC |
| `/api/v1/integrations/gmail/sync` | POST | Supabase Session | `auth.userId` strictly extracted | Checkpoint lookback |
| `/api/v1/integrations/zerodha/callback` | GET | Kite OAuth | Session bound | Token exchange |
| `/api/v1/automation/cron` | GET/POST | Bearer `CRON_SECRET` | System-level worker | Bounded batching |
| `/api/v1/workspace/wipe` | POST | Master Password + Session | `auth.userId` strictly extracted | Immediate audit trail |

---

## 3. Administrative Client Usage Review

- **Isolation Principle**: All database interactions through `supabaseAdmin` are strictly scoped by `user_id = auth.userId`. No administrative query allows user-supplied parameters to override the authenticated tenant boundary.
- **Service Isolation**: Cron routes require `CRON_SECRET`. Auto-login and automated sync routes verify `ZERODHA_AUTHORIZED_USER_ID` or internal authorization headers.
- **Error Handling & Information Disclosure**:
  - All catch blocks sanitize internal database errors, stack traces, and SQL queries before responding to clients.
  - Client error messages use friendly generic strings (`"Authentication failed"`, `"Unable to process transaction"`) while detailed telemetry is dispatched to structured server logs.
