# ArthaX Financial Calculation Engine (AFCE)

## 1. Executive Summary & Design Principles
The **ArthaX Financial Calculation Engine (AFCE)** is a zero-floating-point-error, deterministic computational subsystem. It powers all asset valuations, net worth tracking, portfolio performance analytics, budget rollover reconciliation, and statutory Indian capital gains tax simulations.

### Non-Negotiable Engineering Rules:
1. **Decimal Precision**: All currency and monetary calculations use Python `Decimal` with strict bankers' or half-up quantization. IEEE 754 binary floating-point representation (`float`) is prohibited for monetary storage and aggregation.
2. **Deterministic Outputs**: Given identical inputs, calculations produce byte-for-byte identical results regardless of execution platform or timestamp.
3. **No Silent Fallbacks**: Missing prices or invalid values are never silently coerced to zero. Unpriced assets are explicitly flagged with `is_price_fallback` and tracked in `valuation_metadata`.
4. **Statutory Fidelity**: Tax models adhere strictly to the Income Tax Act, 1961 as amended by the **Union Budget 2024 / Finance (No. 2) Act, 2024**.

---

## 2. Core Modules Architecture

```
calculation_engine/
├── core/
│   ├── base_calculator.py      # Abstract Base Calculator with timing & audit hooks
│   ├── precision.py            # Decimal conversion, currency maps, crypto precision
│   └── validators.py           # Pydantic v2 validation models
├── modules/
│   ├── networth_engine.py      # Assets - Liabilities, multi-asset, negative balance handling
│   ├── portfolio_engine.py     # XIRR, CAGR, invested vs market value, P&L
│   ├── expense_engine.py       # Debits, refund deductions, date boundaries
│   ├── income_engine.py        # Cash flow, savings rate calculation
│   ├── budget_engine.py        # Category limits, rollover, overspending alerts
│   ├── reconciliation_engine.py# Double-entry balance vs ledger variance checks
│   └── tax_engine.py           # Union Budget 2024 CGT, FIFO lot matching, Sec 115BBH VDA
├── audit/
│   └── calculation_logger.py   # Thread-safe calculation audit buffer & metrics
└── api/
    └── calculation_routes.py   # FastAPI endpoints mounted under /api/calculations/*
```

---

## 3. Mathematical Specifications

### 3.1 Net Worth Equation
$$\text{Total Assets} = \sum \text{Liquid Cash} + \sum \text{Bank Balances} + \sum \text{Investments} + \sum \text{Bullion} + \sum \text{Crypto}$$
$$\text{Total Liabilities} = \sum \text{Loans} + \sum \text{Credit Card Outstanding} + \sum \text{Payables}$$
$$\text{Net Worth} = \text{Total Assets} - \text{Total Liabilities}$$

#### Boundary Rules:
- Overdraft accounts and negative bank balances are treated as active liabilities, preventing artificial inflation of net worth.
- Crypto balances maintain 8 decimal places (`quantize_crypto`) and are converted using validated USD/INR FX rates.
- Unpriced assets: If live market price is missing, the asset is valuated at purchase price, flagged as `is_price_fallback: true`, and added to `unpriced_holdings_count`.

### 3.2 Portfolio Return Engine (CAGR & XIRR)

#### Compounded Annual Growth Rate (CAGR):
$$\text{CAGR} = \left( \frac{V_{\text{final}}}{V_{\text{initial}}} \right)^{\frac{1}{T}} - 1$$
Where $T$ is holding period in years. Handled for $T < 1$ year and negative returns with zero-division protection.

#### Extended Internal Rate of Return (XIRR):
Solves for discount rate $r$ in the cash flow polynomial:
$$\sum_{i=1}^{N} \frac{C_i}{(1 + r)^{\frac{d_i - d_1}{365}}} = 0$$
- Implements numerical Newton-Raphson iteration with bisection fallback when derivative approaches zero.
- Bounded to $[-0.9999, 10.0]$ with convergence tolerance $\epsilon = 10^{-7}$.

### 3.3 Expense & Budget Engine (Refund Handling)
- **Refunds & Chargebacks**: Transactions marked as refunds, returns, or with negative amounts are deducted from category and monthly totals rather than added as expenses:
  $$\text{Net Category Expense} = \sum \text{Debits} - \sum \text{Refunds}$$
- **Budget Utilization**:
  $$\text{Utilization \%} = \frac{\text{Net Category Expense}}{\text{Budget Limit}} \times 100$$
- **Rollover**: Positive unspent balances roll forward to subsequent months when `rollover_enabled: true`.

---

## 4. Statutory Indian Tax Engine (Union Budget 2024)

### 4.1 Asset Classification & Holding Thresholds

| Asset Class | Long-Term Threshold | STCG Rate | LTCG Rate | Exemption / Treatment |
| :--- | :--- | :--- | :--- | :--- |
| **Listed Equity / Equity MF** | 365 Days (12 Months) | **20.0%** (Sec 111A) | **12.5%** (Sec 112A) | ₹1,25,000 exemption limit per FY |
| **Debt Mutual Funds** | N/A (Sec 50AA post 01-Apr-2023) | Slab Rate | Slab Rate | Deemed short-term capital gains |
| **Bonds (Listed)** | 365 Days (12 Months) | Slab Rate | **12.5%** | Without indexation benefit |
| **Physical Bullion (Gold/Silver)** | 730 Days (24 Months) | Slab Rate | **12.5%** | Revised under Budget 2024 |
| **Virtual Digital Assets (Crypto)** | N/A (Section 115BBH) | **31.2%** | **31.2%** | Flat 30% + 4% cess; **Zero loss set-off** |
| **F&O Derivatives** | N/A (Section 43(5)) | Slab Rate | Slab Rate | Non-speculative business income |

### 4.2 First-In, First-Out (FIFO) Lot Matching
- When a user sells holdings, `match_lots_fifo` matches the sell quantity against the earliest open purchase lot chronologically.
- For each matched lot:
  $$\text{Holding Period (Days)} = \text{Date}_{\text{sell}} - \text{Date}_{\text{buy}}$$
  $$\text{Cost Basis} = \text{Matched Qty} \times \text{Buy Price}$$
  $$\text{Capital Gain/Loss} = (\text{Matched Qty} \times \text{Sell Price}) - \text{Cost Basis}$$

### 4.3 Loss Set-Off Rules (Sections 70 & 71)
1. Short-Term Capital Loss (STCL) can be set off against both STCG and LTCG.
2. Long-Term Capital Loss (LTCL) can **only** be set off against LTCG.
3. Virtual Digital Asset (Crypto) losses under Section 115BBH **cannot** offset any capital gains from any asset class (including other crypto gains).

### 4.4 Tax-Loss Harvesting Engine
- Scans unrealized portfolio positions where $\text{Current Value} < \text{Invested Amount}$.
- Calculates exact tax savings available if harvested before March 31st based on whether the position is STCL or LTCL.
- Generates prioritised harvesting recommendations sorted by tax savings descending.
- Excludes crypto losses from harvestable savings and includes mandatory statutory disclaimer:
  > *"Estimated Indian capital gains tax analysis based on Union Budget 2024 provisions. Calculations are simulated for personal portfolio planning and tax-loss harvesting only. Please consult a certified Chartered Accountant or tax advisor before filing ITR."*
