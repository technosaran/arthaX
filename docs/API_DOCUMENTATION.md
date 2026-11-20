# ArthaX API Documentation & Contract Standards

## 1. Overview & Standard Envelope
All ArthaX API endpoints (both Next.js Route Handlers and FastAPI Python routes) adhere to a standardized JSON response contract with consistent HTTP status codes, structured error payloads, and correlation tracking via `requestId`.

### 1.1 Success Response Schema
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "requestId": "req_01jcb73kd9...",
    "page": 1,
    "limit": 50,
    "total": 128,
    "timestamp": "2026-11-20T22:00:00.000Z"
  }
}
```

### 1.2 Error Response Schema
```json
{
  "success": false,
  "error": "Human readable error description",
  "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | RATE_LIMITED | INTERNAL_SERVER_ERROR",
  "details": { ... },
  "requestId": "req_01jcb73kd9..."
}
```

---

## 2. Core API Endpoints

### 2.1 Authentication & Workspace
- `POST /api/v1/workspace/wipe`
  - **Purpose**: Deletes all user data across all 26 tables and clears associated Redis caches.
  - **Auth**: Requires verified user JWT.
  - **Safety**: Rejects cross-tenant deletion attempts with HTTP 403.
  - **Response**: `{ success: true, data: { deletedTablesCount: 26, deletedRecordsCount: ... } }`

### 2.2 Transactions & Ledger
- `GET /api/v1/transactions`
  - **Parameters**:
    - `type`: `all | expense | income` (default: `all`)
    - `month`: `YYYY-MM` (e.g. `2025-02`) — handles all month lengths and leap years cleanly via `gte(start).lt(nextMonthStart)`.
    - `page`: integer (default: 1)
    - `limit`: integer (default: 50, max: 100)
    - `search`: string (case-insensitive substring match)
  - **Behavior**: Merges expenses and income into a globally sorted chronological stream without pagination skew.
- `POST /api/v1/transactions`
  - **Headers**: `Idempotency-Key` (optional, recommended for mutations)
  - **Payload**:
    ```json
    {
      "type": "expense",
      "title": "Grocery Shopping",
      "amount": 2450.00,
      "category": "Food",
      "date": "2025-02-15",
      "account_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    }
    ```

### 2.3 Transfers
- `GET /api/v1/transfers`
  - **Parameters**: `month`, `page`, `limit`
  - **Behavior**: Uses robust boundary query `gte(transfer_date, start).lt(transfer_date, nextMonthStart)`.
- `POST /api/v1/transfers`
  - **Headers**: `Idempotency-Key`
  - **Payload**:
    ```json
    {
      "from_account_id": "uuid-1",
      "to_account_id": "uuid-2",
      "amount": 10000.00,
      "transfer_date": "2025-02-15",
      "notes": "Savings transfer"
    }
    ```

### 2.4 Analytics & Tax Engine
- `GET /api/v1/analytics`
  - **Purpose**: Returns aggregate wealth metrics, net worth, assets, liabilities, and holdings breakdown.
  - **Pricing**: Valuates equities using `quantity * current_price`, mutual funds using `units * current_nav`, and bullion using `weight_grams * current_rate_per_gram`.
- `GET /api/v1/analytics/tax`
  - **Parameters**: `ay` (assessment year, e.g. `2025-26`), `slab` (tax slab rate, e.g. `0.30`)
  - **Behavior**: Runs strict FIFO lot matching across equity buy/sell trades, computes Section 112A LTCG (12.5% above ₹1.25L), Section 111A STCG (20%), Section 115BBH Crypto (flat 31.2% with zero set-off), and identifies tax-loss harvesting opportunities.

---

## 3. Python Financial Calculation Engine (AFCE) Endpoints

Mounted under `/api/calculations/*` and `/api/py/calculations/*`:

| Endpoint | Method | Input Model | Purpose |
| :--- | :--- | :--- | :--- |
| `/calculations/health` | GET | None | Health status, version, and active calculation modules |
| `/calculations/networth` | POST | `NetWorthCalculationRequest` | Zero-error Decimal net worth computation |
| `/calculations/portfolio`| POST | `PortfolioCalculationRequest`| XIRR, CAGR, invested vs market value |
| `/calculations/tax` | POST | `TaxCalculationRequest` | Statutory Budget 2024 tax & harvesting simulation |
| `/calculations/expenses` | POST | `ExpensesCalculationRequest` | Expense aggregation and refund deductions |
| `/calculations/income` | POST | `IncomeCalculationRequest` | Income flow, cash surplus, savings rate |
| `/calculations/budget` | POST | `BudgetCalculationRequest` | Budget limits, utilization, and rollover |
| `/calculations/reconciliation` | POST | `ReconciliationCalculationRequest` | Double-entry accounting balance verification |
| `/calculations/validation` | GET | None | Developer dashboard pass-rate metrics |
| `/calculations/history` | GET | `limit`, `type`, `status` | User-scoped calculation audit trail |
