# arthaX Calculations Reference

This document serves as a comprehensive reference for all the financial and mathematical calculations implemented in the arthaX personal-finance application. It allows you to verify the logic used across various modules including portfolio analytics, bond accruals, tax calculations, and broker charges.

---

## 1. High-Precision Money Math (`lib/money-math.ts`)

To prevent IEEE-754 floating-point rounding drift common in JavaScript (e.g., `0.1 + 0.2 = 0.30000000000000004`), the application uses safe mathematical wrappers for all currency operations.

- **Safe Rounding (`safeRound`)**:  
  Calculated as: `Math.round((value + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals)`
  By default, all currency is rounded to `2` decimal places.
- **Arithmetic Operations (`safeAdd`, `safeSub`, `safeMul`, `safeDiv`)**:  
  Each operation is wrapped in a `Number.isFinite` check (defaulting `NaN` or `Infinity` to `0`) and then pushed through `safeRound`.

---

## 2. Bond Calculations (`lib/bond-math.ts`)

Calculations for Fixed-Income Securities (Bonds, NCDs, SGBs).

### 2.1 Accrued Interest Calculation
Calculates the interest accrued from the last payout date to the current date.
- **Formula**:
  ```text
  Principal = Face Value × Quantity
  Annual Interest = Principal × (Coupon Rate / 100)
  Days Elapsed = Exact Days between Last Interest Date and Current Date
  Accrued Interest = Annual Interest × (Days Elapsed / 365)
  ```

### 2.2 Repayment Schedule Generation
Generates the future cash flows (interest payouts and final principal maturity).
- **Payout Increments**:
  - Monthly: Every 1 month (`Annual Interest / 12`)
  - Quarterly: Every 3 months (`Annual Interest / 4`)
  - Semi-Annual: Every 6 months (`Annual Interest / 2`)
  - Cumulative: Accrues and pays out entirely at maturity.
- **Final Cashflow**: Includes the remaining fractional interest for the final period + Total Principal.

---

## 3. Zerodha Brokerage & Charges (`lib/zerodha-charges.ts`)

Simulates Zerodha's exact charge structure for trades, allowing accurate net-profit and cost-basis analysis.

### 3.1 Equity Delivery (Stocks)
- **Brokerage**: ₹0
- **STT (Securities Transaction Tax)**: `Turnover × 0.1%` (Applicable on both Buy and Sell)
- **NSE Transaction Fee**: `Turnover × 0.00297%`
- **SEBI Charges**: `Turnover × 0.0001%` (₹10 per crore)
- **Stamp Duty**: `Turnover × 0.015%` (Applicable on **Buy only**)
- **DP Charges (Depository Participant)**: Flat `₹15.93` (Applicable on **Sell only**, per scrip/day)
- **GST**: `18%` applied on `(Brokerage + Transaction Fee)`

### 3.2 Equity Intraday
- **Brokerage**: `Min(0.03% of Turnover, ₹20)`
- **STT**: `Turnover × 0.025%` (Applicable on **Sell only**)
- **NSE Transaction Fee**: `Turnover × 0.00297%`
- **SEBI Charges**: `Turnover × 0.0001%`
- **Stamp Duty**: `Turnover × 0.003%` (Applicable on **Buy only**)
- **GST**: `18%` applied on `(Brokerage + Transaction Fee)`

### 3.3 Direct Mutual Funds (Coin)
- **Brokerage**: ₹0
- **Stamp Duty**: `Turnover × 0.005%` (Applicable on **Purchase only**)
- **STT**: `Turnover × 0.001%` (Applicable on **Redemption only**)

### 3.4 F&O Options
- **Brokerage**: Flat `₹20` per executed order.
- **STT**: `Turnover × 0.0625%` (Applicable on **Sell side premium only**)
- **NSE Transaction Fee**: `Turnover × 0.0355%` (On premium)
- **SEBI Charges**: `Turnover × 0.0001%`
- **Stamp Duty**: `Turnover × 0.003%` (Applicable on **Buy side premium only**)
- **GST**: `18%` applied on `(Brokerage + Transaction Fee)`

---

## 4. Portfolio Analytics (`lib/portfolio-analytics.ts`)

Aggregates overall net worth and calculates performance metrics.

- **Today's PnL**:  
  `Σ (Quantity × Day Change)` across all active stocks and mutual funds.
- **Cost Basis Calculation**:  
  `Σ (Quantity × Average Buy Price)`
- **Total Gain**:  
  `Max(0, Total Current Investment Value - Cost Basis)`
- **Total Gain Percentage**:  
  `(Total Gain / Cost Basis) × 100`
- **Asset Allocation Percentage**:  
  `(Specific Asset Class Value / Total Assets) × 100`

---

## 5. Dashboard Intelligence (`lib/dashboard-intelligence.ts`)

Calculates spending velocity and automated insights for the user's dashboard.

- **Net Worth Delta (Monthly)**:  
  `Monthly Income - Monthly Spend`
- **Net Worth Growth Percentage**:  
  `(Net Worth Delta / Total Net Worth) × 100`
- **Estimated Safe Budget**:  
  `Max(Monthly Income × 70%, ₹50,000)` (Baseline floor budget constraint)
- **Daily Velocity Budget (Remaining Spend Pace)**:  
  `(Estimated Safe Budget - Current Monthly Spend) / Days Left in Month`
- **Goals Tracking Progress**:  
  `(Number of Fully Funded Goals / Total Active Goals) × 100`

---

## 6. Indian Tax Engine (`lib/tax/india-tax-engine.ts`)

Evaluates total tax liability dynamically for both Old and New regimes.

- **Financial Year Parsing**: Determines FY dynamically. If the date is ≥ April 1st, `FY = Current Year`. Otherwise, `FY = Current Year - 1`.
- **Standard Deduction**: 
  - Flat `₹50,000` (Old Regime).
  - Flat `₹75,000` (New Regime FY 24-25 onwards).
- **Section 87A Rebate**:
  - New Regime (FY 24-25): Complete tax rebate if Taxable Income `≤ ₹7,00,000` (Max rebate `₹25,000`).
  - Old Regime: Complete tax rebate if Taxable Income `≤ ₹5,00,000` (Max rebate `₹12,500`).
- **Marginal Slab Tax Calculation**:  
  Loops through progressive tax brackets applying the corresponding slab percentage to the remainder of the taxable income.
- **Health & Education Cess**:  
  `Final Tax Liability = Computed Tax + (Computed Tax × 4%)`
