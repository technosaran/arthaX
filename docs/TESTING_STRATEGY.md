# ArthaX Comprehensive Testing & Quality Assurance Strategy

## 1. Testing Philosophy & Quality Gates
ArthaX enforces a multi-tier testing strategy combining fast unit checks, end-to-end API integration tests, financial accuracy regression benchmarks, and automated CI quality gates.

No code is merged or deployed without passing:
1. TypeScript strict typechecking (`tsc --noEmit`)
2. ESLint checks
3. Vitest test suite (Frontend components, Auth, Master wipe, Security regressions)
4. Pytest test suite (Python Financial Calculation Engine precision, tax rules, FIFO matching)
5. Production Next.js Turbopack build

---

## 2. Test Suite Architecture

```
tests/
├── masterWipe.test.ts          # BOLA authorization & cascading wipe verification
├── securityAuditSuite.test.ts  # Encryption, IV uniqueness, fallback, Redis tenant isolation
├── apiRoutes.test.ts           # Standard envelope & error structure tests
├── components/                 # React component rendering & accessibility tests
└── mocks/                      # Supabase & Upstash mock providers

calculation_engine/testing/
├── unit_tests/
│   ├── test_precision.py       # Strict Decimal parsing, NaN/Infinity rejection, currency precision
│   ├── test_networth_engine.py # Benchmark assets - liabilities, overdrafts, crypto precision
│   ├── test_portfolio_engine.py# XIRR numerical convergence, CAGR, realized/unrealized P&L
│   ├── test_expense_engine.py  # Debit aggregation, refunds, duplicate handling
│   ├── test_income_engine.py   # Income streams, net savings rate
│   ├── test_budget_engine.py   # Spending limits, rollover, overspending warnings
│   ├── test_reconciliation_engine.py # Accounting equation, double-entry transfer balances
│   └── test_tax_engine.py      # Budget 2024 CGT rates, FIFO matching, Sec 115BBH crypto rules
├── integration_tests/
│   └── test_api_routes.py      # FastAPI HTTP client endpoint tests
└── regression_tests/
    └── test_regressions.py     # Determinism invariants, zero-boundary, stability
```

---

## 3. Financial Accuracy Benchmarks

### 3.1 Net Worth Benchmark:
- **Input**: Assets = ₹100,000.00, Liabilities = ₹15,000.00
- **Expected Net Worth**: Exactly ₹85,000.00
- **Tolerance**: 0.00 (Zero binary floating-point drift)

### 3.2 Indian Capital Gains Tax (Budget 2024) Benchmark:
- **Scenario A (Equity LTCG)**: Buy ₹10,00,000 on 2023-01-01, Sell ₹12,25,000 on 2024-05-01.
  - Holding Days: 486 days (>= 365 days -> LTCG).
  - Total LTCG: ₹2,25,000.00.
  - Section 112A Exemption: ₹1,25,000.00.
  - Taxable LTCG: ₹1,00,000.00.
  - LTCG Tax (@ 12.5%): Exactly ₹12,500.00.
- **Scenario B (Equity STCG)**: Buy ₹2,00,000 on 2024-01-01, Sell ₹2,50,000 on 2024-04-01.
  - Holding Days: 91 days (< 365 days -> STCG).
  - Total STCG: ₹50,000.00.
  - STCG Tax (@ 20% under Section 111A): Exactly ₹10,000.00.
- **Scenario C (Crypto Sec 115BBH)**:
  - Trade 1 (BTC): Gain of ₹1,00,000.00.
  - Trade 2 (ETH): Loss of ₹50,000.00.
  - Tax (@ 31.2%): Exactly ₹31,200.00 on gross ₹1,00,000.00 (no loss deduction).

---

## 4. Execution Commands

```bash
# Execute Vitest test suite
npm test

# Run a specific Vitest test file
npx vitest run tests/securityAuditSuite.test.ts

# Execute full Pytest calculation engine suite
python -m pytest

# Run Pytest with verbose reporting
python -m pytest -v
```
