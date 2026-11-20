# ArthaX Database Architecture & Migration Management

## 1. Overview
The ArthaX persistence tier is hosted on PostgreSQL via **Supabase**. The schema is designed for strong transactional consistency, multi-tenant isolation through Row Level Security (RLS), atomic transfer integrity, and sub-millisecond query performance via indexed access paths.

---

## 2. Entity Relationship Model & Table Topology

The database comprises 26 primary application tables grouped by financial domain:

```
Core Financial:
  ├── accounts                (Bank, Cash, Credit Card, Demat, Wallet)
  ├── expenses                (Debits, categories, merchant, notes)
  ├── income                  (Credits, salary, freelance, interest)
  ├── transfers               (Double-entry inter-account movements)
  ├── budgets                 (Category spending limits & rollover status)
  └── monthly_budgets         (Archived monthly budget snapshots)

Investments & Markets:
  ├── stock_holdings          (Demat equity positions, avg price, current price)
  ├── stock_transactions      (Historical BUY/SELL equity trades)
  ├── mutual_fund_holdings    (Units, NAV, folio, AMC, asset class)
  ├── mutual_fund_transactions(SIPs, lump-sum investments, redemptions)
  ├── bullion_holdings        (Gold, silver holdings, purity, weight in grams)
  ├── bullion_transactions    (Bullion buy/sell receipts)
  ├── bond_holdings           (Government securities, corporate bonds, yield)
  ├── bond_transactions       (Bond orders and coupon distributions)
  ├── fno_positions           (Derivatives, futures, options contracts)
  └── fno_transactions        (F&O order fills and square-offs)

Crypto Assets:
  ├── crypto_holdings         (Token holdings, wallet/exchange addresses)
  └── crypto_trades           (Trade executions, fees, Binance syncs)

Integrations & Profiles:
  ├── profiles                (User identity, phone, currency preference)
  ├── user_settings           (Theme, notification preferences, Telegram ID)
  ├── telegram_bot_sessions   (Interactive conversation states)
  ├── zerodha_integrations    (Encrypted Kite API keys, access tokens, sync metadata)
  └── binance_integrations    (Encrypted Binance API key/secret, sync cursor)
```

---

## 3. Database Functions & Procedures

### 3.1 `fn_wipe_user_data(p_user_id text)`
- **Security Context**: `SECURITY DEFINER` with fixed `search_path = public, pg_temp`.
- **Authorization Guard**:
  ```sql
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid()::text <> p_user_id) THEN
    RAISE EXCEPTION 'Access Denied: Cannot delete another user workspace';
  END IF;
  ```
- **Execution**: Deletes all records across all 26 tables in dependency order within a single transaction. Returns a JSON map of counts per table.

### 3.2 Atomic Transfer Trigger (`fn_process_account_transfer`)
- Intercepts inserts on `transfers`:
  - Validates `from_account_id <> to_account_id`.
  - Atomically deducts `amount` from `from_account` balance.
  - Atomically credits `amount` to `to_account` balance.
  - Rolls back entire transaction if either account does not exist or belongs to a different tenant.

---

## 4. Indexing & Query Optimization Strategy

| Index Name | Table | Columns | Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `idx_expenses_user_date` | `expenses` | `(user_id, expense_date DESC)` | B-Tree | Chronological ledger and monthly filtering |
| `idx_income_user_date` | `income` | `(user_id, received_date DESC)` | B-Tree | Chronological ledger and monthly filtering |
| `idx_transfers_user_date` | `transfers` | `(user_id, transfer_date DESC)` | B-Tree | Transfer history and date boundaries |
| `idx_stock_tx_user_date` | `stock_transactions` | `(user_id, transaction_date ASC)` | B-Tree | FIFO lot matching for tax engine |
| `idx_crypto_trades_user_time` | `crypto_trades` | `(user_id, executed_at ASC)` | B-Tree | FIFO lot matching for crypto tax |
| `idx_accounts_user_type` | `accounts` | `(user_id, classification, type)` | B-Tree | Net worth asset & liability aggregation |

---

## 5. Migration History & Governance

All migrations are located in `supabase/migrations/` and adhere to chronological timestamps:
- `20261114000000_create_wealth_tables.sql`: Initial wealth tables schema.
- `20261114000002_create_stocks_tracker.sql`: Equities holdings and transaction tables.
- `20261116000000_database_security_hardening.sql`: RLS enablement and anonymous grant revocation.
- `20261118000000_fix_security_and_wipe.sql`: Security patches and function search paths.
- `20261120000000_patch_security_vulnerabilities.sql`: Additional table policy hardening.
- `20261121000000_secure_master_wipe_and_integrity.sql`: Reinstated unbypassable BOLA checks on `fn_wipe_user_data`, dropped legacy `'default_user'` column defaults, and established cascade constraints across all modern tables.

### Non-Negotiable Operational Rules:
1. Never run `DROP TABLE`, `TRUNCATE`, or `RESET` on production databases.
2. Always write migrations with `IF EXISTS` / `IF NOT EXISTS` guards.
3. Every new user-owned table MUST enable RLS and define strict ownership policies.
