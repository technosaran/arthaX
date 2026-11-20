# ArthaX — Production Readiness, Security & Financial Accuracy Audit

**Audit Date:** November 2026  
**Audited Platform:** ArthaX Personal Finance & Wealth Management  
**Target Environment:** Vercel (Next.js 16 + React 19) + Supabase (PostgreSQL 15+ with RLS) + Python FastAPI + Upstash Redis  
**Audit Scope:** Full codebase discovery across Frontend, Backend APIs, Python Analytics Engine, Database Migrations, RLS Policies, Encryption, Integrations, Background Jobs, and CI/CD.

---

## 1. Executive Summary

A comprehensive, multi-disciplinary audit of the ArthaX codebase was conducted across security, financial accuracy, data integrity, backend architecture, performance, and DevOps.

While ArthaX demonstrates strong modern design patterns (Next.js App Router, Turbopack, Tailwind CSS 4, TanStack Query, Upstash Redis caching, Sentry telemetry, and a dedicated Python Financial Calculation Engine), critical vulnerabilities and financial calculation inaccuracies were uncovered that impede production readiness:

1. **P0 Security Vulnerability:** A Broken Object Level Authorization (BOLA) flaw in database migration `20261118000000_fix_security_and_wipe.sql` where `fn_wipe_user_data` was recreated without verifying `auth.uid() = p_user_id`, allowing any authenticated user to wipe another user's entire workspace.
2. **P0 Tenant Isolation Vulnerability:** TanStack Query client cache in the frontend is not purged on logout (`queryClient.clear()` missing in `AuthContext`), leading to cross-user cached data leakage on shared devices or account switching.
3. **P1 Financial Inaccuracy:** The Indian Capital Gains Tax analytics endpoint hardcodes LTCG to zero, estimates acquisition costs as a flat 85% of sell proceeds, uses database row timestamps instead of purchase dates, and omits Crypto (Sec 115BBH), Bonds, and Bullion.
4. **P1 Net Worth Distortion:** Net Worth and Analytics endpoints calculate stock valuation using purchase cost (`quantity * avg_buy_price`) rather than live market price, count bullion as purchase cost rather than weight × market rate, and calculation engine modules silently fall back to purchase prices when market prices are missing without exposing valuation metadata.
5. **P1 Date Boundary Errors:** Next.js API routes construct month filters with `${month}-31`, triggering PostgreSQL date syntax errors on months with fewer than 31 days (e.g. February, April, June, September, November).
6. **P1 Broken Global Pagination:** Transaction pagination queries expenses and income separately with `range(offset, offset + limit - 1)` and concatenates them, failing to provide true global chronological sorting.

---

## 2. Classification of Findings

| ID | Severity | Category | Title | Status |
|---|---|---|---|---|
| **SEC-01** | **P0** | Database / RLS | BOLA & Unauthorized Workspace Wipe in `fn_wipe_user_data` | **RESOLVED** (Migration `20261121000000`) |
| **SEC-02** | **P0** | Frontend / Auth | Cross-User Session Cache Contamination on Logout | **RESOLVED** (`AuthContext.tsx` & `QueryProvider.tsx`) |
| **SEC-03** | **P2** | Crypto / Secrets | Insecure Fallback in Encryption Key Derivation | **RESOLVED** (`src/utils/crypto.ts`) |
| **SEC-04** | **P2** | Redis / Caching | Anonymous User Fallback Key in Cache Isolation | **RESOLVED** (`SettingsSection.tsx` & `redis.ts`) |
| **FIN-01** | **P1** | Financial / Tax | Hardcoded LTCG Zero, 85% Cost Basis & Missing Categories in Tax Engine | **RESOLVED** (`tax_engine.py` & `analytics/tax/route.ts`) |
| **FIN-02** | **P1** | Financial / NetWorth | Stock & Bullion Valuation Distortion in Net Worth & Analytics | **RESOLVED** (`analytics/route.ts` & `networth_engine.py`) |
| **FIN-03** | **P1** | Financial / Precision | Silent Conversion of Invalid/NaN Inputs to Zero in Precision Engine | **RESOLVED** (`precision.py` & `validators.py`) |
| **FIN-04** | **P1** | Financial / Reconciliation | Reconciliation Engine Lacks True Accounting Variance Checks | **RESOLVED** (`reconciliation_engine.py`) |
| **DAT-01** | **P1** | Database / API | Fragile Month-End Date Filter (`${month}-31`) Causing DB Exceptions | **RESOLVED** (`transactions/route.ts` & `transfers/route.ts`) |
| **DAT-02** | **P1** | Database / API | Broken Pagination in Unified Transactions Route | **RESOLVED** (`transactions/route.ts`) |
| **DAT-03** | **P1** | Database / Schema | Incomplete Table Coverage in Workspace Data Wipe | **RESOLVED** (Migration `20261121000000` & `wipe/route.ts`) |
| **ARC-01** | **P2** | Backend / Architecture | Duplication between `api/index.py` and `python_service/main.py` | **RESOLVED** (`python_service/main.py`) |
| **ARC-02** | **P2** | Backend / Audit | Ephemeral In-Memory Calculation History Audit Trail | **RESOLVED** (`calculation_routes.py` & `calculation_logger.py`) |
| **OPS-01** | **P2** | CI/CD / Cron | Duplicate Job Schedules Between Vercel Cron and GitHub Actions | **RESOLVED** (`zerodha_auto_sync.yml` & `cron/route.ts`) |
| **OPS-02** | **P2** | CI/CD | Missing Automated PR Validation Workflow | **RESOLVED** (`.github/workflows/ci.yml`) |

---

## 3. Detailed Audit Findings & Remediation Plans

### Finding SEC-01 [P0]: BOLA in `fn_wipe_user_data`
- **File:** `supabase/migrations/20261118000000_fix_security_and_wipe.sql:40-140`
- **Root Cause:** When updating `fn_wipe_user_data` to support Bonds, Bullion, and Zerodha in migration `20261118000000`, the author omitted the authorization gate:
  ```sql
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not authorized to wipe user data.';
  END IF;
  ```
- **Impact:** Any authenticated user can issue an RPC call `supabase.rpc('fn_wipe_user_data', { p_user_id: '<victim_id>' })` to destroy all financial data of another user.
- **Solution:** Create migration `20261121000000_secure_master_wipe_and_integrity.sql` to reinstate the strict caller verification check (`auth.uid()::text = p_user_id` or `auth.role() = 'service_role'`) and expand coverage to all asset classes.
- **Verification Plan:** Unit and integration tests executing cross-tenant RPC calls with two distinct test UUIDs.

---

### Finding SEC-02 [P0]: Cross-User Session Cache Contamination on Logout
- **File:** `src/context/AuthContext.tsx:264-271` & `src/context/QueryProvider.tsx`
- **Root Cause:** When `signOut()` is executed, `clearLocalFinancialCache()` only purges localStorage items and custom in-memory map. TanStack React Query's `QueryClient` cache is never reset or cleared.
- **Impact:** Upon sign out, cached queries (accounts, stock holdings, tax analysis, portfolio summaries) remain in memory for up to 5 minutes (`gcTime: 5 * 60 * 1000`), exposing private financial records to any subsequent user logging in on the same browser session.
- **Solution:** Expose `queryClient` or call `queryClient.clear()` directly inside `signOut()` before routing to `/login`.
- **Verification Plan:** Vitest test simulating logout and asserting that `queryClient.getQueryCache().getAll()` is completely empty.

---

### Finding FIN-01 [P1]: Hardcoded Zero LTCG & 85% Cost Basis in Tax Engine
- **File:** `src/app/api/v1/analytics/tax/route.ts:161-170` & `api/index.py:436-520`
- **Root Cause:**
  1. `const equityLtcgGain = 0;` (hardcoded zero).
  2. `const estimatedCost = proceeds * 0.85;` (hardcoded 85% cost basis estimate).
  3. `const buyDate = stock.created_at ? new Date(stock.created_at) : now;` (row creation timestamp used as asset purchase date).
  4. Complete omission of Crypto (Virtual Digital Assets under Section 115BBH flat 30% tax with no loss setoff), Bonds, and Bullion.
- **Impact:** Misleading capital gains calculations and tax-loss harvesting recommendations presented to users as financial analysis.
- **Solution:** Implement a modular, versioned Tax Engine supporting Union Budget 2024 / FY 2024-25 provisions with FIFO purchase-lot matching, actual buy price and date, proper LTCG/STCG classification, and explicit disclaimers that output is an estimate requiring professional verification.
- **Verification Plan:** Independent calculation benchmark tests matching Indian IT Act provisions for Equity (Sec 111A/112A), Debt, Bullion, and Crypto (Sec 115BBH).

---

### Finding FIN-02 [P1]: Stock & Bullion Valuation Distortion in Net Worth & Analytics
- **File:** `src/app/api/v1/analytics/route.ts:182-209`, `calculation_engine/modules/networth_engine.py`, `portfolio_engine.py`
- **Root Cause:**
  1. Stocks are multiplied by `avg_buy_price` instead of live market price.
  2. Bullion is summed as `total_buy_price` instead of `weight_grams * current_rate_per_gram`.
  3. Python engine silently sets `cur_price = avg_price` if market price is missing or zero without tracking valuation source or staleness.
- **Impact:** Net worth and asset allocation dashboards display purchase costs instead of real-time market value.
- **Solution:** Select `current_price` from `stock_holdings`, calculate bullion market value using live/stored rates per gram, and expose valuation source (`live`, `cached`, `cost_basis_fallback`) and timestamp in the calculation response.
- **Verification Plan:** Unit tests with varying market prices vs purchase costs proving market value is accurately calculated.

---

### Finding FIN-03 [P1]: Silent Conversion of Invalid/NaN Inputs in Precision Engine
- **File:** `calculation_engine/core/precision.py:20-56`
- **Root Cause:** `to_decimal()` converts `NaN`, `Inf`, and invalid strings into `Decimal("0.00")` via try/except fallback.
- **Impact:** Corrupted inputs or invalid financial payloads silently pass as zero rather than being rejected.
- **Solution:** Introduce explicit input validation that rejects `NaN`, `Infinity`, and unparseable strings with `InvalidFinancialDataError`, while safely handling legitimate zero or None defaults only when explicitly marked optional.
- **Verification Plan:** Pytest suite testing boundary cases: `"NaN"`, `float("nan")`, `"invalid"`, `float("inf")`.

---

### Finding FIN-04 [P1]: Reconciliation Engine Lacks True Accounting Variance Checks
- **File:** `calculation_engine/modules/reconciliation_engine.py:146-182`
- **Root Cause:** Summarizes account flows without comparing against actual account balances (`Expected Closing Balance = Opening Balance + Income - Expenses + Transfers In - Transfers Out; Variance = Recorded - Expected`).
- **Impact:** Discrepancies between ledger transactions and account balances are not detected or reported.
- **Solution:** Enhance `ReconciliationEngine` to compute expected balance from opening balance and net flows, verify balance variance for each account, and return structured discrepancies explaining exact variance.
- **Verification Plan:** Benchmark test with simulated unmatched transaction causing variance detection.

---

### Finding DAT-01 [P1]: Fragile Month-End Date Filter (`${month}-31`)
- **File:** `src/app/api/v1/transactions/route.ts:61,78`, `src/app/api/v1/transfers/route.ts:48`
- **Root Cause:** Query filters construct `.lte("date", `${month}-31`)`. Months with 28, 29, or 30 days trigger PostgreSQL `date/time field value out of range` errors.
- **Impact:** API requests for February, April, June, September, and November fail with 500 errors.
- **Solution:** Compute exclusive next-month start date (e.g. `gte("2026-02-01").lt("2026-03-01")`).
- **Verification Plan:** API integration test querying transactions for February (`2026-02`) and April (`2026-04`).

---

### Finding DAT-02 [P1]: Broken Pagination in Unified Transactions Route
- **File:** `src/app/api/v1/transactions/route.ts:67,84,92-105`
- **Root Cause:** Range queries `range(offset, offset + limit - 1)` are applied independently to `expenses` and `income` tables, after which results are concatenated in memory.
- **Impact:** Pagination does not guarantee global chronological order; page 2 can return older or newer records depending on relative count distributions.
- **Solution:** Fetch transactions with proper date boundaries and global sorting or provide unified ledger query.
- **Verification Plan:** Unit test verifying global ordering across mixed income and expense datasets.

---

### Finding DAT-03 [P1]: Incomplete Table Coverage in Workspace Data Wipe
- **File:** `supabase/migrations/20261118000000_fix_security_and_wipe.sql`, `src/app/api/v1/workspace/wipe/route.ts`
- **Root Cause:** Does not purge `crypto_holdings`, `crypto_trades`, `binance_integrations`, `telegram_integrations`, or user goals.
- **Impact:** A wiped workspace leaves orphaned crypto holdings and active broker API keys.
- **Solution:** Add comprehensive cascade deletion across all user-owned tables in the stored procedure and API route.
- **Verification Plan:** Master wipe test verifying all 18 user-scoped tables are empty after execution.

---

### Finding ARC-01 [P2]: Duplicate Python Application Implementations
- **File:** `api/index.py` vs `python_service/main.py`
- **Root Cause:** Two near-identical 600+ line FastAPI applications maintain duplicate route handlers, Pydantic schemas, and Monte Carlo algorithms.
- **Impact:** Divergence between local runner and production Vercel serverless deployments.
- **Solution:** Extract common routes and models into shared modules, making `api/index.py` and `python_service/main.py` thin entry points.
- **Verification Plan:** Pytest and FastAPI TestClient executing tests against both entry points.

---

### Finding ARC-02 [P2]: Ephemeral In-Memory Calculation Audit Trail
- **File:** `calculation_engine/audit/calculation_logger.py:11-15`
- **Root Cause:** Uses an in-memory `deque(maxlen=2000)` which is wiped on every serverless instance restart and shared across requests within a container.
- **Impact:** Compliance calculation history is lost across cold starts and not persisted per user.
- **Solution:** Introduce persistent calculation logging schema and audit records scoped by authenticated `user_id`.
- **Verification Plan:** Test verifying calculation records are recorded with user context.

---

### Finding OPS-01 [P2]: Duplicate Cron Scheduling Between Vercel and GitHub Actions
- **File:** `vercel.json` and `.github/workflows/zerodha_auto_sync.yml`
- **Root Cause:** Both systems trigger Zerodha sync at `03:00 UTC`, creating race conditions and duplicate sync attempts.
- **Solution:** Use distributed lock via Redis in the sync endpoint and stagger/designate the primary runner.
- **Verification Plan:** Test verifying concurrent sync requests acquire lock and second caller exits safely.

---

### Finding OPS-02 [P2]: Missing Automated Pull Request CI Workflow
- **File:** `.github/workflows/`
- **Root Cause:** Only `supabase_migrations.yml` (on push to main) and `zerodha_auto_sync.yml` exist. No PR CI workflow.
- **Solution:** Create `.github/workflows/ci.yml` running lint, typecheck, Vitest, pytest, and production build on pull requests.
- **Verification Plan:** Validate workflow syntax and run local verification steps.
