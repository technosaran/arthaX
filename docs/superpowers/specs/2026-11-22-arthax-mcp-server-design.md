# arthaX Model Context Protocol (MCP) Server Spec

**Date:** 2026-11-22  
**Status:** In Review / Ready for Plan  
**Target Branch:** `feat/mcp-server`  

---

## 1. Intent & Why
arthaX provides sovereign wealth and financial intelligence across bank accounts, expenses, multi-asset holdings (stocks, mutual funds, bonds, bullion, crypto), budgets, and cash flow projections. 

Modern AI developer environments and conversational agents (Antigravity, Claude Desktop, Cursor, Windsurf, custom agents) communicate via Anthropic's **Model Context Protocol (MCP)**. By building a dedicated, robust MCP server for arthaX, users and autonomous agents can securely inspect personal financial telemetry, evaluate asset allocations, forecast runway, track budget variances, and atomically log transactions via natural language.

---

## 2. Goals & Non-Goals

### Goals
- **Full-Spectrum Portfolio & Wealth Querying**: Expose tools for net worth calculation, bank account balances, multi-asset holdings, and budget utilization.
- **Accurate Mathematical Aggregation**: Utilize arthaX's precision financial calculations (`executeNetWorthTS` and paise-level integer math) rather than raw naive floats.
- **Atomic & Safe Write Operations**: Allow conversational logging of expenses, income, and internal transfers backed by PostgreSQL atomic functions (`fn_record_expense_atomic`, `fn_record_income_atomic`, `fn_record_transfer_atomic`) to prevent partial writes or balance drift.
- **Multi-Tenant & Zero-Trust Security**: Authenticate operations with Supabase service role / API keys while isolating queries strictly to the configured `ARTHAX_USER_ID` or token context.
- **Standard Stdio & Modular Transport**: Built with `@modelcontextprotocol/sdk` over standard input/output (`stdio`) for instant plug-and-play with desktop and terminal AI clients, with clean modular decoupling so tools can be imported into an HTTP/SSE route if needed.
- **Comprehensive Resources & Prompts**: Provide read-only URI resources (`arthax://portfolio/summary`, `arthax://accounts`, `arthax://budgets`) and domain-expert prompts (`financial_health_audit`, `portfolio_risk_rebalance`).
- **High Test Coverage**: Vitest unit tests verifying MCP tool registration, schema validation, and mocked database handlers.

### Non-Goals
- Directly executing broker trade orders (e.g. placing live stock/F&O buy/sell orders via Zerodha Kite).
- Directly exposing raw unencrypted bank credentials or decryption keys.
- Reinventing custom agent protocols outside of the official MCP specification.

---

## 3. Approaches Considered & Trade-offs

1. **Standalone TypeScript Stdio MCP Server (`@modelcontextprotocol/sdk`) — Chosen**
   - *Pros:* Direct TypeScript type sharing with `src/types/database.types.ts`, seamless integration with `executeNetWorthTS` from `src/lib/engine/embeddedEngine.ts`, standard stdio transport supported out-of-the-box by Claude Desktop, Antigravity, and Cursor.
   - *Cons:* Requires Node.js / `tsx` runtime locally.
2. **Next.js Serverless HTTP/SSE Route (`/api/v1/mcp`)**
   - *Pros:* Hosted on Vercel without separate CLI process.
   - *Cons:* Stateful SSE connection handling on Vercel serverless has 15-30s function execution limits; harder to configure locally in desktop clients.
3. **Python FastMCP Microservice (`calculation_engine/mcp/`)**
   - *Pros:* Co-located with Python statement parsers and z-score anomaly modules.
   - *Cons:* Bypasses arthaX's rich TypeScript schemas and atomic database procedures defined in `src/utils/supabase/`.

---

## 4. Architectural Design & File Structure

```
src/mcp/
├── config.ts              # Loads & validates environment variables (SUPABASE_URL, SERVICE_KEY, USER_ID)
├── db.ts                  # Authenticated Supabase client wrapper scoped to user_id
├── types.ts               # MCP tool schemas, argument definitions & payload types
├── server.ts              # McpServer instantiation, transport listener, and entry point
├── tools/
│   ├── index.ts           # Tool registry & registration hook
│   ├── netWorth.ts        # get_net_worth tool
│   ├── accounts.ts        # list_accounts tool
│   ├── transactions.ts    # query_transactions tool
│   ├── holdings.ts        # get_portfolio_holdings tool (stocks, mutual funds, bullion, bonds, crypto)
│   ├── budgets.ts         # get_budget_status tool
│   ├── recordAction.ts    # record_expense, record_income, record_transfer atomic tools
│   └── forecast.ts        # get_cash_flow_forecast tool
├── resources/
│   └── index.ts           # arthax:// URIs for portfolio snapshot, accounts, budgets
└── prompts/
    └── index.ts           # financial_health_audit, portfolio_risk_rebalance
```

### Tool Definitions

| Tool Name | Parameters | Description |
|---|---|---|
| `get_net_worth` | `currency` (default INR) | Calculates consolidated net worth, liquid cash, invested assets, and liabilities. |
| `list_accounts` | `includeArchived` (boolean) | Returns bank accounts, credit cards, and cash ledgers with balances. |
| `query_transactions` | `type` (expense/income/transfer), `limit`, `startDate`, `endDate`, `category` | Queries recent ledger entries with filtering. |
| `get_portfolio_holdings`| `assetClass` (all, stocks, mutual_funds, bullion, bonds, crypto) | Returns granular holdings, quantities, invested amounts, and valuations. |
| `get_budget_status` | `month` (YYYY-MM) | Returns monthly budget limits, actual expenditures, and remaining runway. |
| `record_expense` | `accountId`, `amount`, `category`, `description`, `date` | Atomically logs expense and decrements account balance. |
| `record_income` | `accountId`, `amount`, `source`, `description`, `date` | Atomically logs income and increments account balance. |
| `record_transfer` | `fromAccountId`, `toAccountId`, `amount`, `description`, `date` | Atomically transfers balance between accounts. |
| `get_cash_flow_forecast` | `monthsAhead` (1 to 6) | Forecasts projected balances using recurring rules and burn rate. |

---

## 5. Security & Authentication

- Reads `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local` or environment.
- Enforces user isolation via `ARTHAX_USER_ID`: If not explicitly provided in environment, queries the default primary account user or fails gracefully with a setup prompt.
- Write actions validate positive non-zero amounts and verify account ownership before committing atomic RPC functions.

---

## 6. Verification & Testing

- Unit tests in `tests/mcp/tools.test.ts` verifying all tool handlers against mock Supabase datasets.
- Verification of MCP server protocol initialization (capabilities handshake, list_tools, call_tool).
- Running `npm run typecheck` and `npm test` to ensure zero regressions in existing code.
