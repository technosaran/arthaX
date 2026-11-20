# ARTHAX — CENTRAL FINANCIAL CALCULATION ENGINE SPECIFICATION

**Document Version**: 2.0.0  
**Status**: Implemented Specification  
**Module**: `calculation_engine` & `src/utils/`  

---

## 1. OBJECTIVE & DECIMAL PRECISION POLICY

Binary floating-point arithmetic (IEEE 754 float/double) is strictly prohibited for monetary calculations across all ArthaX services.

### Core Precision Rules
1. **Python AFCE Core**: All arithmetic uses Python `Decimal` (`from decimal import Decimal, ROUND_HALF_UP`).
2. **TypeScript / Client Layer**: Monetary amounts use exact string-based integer cents (paise) or bounded decimal rounding routines (`Number((amount).toFixed(2))`).
3. **Precision Standards**:
   - Standard Fiat Currency (INR, USD, EUR): `0.01` (2 decimal places).
   - Asset Units (Stocks, Mutual Fund units): `0.0001` (4 decimal places).
   - Asset Rates / NAVs: `0.0001` (4 decimal places).
   - Cryptocurrency Holdings: `0.00000001` (8 decimal places).

---

## 2. CORE FINANCIAL FORMULAS

### 2.1 Genuine Income Calculation
$$\text{Net Income} = \sum_{T \in \text{Credits}} T.\text{amount} \quad \text{where } T.\text{type} \notin \{\text{OWN\_ACCOUNT\_TRANSFER}, \text{REFUND}, \text{REVERSAL}\}$$
- Internal transfers from another user account are excluded.
- Refunds and chargebacks are excluded from Income (they offset the relevant Expense).

### 2.2 Genuine Expense Calculation
$$\text{Net Expense} = \sum_{T \in \text{Debits}} T.\text{amount} - \sum_{R \in \text{Refunds}} R.\text{amount} \quad \text{where } T.\text{type} \ne \text{OWN\_ACCOUNT\_TRANSFER}$$
- Internal transfers are excluded.
- Merchant refunds reduce corresponding category expenditure.

### 2.3 Net Cash Flow
$$\text{Net Cash Flow} = \text{Net Income} - \text{Net Expense}$$

### 2.4 Account Balance Continuity
$$\text{Closing Balance}_t \equiv \text{Opening Balance}_t + \sum_{t} \text{Credits} - \sum_{t} \text{Debits}$$
$$\text{Opening Balance}_t \equiv \text{Closing Balance}_{t-1}$$

### 2.5 Net Worth
$$\text{Net Worth} = \sum \text{Liquid Cash} + \sum \text{Bank Balances} + \sum \text{Stock Portfolio Value} + \sum \text{Mutual Funds Value} + \sum \text{Bonds} + \sum \text{Bullion} + \sum \text{Crypto (INR)} - \sum \text{Liabilities}$$
Where:
- Liabilities include Credit Card balances, Personal Loans, and Home Loans.
- Stale valuations (> 7 days without update) are flagged with an informational warning.

### 2.6 Portfolio Returns & Performance
- **Unrealized P&L**:
  $$\text{Unrealized P\&L} = (\text{Current Market Price} - \text{Average Buy Price}) \times \text{Quantity}$$
- **Realized P&L**:
  $$\text{Realized P\&L} = (\text{Sell Price} - \text{Buy Price}) \times \text{Quantity Traded} - \text{Brokerage/STT/Taxes}$$
- **Compound Annual Growth Rate (CAGR)**:
  $$\text{CAGR} = \left(\frac{\text{Current Value}}{\text{Invested Value}}\right)^{\frac{1}{n}} - 1$$
  Where $n = \frac{\text{Days Held}}{365.25}$.
- **Extended Internal Rate of Return (XIRR)**:
  Solved via Newton-Raphson method for cash flows $C_i$ at dates $d_i$:
  $$\sum_{i=1}^{N} \frac{C_i}{(1 + r)^{\frac{d_i - d_1}{365}}} = 0$$

---

## 3. BUDGET UTILIZATION & OVERRUN DETECTION

For a budget allocated to category $C$ with limit $L_C$ for month $M$:
- **Actual Spending**:
  $$\text{Spent}_C = \sum_{e \in \text{Expenses}(C, M)} e.\text{amount} - \sum_{r \in \text{Refunds}(C, M)} r.\text{amount}$$
- **Remaining Budget**:
  $$\text{Remaining}_C = L_C - \text{Spent}_C$$
- **Utilization Percentage**:
  $$U_C = \frac{\text{Spent}_C}{L_C} \times 100$$
- **Pacing Alert**: If $\frac{\text{Spent}_C}{L_C} > \frac{\text{Days Passed in Month}}{\text{Total Days in Month}}$, an early warning alert is triggered.
