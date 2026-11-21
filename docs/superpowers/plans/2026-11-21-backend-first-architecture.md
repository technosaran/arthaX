# Implementation Plan: Backend-First Architecture & Hidden Internal Systems

**Date**: November 21, 2026  
**Target Repository**: ArthaX Personal Finance Intelligence  
**Focus**: Backend-First Processing, AFCE Decimal Calculation Engine, Automated Bank Statement Pipeline, Background Automation, Security & Developer Observability without Exposing Internal UI.

---

## Proposed Changes

### 1. Decimal Precision Core Utility (`src/utils/money.ts`)
- Safe Decimal and fixed-point currency arithmetic (scaled integer/cents math) preventing IEEE 754 float drift across Next.js backend services.
- Functions: `addMoney`, `subMoney`, `mulMoney`, `divMoney`, `roundMoney`, `percentMoney`, `sumMoney`.
- Strict validation: rejects `NaN`, `Infinity`, unparseable values; maintains 2-decimal fiat precision.

### 2. Backend Financial Recalculation & Analytics (`src/app/api/v1/analytics/route.ts`)
- Refactor calculations to use `Money` precision arithmetic.
- Incorporate canonical transactions alongside manual entries.
- Automatically persist daily net worth snapshots in `net_worth_snapshots` table.
- Cache invalidation and multi-asset valuation.

### 3. Automated Bank Statement & Gmail Ingestion (`calculation_engine/bank_ingestion/gmail_service.py`)
- Full Google Gmail REST API client (`users/me/messages`, `users/me/messages/{id}`, `users/me/messages/{id}/attachments/{id}`).
- Bank identification from sender headers (`sbi.co.in`, `indianbank.co.in`, etc.) and subject cues.
- Recursive MIME multipart attachment extractor for `.pdf` and `.csv`.
- Secure in-memory password decryptor with candidate generator.
- Mathematical validation (`Opening + Credits - Debits == Closing`).
- Transaction classification and internal transfer matching.
- New endpoint in `calculation_engine/api/calculation_routes.py`: `POST /statements/gmail/sync`.

### 4. Background Automation Cron & Token Management (`src/utils/gmail.ts`, `src/app/api/v1/automation/cron/route.ts`, `vercel.json`)
- Google OAuth refresh token handling with AES-256-GCM encryption.
- Scheduled automation cron endpoint (`/api/v1/automation/cron`):
  - Bearer `CRON_SECRET` authentication.
  - Redis distributed lock (`checkAndSetIdempotency`).
  - Processes active users.
  - Stores statements in `bank_statements` and transactions in `canonical_transactions`.
  - Synchronizes verified records to ledger (`expenses`, `income`, `transfers`).
  - Recalculates account balances and net worth snapshots.
  - Tracks job status, stats, retries, and errors in `automation_jobs`.
- Register crons in `vercel.json` (`/api/v1/automation/cron`, `/api/v1/jobs/recurring`, `/api/v1/integrations/zerodha/cron`).

### 5. Security & Observability Hardening
- Restrict `/api/v1/calculations/validation` and global history to authorized admin/developer credentials.
- Enforce strict user isolation for user-specific calculation history and automation status.
- Add Python calculation engine health check to `/api/health`.

### 6. Database Migration (`supabase/migrations/20261123000000_networth_snapshots_and_automation_hardening.sql`)
- Create `net_worth_snapshots` table with RLS policies and unique constraint `(user_id, snapshot_date)`.
- Add performance indexes.

### 7. Test Suite
- `tests/money.test.ts` (TypeScript decimal arithmetic)
- `tests/automationCron.test.ts` (Cron auth, lock, statement sync, retry, failure logging)
- `tests/developerObservability.test.ts` (Admin auth, user isolation, health check)
- `calculation_engine/testing/unit_tests/test_gmail_ingestion.py` (MIME parsing, bank detection, password handling, math validation)

---

## Verification Plan

### Automated Tests
- Run `npm test` (Vitest) - all existing 312 tests + new tests must pass.
- Run `python -m pytest` (Pytest) - all existing 57 tests + new tests must pass.
- Run `npm run typecheck` (`tsc --noEmit`) - zero TypeScript compilation errors.
