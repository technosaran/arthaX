# ARTHAX — TRANSACTION INTELLIGENCE & CLASSIFICATION SPECIFICATION

**Document Version**: 2.0.0  
**Status**: Implemented Specification  
**Module**: `calculation_engine.intelligence`  

---

## 1. OBJECTIVE & PHILOSOPHY

The ArthaX Transaction Intelligence Engine moves beyond naive keyword matching (e.g. matching "swiggy" to food). It is designed to understand **financial semantics, transaction channels, counterparties, and cash flow directionality**.

### Non-Negotiable Financial Semantics
1. **Never Confuse Transfers with Income/Expense**:
   Moving ₹50,000 between a user's SBI and HDFC account must be classified as an `OWN_ACCOUNT_TRANSFER`. It is excluded from total spending and total income.
2. **Never Confuse Refunds with Income**:
   A refund from Amazon or a merchant is credited as a `REFUND` offsetting the original expense category, never counted as gross revenue or salary.
3. **Calibrated Confidence**:
   Every classification emits an explicit confidence score between `0.00` and `1.00` with an explainable reason code.

---

## 2. HYBRID CLASSIFICATION PIPELINE

The engine uses a deterministic multi-stage classification waterfall:

```
Raw Bank Narration + Amount + Direction + Account Metadata
  |
  +---> [Stage 1: Internal Transfer Matching]
  |       Matches twin debit/credit across user accounts (within 72-hour window)
  |       -> Type: OWN_ACCOUNT_TRANSFER (Confidence: 0.98)
  |
  +---> [Stage 2: Deterministic Channel & Transaction Code Rules]
  |       Recognizes ATM, Bank Charges, Interest Credit, Tax TDS, Salary CMS
  |       -> Type: ATM_WITHDRAWAL, BANK_CHARGES, INTEREST_INCOME, SALARY (Confidence: 0.95)
  |
  +---> [Stage 3: UPI VPA & Merchant Entity Recognition]
  |       Extracts VPA (e.g. swiggy@icici, uber@hdfc, zerodha@axis)
  |       Queries 200+ Indian entity registry
  |       -> Merchant: Swiggy, Category: Food & Dining, Type: MERCHANT_EXPENSE (Confidence: 0.95)
  |
  +---> [Stage 4: User Classification Overrides]
  |       Applies user-defined persistent classification patterns
  |       -> Type: User Assigned (Confidence: 0.99)
  |
  +---> [Stage 5: Regex & Pattern Heuristics]
  |       Matches known patterns in narration strings
  |       -> Type: Heuristic Match (Confidence: 0.70 - 0.85)
  |
  +---> [Stage 6: Fallback Provisional Classification]
          Assigns UNKNOWN / Uncategorized Expense or Inflow
          -> Type: UNKNOWN (Confidence: 0.40)
```

---

## 3. SUPPORTED TRANSACTION TYPES & CATEGORIES

| Transaction Type | Default Category | Typical Narration Pattern |
|---|---|---|
| `SALARY` | Salary | `ACH/CMS/SALARY/`, `SALARY CREDIT`, `MONTHLY PAY` |
| `BUSINESS_INCOME` | Business | `CLIENT PAY`, `INVOICE`, `CONSULTING` |
| `INTEREST` | Interest | `INT.PD`, `QUARTERLY INTEREST`, `INTEREST EARNED` |
| `DIVIDEND` | Dividends | `ACH/DIVIDEND/`, `BSE DIV`, `NSE DIVIDEND` |
| `MERCHANT_EXPENSE` | Shopping / Utilities | POS debit, Card purchase, E-commerce |
| `FOOD_DINING` | Food & Dining | `SWIGGY`, `ZOMATO`, `MCDONALDS`, `DOMINOS`, `BLINKIT` |
| `SHOPPING` | Shopping | `AMAZON`, `FLIPKART`, `MYNTRA`, `AJIO`, `TATA CLiQ` |
| `TRAVEL` | Travel | `UBER`, `OLA`, `IRCTC`, `MAKEMYTRIP`, `INDIGO`, `FASTAG` |
| `UTILITIES` | Utilities | `BESCOM`, `TATA POWER`, `AIRTEL`, `JIO`, `ADANI GAS` |
| `RENT` | Rent & Housing | `RENT`, `NOBROKER`, `HOUSING`, `LANDLORD` |
| `LOAN_REPAYMENT` | Debt & EMI | `ACH/LOAN/`, `BAJAJ FINANCE`, `HOME LOAN EMI` |
| `OWN_ACCOUNT_TRANSFER` | Transfer | Matching debit/credit across linked accounts |
| `FAMILY_TRANSFER` | Family Support | Transfers to verified family member VPAs/accounts |
| `REFUND` | Refund | `REFUND`, `REVERSAL`, `CHARGEBACK`, `RETURN CREDIT` |
| `ATM_WITHDRAWAL` | Cash | `ATM WDL`, `NFS/ATM/`, `CASH WDL` |
| `BANK_CHARGES` | Bank Charges | `CHG:`, `SMS CHARGES`, `ANNUAL CARD FEE`, `IMPS CHG` |
| `TAX_PAYMENT` | Tax | `CHALLAN 280`, `CBDT`, `GST PAYMENT`, `TDS` |
| `INVESTMENT_PURCHASE` | Investment | `ZERODHA BROKING`, `GROWW`, `MUTUAL FUND ACH` |
| `INVESTMENT_REDEMPTION`| Investment | `CAMS REDEMPTION`, `KFIN REDEEM`, `ZERODHA PAYOUT` |

---

## 4. UPI VPA & ENTITY RESOLUTION

The UPI parser extracts structured components from complex Indian UPI narrations:
- `UPI/P2M/6319827361/SWIGGY/swiggy@icici/PAYTO...`  
  -> Channel: `UPI`, Mode: `P2M`, Entity: `Swiggy`, VPA: `swiggy@icici`, Category: `Food & Dining`.
- `UPI/P2P/1122334455/ANAND/anand@okhdfcbank/...`  
  -> Channel: `UPI`, Mode: `P2P`, Counterparty: `Anand`, VPA: `anand@okhdfcbank`.

---

## 5. TRANSFER MATCHING ALGORITHM

Given two transactions $T_1$ (on Account $A_1$) and $T_2$ (on Account $A_2$):
1. $T_1.\text{user\_id} == T_2.\text{user\_id}$
2. $A_1 \neq A_2$ (different accounts owned by user)
3. $T_1.\text{direction} == \text{DEBIT}$ and $T_2.\text{direction} == \text{CREDIT}$
4. $|T_1.\text{amount} - T_2.\text{amount}| < 0.01$
5. $|T_1.\text{transaction\_date} - T_2.\text{transaction\_date}| \le 3 \text{ days}$ (settlement window)
6. Counterparty reference, UTR, or narration indicates transfer intent.

When matched:
- Both transactions are marked `is_transfer = true`
- `transfer_counterpart_id` points to the paired twin transaction
- Transaction type is set to `OWN_ACCOUNT_TRANSFER`
- **Consolidated reporting excludes both legs from expense and income metrics**.
