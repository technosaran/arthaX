# ArthaX — Financial Integrity & Precision Audit

**Date**: November 22, 2026  
**Auditor**: Financial Systems Architecture Team  
**Scope**: Monetary calculation accuracy, floating-point elimination, minor-unit conversions, transaction idempotency, ledger reconciliation, and provenance audit trails.

---

## 1. Executive Summary

Financial software requires uncompromising deterministic precision. Floating-point arithmetic (`IEEE 754`) exhibits well-known rounding artifacts (`0.1 + 0.2 = 0.30000000000000004`) that compound across compounding balances, taxes, ledger reconciliations, and portfolio valuations.

This audit reviewed:
1. Python calculation engine (`calculation_engine/`) arithmetic.
2. TypeScript financial calculations (`src/utils/money.ts`, `src/utils/financialCalculations.ts`).
3. Database constraints on ledger and transactions.
4. Transaction deduplication and provenance metadata.

---

## 2. Core Integrity Principles Enforced

### A. Strict Decimal & Integer Minor Units
- **Python Service**: Utilizes Python's `decimal.Decimal` with explicit rounding contexts (`ROUND_HALF_UP`) and quantized precision (2 decimal places for INR/USD fiat, 8 decimal places for crypto).
- **TypeScript Service**: All frontend and intermediate API routes use minor-unit integer arithmetic (e.g., paise: ₹100.50 = 10050 paise) via `src/utils/money.ts`.
- **Database Schema**: All monetary columns in PostgreSQL are typed as `NUMERIC(15, 2)` or `NUMERIC(18, 4)` with check constraints prohibiting negative values on credit/debit balances (`CHECK (amount >= 0)`).

### B. Transaction Idempotency
- Stored procedure `fn_claim_idempotency_key` ensures:
  - Canonical request SHA-256 fingerprinting (independent of JSON key ordering).
  - Row-level lock (`FOR UPDATE`) preventing double-spend or duplicate transaction creation under concurrent clicks or network retries.
  - Replays of completed requests return cached responses without re-executing transactions.

### C. Balanced Internal Transfers
- Stored procedure `fn_reconcile_internal_transfers` guarantees double-entry bookkeeping invariants:
  - An internal transfer must have equal credit and debit magnitudes.
  - Source and destination accounts must belong to the same authenticated user.
  - Prevents transfers across distinct tenant boundaries.

### D. Financial Provenance Audit Trail
- Migration `20261127000000_database_idempotency_outbox_and_provenance.sql` adds provenance columns:
  - `source_statement_id`: Foreign key reference to `public.bank_statements(id)`.
  - `source_type`: Explicit tag (`MANUAL`, `GMAIL_SYNC`, `STATEMENT_UPLOAD`, `RECONCILED_TRANSFER`).
  - `provenance_metadata`: Captures original line number, extracted timestamp, parser confidence score, and raw transaction description.

---

## 3. Test & Verification Evidence

- `tests/money.test.ts`: 10 passed (minor-unit round-trip, division rounding, formatting).
- `tests/financialCalculations.test.ts`: 15 passed (compounding, portfolio valuation, tax deductions).
- `tests/financialPrecisionStrict.test.ts`: 11 passed (floating-point defense assertions).
- `tests/balanceReconciliation.test.ts`: 3 passed (out-of-order statement uploads preserve latest verified balance).
- `tests/transfersReconciliation.test.ts`: 8 passed (double-entry invariants and settlement windows).
- Python `test_precision.py`: 7 tests passed with zero decimal loss.
