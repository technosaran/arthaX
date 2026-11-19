# Binance Trade History, Sell Tracking & Realized Analytics Plan

## Overview
Enable tracking of Binance trades, sales, and closed positions in arthaX. When users sell assets on Binance, arthaX automatically synchronizes executed trades, records realized proceeds in USD, tracks transaction history (Buys vs. Sells), and displays exited positions so users never lose visibility of what they sold, at what price, and when.

## File Structure
- `supabase_schema.sql` (append `public.crypto_trades` DDL, indices, and RLS policies)
- `src/utils/binance.ts` (interfaces for trades, trade stats calculation, exited assets detector)
- `tests/binanceTrades.test.ts` (unit tests for trade parsing, stats math, and exited asset extraction)
- `src/app/api/v1/crypto/binance/sync/route.ts` (sync executed trades from Binance `/api/v3/myTrades` into `public.crypto_trades`)
- `src/app/api/v1/crypto/trades/route.ts` (endpoint returning trades, analytics, and exited positions)
- `tests/cryptoTradesApi.test.ts` (integration tests for trade synchronization and GET endpoint)
- `src/components/CryptoSection.tsx` (Holdings / Trade History / Sold Analytics tabbed view, filters, trade metrics)
- `tests/cryptoTradesSection.test.ts` (UI integration tests verifying trade history rendering and navigation)

---

## Tasks

### Task 1: Database Migration for `crypto_trades`
- **Files**: `supabase_schema.sql`, `tests/cryptoSchema.test.ts`
- **Actions**:
  1. Add DDL for `public.crypto_trades` with `uq_crypto_user_trade UNIQUE (user_id, trade_id)` and RLS policies.
  2. Execute migration on Supabase project `fvpfzbuoizzjwgekuhot` via `supabase_mcp.execute_sql`.
  3. Verify schema in `tests/cryptoSchema.test.ts`.

### Task 2: Trade Analytics & Math Utility in `src/utils/binance.ts`
- **Files**: `src/utils/binance.ts`, `tests/binanceTrades.test.ts`
- **Actions**:
  1. Define `BinanceRawTrade` and `CalculatedCryptoTrade` interfaces.
  2. Implement `calculateTradeStats(trades)` (total realized sells, total purchases, net flow, fees).
  3. Implement `getExitedAssets(trades, currentActiveAssets)` (identifies assets completely sold out).
  4. Write failing tests, implement, run tests.

### Task 3: Backend Trade Sync & Query Endpoints
- **Files**: `src/app/api/v1/crypto/binance/sync/route.ts`, `src/app/api/v1/crypto/trades/route.ts`, `tests/cryptoTradesApi.test.ts`
- **Actions**:
  1. Extend `POST /api/v1/crypto/binance/sync` to query `/api/v3/myTrades` for active and traded assets and upsert into `public.crypto_trades`.
  2. Create `GET /api/v1/crypto/trades` returning trades, stats, and exited assets.
  3. Write tests in `tests/cryptoTradesApi.test.ts`.

### Task 4: UI Implementation in `src/components/CryptoSection.tsx`
- **Files**: `src/components/CryptoSection.tsx`, `tests/cryptoTradesSection.test.ts`
- **Actions**:
  1. Add tab navigation: `[ Holdings | Trade History | Sell Analytics ]`.
  2. In Trade History view: Render trade metric cards (Total Realized Sells, Total Buys, Net Flow, Fees), filters (All, Buys, Sells), and trade log table.
  3. In Sell Analytics view: Render "Exited / Fully Sold Assets" summary showing what was sold, exit prices, and total USD realized.
  4. Write tests in `tests/cryptoTradesSection.test.ts`.

### Task 5: Verification & Push
- **Actions**:
  1. Run full Vitest suite (`npx vitest run`).
  2. Run TypeScript check (`npm run typecheck`).
  3. Git stage, commit, and push to origin (`git push`).
