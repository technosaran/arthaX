# Binance Crypto Full Auto-Sync & Multi-Currency Net Worth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully automated Cryptocurrency investment module powered by Binance Spot API (auto-syncing balances and live market prices in USD) and implement an independent `[ ₹ INR | $ USD ]` toggle on the Dashboard's Total Net Worth card without exchange rate conversions.

**Architecture:** 
- Secure backend integration: User enters Binance Read-Only API credentials; secrets are encrypted via AES-256-GCM. 
- Auto-sync worker/endpoints pull spot balances using Binance HMAC-SHA256 authenticated REST API (`/api/v3/account`) and compute USD valuations via real-time 24h tickers (`/api/v3/ticker/24hr`).
- Frontend Cryptocurrency tab with live stats, holdings table, allocation chart, and sync trigger.
- Dashboard Net Worth Card enhanced with a segmented currency view toggle separating INR domestic wealth and USD crypto wealth.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL + RLS), Vitest, Tailwind CSS, Lucide Icons, Node.js `crypto` (HMAC-SHA256 & AES-256-GCM).

**Spec:** Approved Design Document in conversation (Binance Full Auto-Sync & Multi-Currency Net Worth, November 2026).

---

## Global Constraints

- Never convert USD to INR or INR to USD: keep them as separate net worth pools.
- Binance API keys must require ONLY read permissions; secrets must be encrypted at rest with `encryptSensitiveData`.
- All financial balances and calculations must guard against floating point inaccuracies, NaN, and negative balances.
- Follow existing codebase patterns: `@/utils/apiResponse` for standard HTTP envelopes, `@/utils/rateLimit` for endpoint protection, Lucide React icons, and semantic CSS variables (`var(--app-*)`).

---

## Review Focus

1. **HMAC Signature Generation**: Timestamp synchronization with Binance server time; invalid query string or secret handling.
2. **Zero-Balance & Dust Filtering**: Handling dust assets (< $0.01) and zero-balance coins so the table remains clean.
3. **Stablecoin Pegs**: USDT, USDC, BUSD, and USD should be valued at exactly $1.00 even if ticker variance is ±0.01%.
4. **Currency Toggle Persistence & Display**: Ensure toggling between INR and USD changes metric labels, symbols (`₹` vs `$`), and breakdowns without cross-contamination.
5. **Decryption & Error Resiliency**: If user hasn't connected Binance or connection is expired, gracefully display empty state with "Connect Binance" prompt rather than throwing 500s.

---

## Task 1: Database Migration for Binance Integration & Crypto Holdings

**Files:**
- Modify: `supabase_schema.sql`
- Run Migration: via `supabase_mcp` `execute_sql` on project `fvpfzbuoizzjwgekuhot`
- Test: `tests/cryptoSchema.test.ts`

**Interfaces:**
- Produces: Tables `public.binance_integrations` and `public.crypto_holdings` with RLS policies and indexes.

- [ ] **Step 1: Write the schema test**
Create `tests/cryptoSchema.test.ts` verifying SQL definition for `binance_integrations` and `crypto_holdings`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/cryptoSchema.test.ts`
Expected: FAIL (file or definitions missing).

- [ ] **Step 3: Update `supabase_schema.sql` and execute migration on Supabase**
Add SQL table definitions for `binance_integrations` and `crypto_holdings` with RLS policies allowing authenticated users to manage their own records. Execute the migration via `supabase_mcp`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/cryptoSchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add supabase_schema.sql tests/cryptoSchema.test.ts
git commit -m "feat(db): add binance_integrations and crypto_holdings schema"
```

---

## Task 2: Binance Service Utilities & Calculation Engine

**Files:**
- Create: `src/utils/binance.ts`
- Test: `tests/binance.test.ts`

**Interfaces:**
- Consumes: Node.js `crypto` for HMAC-SHA256, `@/utils/crypto` for AES encryption.
- Produces:
  ```typescript
  export interface BinanceBalance { asset: string; free: string; locked: string; }
  export interface BinanceTicker { symbol: string; lastPrice: string; priceChangePercent: string; }
  export interface CalculatedCryptoAsset {
    asset: string;
    name: string;
    free: number;
    locked: number;
    totalQuantity: number;
    currentPriceUsd: number;
    totalValueUsd: number;
    change24h: number;
    allocationPercent: number;
  }
  export function generateBinanceSignature(queryString: string, apiSecret: string): string;
  export function parseBinanceBalances(balances: BinanceBalance[]): { asset: string; free: number; locked: number; total: number }[];
  export function calculateCryptoValuations(
    balances: { asset: string; free: number; locked: number; total: number }[],
    tickers: Record<string, BinanceTicker>
  ): { assets: CalculatedCryptoAsset[]; totalPortfolioUsd: number; netChange24hUsd: number; netChange24hPercent: number };
  ```

- [ ] **Step 1: Write the failing unit tests for Binance calculations**
Create `tests/binance.test.ts` with test cases for HMAC signing, USDT stablecoin pegging, price resolution, and portfolio aggregation.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/binance.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/utils/binance.ts`**
Implement HMAC-SHA256 signature generation, ticker mapping (supporting `<ASSET>USDT`, `<ASSET>USDC`, and fallback), and valuation calculations.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/binance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/utils/binance.ts tests/binance.test.ts
git commit -m "feat(crypto): implement binance utility and calculation engine"
```

---

## Task 3: Backend API Endpoints for Binance Auto-Sync

**Files:**
- Create: `src/app/api/v1/crypto/binance/connect/route.ts`
- Create: `src/app/api/v1/crypto/binance/sync/route.ts`
- Create: `src/app/api/v1/crypto/binance/disconnect/route.ts`
- Create: `src/app/api/v1/crypto/holdings/route.ts`
- Test: `tests/cryptoApi.test.ts`

**Interfaces:**
- Consumes: `@/utils/auth`, `@/utils/supabase/admin`, `@/utils/binance`, `@/utils/crypto`.
- Produces: REST endpoints for connecting, auto-syncing, fetching, and disconnecting Binance.

- [ ] **Step 1: Write API tests**
Create `tests/cryptoApi.test.ts` testing auth checks, input validation (API Key/Secret schema), and mock sync responses.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/cryptoApi.test.ts`
Expected: FAIL with endpoints or routes missing.

- [ ] **Step 3: Implement API routes**
  - `POST /api/v1/crypto/binance/connect`: Validates credentials with Binance `/api/v3/account`, encrypts secret, and stores in `binance_integrations`.
  - `POST /api/v1/crypto/binance/sync`: Fetches balances and 24h tickers, calculates USD valuations, updates `crypto_holdings` and `binance_integrations.last_synced_at`.
  - `GET /api/v1/crypto/holdings`: Returns synced holdings, total portfolio USD value, 24h change, and integration status.
  - `DELETE /api/v1/crypto/binance/disconnect`: Removes credentials and marks inactive.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/cryptoApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/v1/crypto/ tests/cryptoApi.test.ts
git commit -m "feat(api): add binance connect, sync, and crypto holdings endpoints"
```

---

## Task 4: Frontend Cryptocurrency Section & Navigation

**Files:**
- Create: `src/components/CryptoSection.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/HomeClient.tsx`
- Test: `tests/cryptoSection.test.ts`

**Interfaces:**
- Consumes: `/api/v1/crypto/holdings`, `/api/v1/crypto/binance/sync`, `/api/v1/crypto/binance/connect`.
- Produces: Comprehensive Crypto portfolio page with real-time stats, sync button, holdings list, allocation chart, and connect modal.

- [ ] **Step 1: Write test for Crypto navigation and section rendering**
Create `tests/cryptoSection.test.ts` verifying tab existence in Sidebar and expected coin data format.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/cryptoSection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `CryptoSection.tsx`, update `Sidebar.tsx` and `HomeClient.tsx`**
  - Register `crypto` in `Sidebar.tsx` with Bitcoin icon and "Binance" tag.
  - Dynamically import `CryptoSection` in `HomeClient.tsx`.
  - Build `CryptoSection.tsx` with:
    - Header: title, Binance connected status, "Sync Now" button, "Connect / Settings" button.
    - USD Stat cards: Total Crypto Value ($), 24h P&L ($ / %), Total Coins, Connection Status.
    - Searchable table: Symbol, Name, Quantity (Free/Locked), USD Price, Value in USD, 24h %, Allocation.
    - Allocation Donut chart.
    - Connect Binance Modal with step-by-step read-only instructions and test feedback.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/cryptoSection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/CryptoSection.tsx src/components/Sidebar.tsx src/app/HomeClient.tsx tests/cryptoSection.test.ts
git commit -m "feat(ui): add cryptocurrency section with binance auto-sync UI"
```

---

## Task 5: Dashboard Net Worth Card with Independent INR / USD Toggle

**Files:**
- Modify: `src/components/DashboardSection.tsx`
- Test: `tests/netWorthToggle.test.ts`

**Interfaces:**
- Consumes: `crypto_holdings` table / `/api/v1/crypto/holdings` for USD portfolio value.
- Produces: Segmented `[ ₹ INR | $ USD ]` toggle on the Total Net Worth card.

- [ ] **Step 1: Write test for Net Worth currency toggle**
Create `tests/netWorthToggle.test.ts` verifying that INR and USD calculations are strictly independent and use appropriate currency formatters.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/netWorthToggle.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement toggle in `DashboardSection.tsx`**
  - Add `currencyView: "INR" | "USD"` state.
  - Fetch crypto holdings total USD value alongside accounts.
  - Render modern segmented control `[ ₹ INR | $ USD ]` on the Net Worth card header.
  - In INR mode: Render INR Net Worth, INR Assets, INR Liabilities.
  - In USD mode: Render USD Net Worth ($ total from Binance crypto portfolio + any USD accounts), USD Assets ($), USD Liabilities ($0.00).
  - Fire custom event `arthax:financial_data_updated` on crypto sync to keep dashboard in real-time sync.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/netWorthToggle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/DashboardSection.tsx tests/netWorthToggle.test.ts
git commit -m "feat(dashboard): add independent INR and USD net worth toggle"
```

---

## Task 6: Full Verification, TypeScript Check & Build

**Files:**
- All modified/created files.

- [ ] **Step 1: Run complete test suite**
Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript typecheck**
Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Run production Next.js build**
Run: `npm run build`
Expected: Successful build with static/dynamic routes.

- [ ] **Step 4: Final commit and summary**
```bash
git commit -m "chore: verify cryptocurrency and multi-currency net worth build"
```
