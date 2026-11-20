# ARTHAX — COMPLETE REPOSITORY AUTOMATION AUDIT

**Audit Date**: November 20, 2026  
**Auditor**: Senior Software Architect, Financial Systems Engineer, Data Engineer, QA & Security Engineer  
**Branch**: `experiment/complete-automation`  
**Target Repository**: ArthaX Personal Finance Intelligence  

---

## 1. EXECUTIVE SUMMARY

ArthaX has established a solid architectural foundation featuring:
1. **Next.js 16 (App Router) + React 19** frontend with multi-tier caching (Redis + LocalStorage).
2. **Supabase PostgreSQL** database with comprehensive multi-tenant Row Level Security (RLS) on all tables.
3. **ArthaX Financial Calculation Engine (AFCE)** in Python (`calculation_engine/`) using Python `Decimal` arithmetic for zero binary floating-point rounding errors.
4. Working external market data integrations: **AMFI MFAPI** for Indian Mutual Funds, **Yahoo Finance / Market Feed** for NSE/BSE stock quotes, **Binance API** for crypto, and **Zerodha Kite Connect** with automated TOTP headless sync.

However, **financial automation is currently fragmented**:
- **Bank Statement Ingestion**: Completely absent. There is no automated bank statement extraction, no Gmail OAuth attachment pipeline, and no parser for Indian bank statements (SBI, Indian Bank, HDFC, ICICI).
- **Transaction Storage Model**: The database splits transactions into distinct `expenses` and `income` tables, while `transfers` are tracked separately. A universal canonical ledger schema with original vs. normalized narration, entity recognition, and reconciliation metadata is missing.
- **Transaction Intelligence**: Categorization currently relies on simplistic keyword matching without UPI VPA extraction, merchant entity resolution, counterparty ownership heuristics, or calibrated confidence scoring.
- **Client vs. Engine Discrepancies**: Frontend components (Dashboard, Accounts, Ledger, Net Worth) frequently calculate metrics client-side using JavaScript `Number` (binary float IEEE 754), bypassing the Python AFCE decimal calculation engine.
- **Missing Automation Status UI**: There is no visibility for users into ingestion pipelines, reconciliation status, OCR/PDF extraction health, or classification accuracy.

---

## 2. REPOSITORY & ARCHITECTURE AUDIT

### 2.1 Frontend Architecture
- **Framework**: Next.js 16.4.6, React 19.3.0, TypeScript 5.
- **State & Data Fetching**: TanStack React Query (`@tanstack/react-query` v5) coupled with a two-tier caching client (`src/utils/cacheClient.ts` + `@upstash/redis`).
- **UI Components**: Dark-mode primary UI with Tailwind CSS v4, Lucide React icons, and custom SVG/Canvas charts (`InteractiveDonutChart`, `InteractiveLineChart`).
- **Audit Finding**: Instant tab switching (0ms) is implemented using persistent mounted tabs (`visitedTabs`). However, each tab independently queries Supabase and performs its own ad-hoc calculations instead of subscribing to a unified financial state stream.

### 2.2 Backend Architecture & APIs
- **Next.js API Routes** (`src/app/api/v1/*`):
  - `analytics/`: Overview telemetry and Indian capital gains tax analysis.
  - `transactions/`: Unified read/write bridge over `expenses` and `income`.
  - `transfers/`: Double-entry account balance updates with database transaction rollback.
  - `stocks/`: Portfolio holdings and live quote resolution via NSE/BSE ticker feed.
  - `mutual-funds/`: AMFI NAV fetching and CSV holdings import.
  - `fno/`: Futures & Options positions, trades, and margins.
  - `integrations/zerodha/`: Auto-login with TOTP, token generation, and scheduled portfolio sync.
  - `integrations/telegram/` & `webhooks/whatsapp/`: Conversational transaction logging.
  - `calculations/[...path]/`: Secure bridge to the Python calculation engine microservice.
- **Python Analytics & Calculation Service** (`api/index.py` & `calculation_engine/`):
  - FastAPI service providing runway forecasting, anomaly detection, Indian Union Budget 2024 CGT harvesting, and the AFCE decimal calculation engine.
  - Hardened with JWT verification against `SUPABASE_JWT_SECRET` and internal service keys.

### 2.3 Database Schema & RLS Policies
- **Database Engine**: PostgreSQL on Supabase.
- **Tables (26 total)**: `user_settings`, `accounts`, `income`, `expenses`, `budgets`, `family_members`, `family_goals`, `family_responsibilities`, `family_emergency_vault`, `transfers`, `recurring_rules`, `financial_audit_logs`, `stock_holdings`, `stock_transactions`, `fno_positions`, `fno_trades`, `mutual_fund_holdings`, `mutual_fund_transactions`, `zerodha_integrations`, `bond_holdings`, `bond_transactions`, `bullion_holdings`, `bullion_transactions`, `binance_integrations`, `crypto_holdings`, `crypto_trades`.
- **Security**: Strict RLS policies (`auth.uid()::text = user_id`) enabled across all tables. Automated new-user provisioning trigger creates `user_settings` and a default `Cash in Hand` liquid asset account.

---

## 3. SECTION-BY-SECTION AUTOMATION AUDIT

The table below provides a forensic audit of all 13 core sections of ArthaX against the 10 evaluation criteria.

| Section | 1. What Works | 2. Partially Implemented | 3. What is Manual | 4. What is Automated | 5. What is Broken | 6. What is Missing | 7. APIs & Tables Used | 8. Calc Logic Reliability | 9. Automation Feasibility | 10. External Integrations Required |
|---|---|---|---|---|---|---|---|---|---|---|
| **Dashboard** | Balance card display, asset allocation donut chart, recent activity list, currency toggle (INR/USD). | Aggregation of net worth across asset classes. | Manual account adjustments, manual refresh. | Automatic calculation of net worth from synced holdings and accounts. | Floating-point rounding in multi-currency conversion (USD/INR fixed rate of 84.50 hardcoded). | Unified balance sync engine; live USD/INR exchange rate feed. | `accounts`, `expenses`, `income`, `transfers`, `stock_holdings`, `mutual_fund_holdings`, `bond_holdings`, `bullion_holdings`, `crypto_holdings`. | Medium: client-side floating-point additions can diverge from backend decimal precision. | High: Can derive all summaries directly from central calculation engine. | Live currency rate API (RBI / OpenExchangeRates / Yahoo). |
| **Accounts** | Account creation, balance display, cash editing, balance adjustments (deposit/withdraw/adjust). | Transfer history and activity filtering. | Entering bank balances, uploading statements, matching balances. | Account creation triggers, transfer balance updates via atomic RPC. | No bank statement auto-import; missing statement continuity check. | Automated statement ingestion, opening/closing balance reconciliation, missing period detection. | `accounts`, `transfers`, `/api/v1/transfers`. | High for transfers; Low for balance integrity across external banks. | High: Auto-sync via statement ingestion and balance reconciliation. | Gmail API (statement retrieval) and Bank parsers (SBI, Indian Bank). |
| **Ledger** | Unified display of expenses and income, search, category filter, month pagination. | Running balance calculation. | Creating individual debit/credit entries, tagging, classification corrections. | Synthesized credit/debit stream. | Does not link debit and credit legs of transfers properly; pagination over two disjoint tables causes sorting quirks. | Canonical transaction model, duplicate detection, original bank narration preservation, counterparty extraction. | `expenses`, `income`, `accounts`, `/api/v1/transactions`. | Medium: Running balance computed on-the-fly client-side without immutable snapshot anchors. | High: Unified canonical transaction ingestion pipeline with duplicate hashing. | Bank statement feeds. |
| **Income** | Income listing, category tagging, monthly total, monthly trends line chart. | Recurring income tracking (rules table exists but execution is passive). | Entering salary slips, interest credits, dividend credits. | Calculation of monthly income total. | Falsely classifies refunds and account transfers as income if received into bank accounts. | Auto-detection of salary patterns, dividend matching from stock holdings, interest auto-logging. | `income`, `accounts`, `recurring_rules`. | Low: Conflates non-income inflows (refunds, transfers) with genuine revenue. | High: Pattern-based salary & recurring income detection engine. | Bank statement parser, corporate action feeds (dividends). |
| **Budgets** | Budget creation, progress bar, category limits, alert threshold indicators, rollover prompt. | Budget rollover logic (`prepareBudgetRollover`). | Setting category limits, defining monthly budgets. | Calculating actual expenditure per category and percentage utilization. | Overlapping or unstandardized category names create untracked spending leaks. | Automated predictive budget suggestions based on 3-month trailing expense median. | `budgets`, `expenses`, `/api/v1/transactions`. | High: Budget calculations in `budgetUtils.ts` and `budget_engine.py` are robust. | High: Auto-adjusting budgets and recurring expense allocation. | None (internal). |
| **Categories** | Categorized expense/income display with metadata and icons. | Fast-text / regex transaction categorization in Python service (`/api/py/categorize`). | Assigning categories when adding transactions, correcting misclassified items. | Rule-based keyword matching (e.g. "swiggy" -> "Food & Dining"). | Narrow dictionary; does not handle complex UPI strings (e.g. `UPI/P2M/4321/SWIGGY/PAY`). | Entity resolution database, UPI merchant registry, user correction memory loop. | `expenses`, `income`, `api/index.py`. | Medium: Rule matching is rigid and easily spoofed by counterparty names. | High: Hybrid entity recognizer + regex + user preference store. | Merchant registry database. |
| **Net Worth** | Asset and liability aggregation, historical trend charting, breakdown cards. | Historical snapshot tracking (calculated on the fly from timestamps). | Updating property, physical assets, or unlinked bank balances. | Auto-calculation from holdings (stocks, MFs, crypto, bullion, accounts). | Stale asset valuations are treated as live valuations without warning. | Scheduled daily net worth snapshots stored in database; stale asset indicator flags. | `accounts`, `stock_holdings`, `mutual_fund_holdings`, `bond_holdings`, `bullion_holdings`, `crypto_holdings`. | High: Backend `networth_engine.py` uses Decimal arithmetic. | High: Scheduled nightly net worth snapshot generator. | Live asset pricing feeds. |
| **Stocks** | Zerodha Kite automated portfolio sync, manual holding addition, live quote fetching via Yahoo API. | P&L calculation, dividend tracking. | Manual entry if user does not use Zerodha. | Automated TOTP headless login and portfolio sync for Zerodha users; live quote refresh. | Token expiration requires periodic re-auth; Yahoo finance quotes can throttle. | Multi-broker support (Groww, Upstox, AngelOne), CAS/CDSL statement parser, automated corporate actions. | `stock_holdings`, `stock_transactions`, `zerodha_integrations`, `/api/v1/stocks/*`. | High: Formula `(current_price - avg_buy_price) * quantity` is verified. | High: CDSL e-DIS / CAS statement parser and Kite sync. | Broker APIs (Kite, Upstox) or CDSL/NSDL CAS PDF statement parser. |
| **Mutual Funds** | Holdings display, AMFI NAV auto-sync via `api.mfapi.in`, CSV portfolio import. | XIRR / CAGR calculations. | Manual holding entry or manual CSV upload. | Daily NAV synchronization against AMFI database via scheme codes. | Missing automated CAMS / KFintech CAS statement parsing; XIRR approximation fails on irregular cash flows. | Automated CAMS/KFintech eCAS email ingestion from Gmail; automated SIP deduction tracking. | `mutual_fund_holdings`, `mutual_fund_transactions`, `/api/v1/mutual-funds/*`. | High: Nav quotes verified against AMFI; XIRR needs Newton-Raphson precision. | High: Automated eCAS PDF statement parser with password decryption. | CAMS/KFintech CAS statement via Gmail. |
| **F&O** | Open positions, trade history, lot size calculation, mark-to-market P&L. | Margin utilization calculation. | Manual entry of option strikes and trades. | Automated position sync for Zerodha Kite users. | Missing auto-expiry settlement; Greeks (Delta, Theta) are not computed. | Automated expiry reconciliation, option chain live Greeks, contract rollover tracking. | `fno_positions`, `fno_trades`, `/api/v1/fno/*`. | High for realized/unrealized P&L; Low for automated expiry closeout. | Medium: Blocked for non-Kite brokers unless broker API keys provided. | Broker F&O websocket feeds. |
| **Goals** | Goal targets, progress visualization, milestone estimation. | Contribution allocation. | Updating `current_amount` manually, setting target dates. | Percentage progress calculation. | Goals do not automatically sync with dedicated savings accounts or asset portfolios. | Linked account automated balance tracking; SIP contribution auto-tagging. | `family_goals`. | High: Mathematical linear progress formula is sound. | High: Automatic goal value derivation from designated tagged accounts or MF folios. | None (internal). |
| **Family** | Family member roster, shared goals, emergency vault, consolidated vs individual view. | Consolidated net worth and shared budget tracking. | Adding members, recording shared expenses. | Filtering out internal family transfers (`isFamilyTransfer`) to avoid double counting. | Permissions model is currently cosmetic; all authenticated family data is shared in workspace. | Granular read/write permissions per member; member-specific statement ingestion. | `family_members`, `family_goals`, `family_responsibilities`, `family_emergency_vault`. | High: Transfer exclusion prevents inflated family expenditure. | High: Automated consolidated ledger with multi-account mapping. | None (internal). |
| **Settings** | Profile editing, theme toggle, PDF/CSV statement exports, Zerodha & Telegram integration management, master data wipe. | Automated sync schedules. | Downloading statements manually, re-authenticating expired tokens. | Zerodha cron sync trigger, Telegram webhook response. | Statement tab only handles *export*; there is no UI for statement *import* or Gmail connection. | Gmail OAuth connection interface, bank parser management, statement ingestion audit logs, automation health status. | `user_settings`, `zerodha_integrations`, `/api/v1/integrations/*`. | High for export routines; Low for integration error diagnostics. | High: Full automation status dashboard and ingestion configuration center. | Google OAuth 2.0 (Gmail API). |

---

## 4. CRITICAL AUTOMATION GAPS IDENTIFIED

1. **Absence of Bank Statement Parsing Infrastructure**:
   - ArthaX currently has zero statement ingestion capability.
   - Users must manually enter every debit and credit, which is error-prone, tedious, and leads to application abandonment.
   - Bank-specific formats (SBI, Indian Bank, HDFC) with complex multi-column layouts, wrapped narrations, and password protection cannot be imported.

2. **No Automated Ingestion Pipeline (Gmail API)**:
   - Statements sent to user emails (monthly e-statements from SBI, Indian Bank, CAMS) are ignored.
   - No Gmail OAuth token management, incremental search checkpointing, or automatic PDF attachment extraction.

3. **Inadequate Transaction Model (Expenses vs Income Splitting)**:
   - Splitting financial flows into two separate database tables (`expenses` and `income`) makes true double-entry bookkeeping, transfer detection, and reconciliation mathematically difficult and architecturally fragmented.
   - Original bank narration is discarded; only user-edited `title` is preserved.

4. **No Internal Transfer Reconciliation**:
   - When a user moves ₹25,000 from SBI to HDFC, it often appears as a ₹25,000 expense and a ₹25,000 income, falsely inflating both total monthly spending and income by ₹25,000.
   - The transfer matching algorithm needs to detect matching credit/debit pairs across accounts within a 72-hour settlement window and classify them as `OWN_ACCOUNT_TRANSFER`.

5. **Refunds and Reversals Misclassified as Income**:
   - An e-commerce refund (e.g. Amazon refund ₹2,499) or failed UPI reversal is currently logged as `income`, distorting salary and genuine earnings calculations.

---

## 5. TECHNICAL ROADMAP & ACTION PLAN

To transform ArthaX into an autonomous financial intelligence engine, the following stages will be implemented on `experiment/complete-automation`:

1. **Stage B — Universal Financial Data Architecture**:
   - Define canonical transaction schema in database (`bank_statements`, `statement_transactions`, `classification_rules`, `automation_jobs`).
   - Implement deduplication hashes (`sha256(account_id + date + amount + original_narration)`).

2. **Stage C — Bank Statement Ingestion Framework**:
   - Build modular bank adapters for **State Bank of India (SBI)** and **Indian Bank** supporting PDF, password-protected PDF, and CSV formats.
   - Implement secure in-memory/temporary password decryption architecture with zero plaintext credential leakage.
   - Implement mathematical validation equation: `Opening Balance + Total Credits - Total Debits = Closing Balance`.
   - Build Gmail OAuth statement discovery service with incremental checkpointing.

3. **Stage D — Transaction Intelligence Engine**:
   - Implement hybrid classification pipeline:
     1. Deterministic regex & bank transaction codes (NEFT, RTGS, IMPS, UPI, POS, ATM).
     2. Indian UPI VPA entity resolution (parsing merchant VPAs e.g. `swiggy@icici`, `uber@hdfc`).
     3. Entity recognition database for 200+ popular Indian merchants and platforms.
     4. Internal transfer matching engine across user accounts with settlement window tolerance.
     5. Calibrated confidence scoring (High >= 0.85 auto-approved, Medium 0.60-0.84 provisional, Low < 0.60 flagged for review).

4. **Stage E — Centralized Calculation Engine Alignment**:
   - Integrate the Python AFCE decimal calculation engine across all application flows.
   - Verify financial formulas with zero binary float drift.

5. **Stage F & G — Section Automation & Automation Status UI**:
   - Connect all 13 sections to the automated pipelines.
   - Build an **Automation & Statement Management Dashboard** in Settings and Accounts showing sync health, connected accounts, parser statistics, and failure recovery.

6. **Stage H — Validation & Test Suite**:
   - Comprehensive unit and integration test suite covering real redacted SBI/Indian Bank statements, transfer matching, balance continuity, and reconciliation.
