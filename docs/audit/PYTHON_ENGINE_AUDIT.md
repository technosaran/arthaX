# ArthaX — Python FastAPI Calculation Engine Audit

**Date**: November 22, 2026  
**Auditor**: Senior Python Systems & Calculation Engine Team  
**Scope**: FastAPI routes, modular parser architecture, OCR safety, memory constraints, and financial computation accuracy.

---

## 1. Engine Architecture & Design

The Python processing engine is located in `calculation_engine/` and served via FastAPI in `api/index.py` and `python_service/main.py`. It is responsible for:
1. High-throughput bank statement extraction (PDF and CSV parsing).
2. OCR fallbacks for scanned physical statements.
3. Complex financial math (tax harvesting, compounding net worth projections, cashflow forecasting, portfolio analytics).

---

## 2. Security Boundaries & Service Isolation

- **Mutual Service Authentication**: Internal endpoints require an internal service header or run within the protected Vercel serverless environment.
- **Resource Exhaustion Mitigation (ReDoS / Zip Bomb / Malformed PDF)**:
  - Strict upload size bounds enforced on PDF inputs.
  - Page-count bounds: statements with excessive pages (>50 pages) are capped or batched to prevent memory exhaustion.
  - Bounded OCR execution timeout prevents hanging Tesseract / CV2 processes.
- **Data Protection**:
  - Temporary files created during PDF rasterization and OCR are written to ephemeral directories and deleted in `finally` blocks.
  - Passwords and extracted account numbers are never logged in plaintext.

---

## 3. Financial Calculation Parity with TypeScript

The engine provides parity with TypeScript calculations:
- `TaxEngine`: Implements Section 80C, 80D, Old vs New Regime calculation rules for Indian Income Tax.
- `NetWorthEngine`: Aggregates liquid cash, equities, mutual funds, bullion, fixed income, and crypto minus liabilities.
- `ReconciliationEngine`: Compares opening balance + credits - debits against closing balance; flags discrepancies with precision down to 0.01 INR.

---

## 4. Test Verification Evidence

Executed:
```bash
python -m pytest calculation_engine/testing
```
Result: **88 passed, 0 failed** in 4.48s.
- `test_api_routes.py`: 8 passed
- `test_regressions.py`: 3 passed
- `test_advanced_engines.py`: 3 passed
- `test_all_bank_adapters.py`: 5 passed
- `test_bank_adapters_hardened.py`: 6 passed
- `test_bank_ingestion.py`: 7 passed
- `test_budget_engine.py`: 1 passed
- `test_expense_engine.py`: 7 passed
- `test_gmail_ingestion.py`: 5 passed
- `test_gmail_service_hardened.py`: 4 passed
- `test_income_engine.py`: 2 passed
- `test_investment_engine.py`: 1 passed
- `test_networth_engine.py`: 3 passed
- `test_pdf_security_hardening.py`: 8 passed
- `test_portfolio_engine.py`: 3 passed
- `test_precision.py`: 7 passed
- `test_reconciliation_engine.py`: 2 passed
- `test_tax_engine.py`: 4 passed
- `test_transaction_intelligence.py`: 9 passed
