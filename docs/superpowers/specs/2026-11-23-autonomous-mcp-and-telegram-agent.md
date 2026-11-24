# Autonomous Financial Intelligence Engine: MCP Workers & Telegram Agent

## 1. Intent & The Why

Users want **true autonomy** across their wealth management system:
- **No manual preview hurdles or rigid syntax**: Users should not need to memorize slash commands (like `/addstock`, `/setbudget`, `/quote`) or click through multi-step dry-run previews.
- **Autonomous Thinking ("Auto-Think")**: The system must interpret conversational natural language, voice notes, photos/receipts, or multi-part instructions, automatically reason through what needs to happen, and execute the underlying database and calculation tasks immediately and atomically.
- **Full Operational Parity**: Both external AI assistants (connecting via the Model Context Protocol) and the Telegram Bot must have complete access to all portfolio operations (Banking, Stocks, Mutual Funds, Bullion, Crypto, Bonds, Budgets, Taxes, Analytics, and Integrations Sync).

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **Autonomous Telegram Agent**:
  - Accept text, voice audio, receipt/invoice photos, and execute all financial actions autonomously in real time.
  - Support multi-action instructions in a single turn (e.g. *"bought 10 shares of Tata Motors at 780 from HDFC and set food budget to 8000"*).
  - Provide instant execution feedback with 1-tap undo buttons (safety without friction).
- **Comprehensive MCP Workers**:
  - Expand the arthaX MCP server from 9 tools to 19 domain tools covering all asset classes, mutations, tax analytics, financial velocity, account management, and data synchronization.
  - Provide full JSON-RPC tool schemas via Zod, enabling external AI clients (Claude Desktop, Cursor, Muse, Antigravity) to reason and act autonomously.
- **Shared Domain Action Layer**:
  - Share the core mutation and query handlers between MCP tools and the Telegram agent to guarantee single-source-of-truth logic, atomic PostgreSQL updates, and cache invalidation.

### Non-Goals
- Eliminating Telegram inline buttons for post-action workflows (e.g., category tweaking or 1-tap undo remains available after autonomous execution as a safety net).
- Building custom mobile apps (Telegram + MCP already serve mobile and desktop interfaces).

### Anti-Goals
- **No confirmation gates or dry-run prompts** before executing user instructions. (When the user says "spent 500 on coffee", log it immediately—do not say "Did you mean to spend 500? Confirm yes/no").
- **No brittle regex-only parsing**: Fallback to AI semantic reasoning whenever structured regex does not match cleanly.

---

## 3. Approaches Considered

### Approach 1: Separate Hardcoded Handlers for Telegram and MCP
- **Description**: Add individual slash command parsers to Telegram and write separate tool handlers for MCP.
- **Trade-offs**: Leads to logic duplication, divergent behavior between Telegram and MCP, and keeps Telegram locked to rigid command formats.
- **Verdict**: Rejected.

### Approach 2: Shared Autonomous Domain Layer with Gemini Agentic Dispatcher (Selected)
- **Description**:
  1. Build a unified domain actions layer in `src/mcp/tools/` and `src/utils/finance/` that exposes pure atomic functions for every arthaX task.
  2. Wire the MCP Server tools directly to this unified domain layer.
  3. Upgrade the Telegram Webhook to use an Autonomous Gemini Agent with Function Calling / Structured Intent Routing that auto-reasons over any user input (text, voice, photo) and dispatches actions directly to the domain layer.
- **Trade-offs**: Requires building clean domain handlers for all assets and integrating Gemini function calling / autonomous dispatch in Telegram.
- **Verdict**: Selected. Offers 100% autonomous capability, zero command memorization, and identical behavior in both Telegram and external AI agents.

---

## 4. Detailed Component Design

### 4.1. Domain Operations & MCP Worker Tools (19 Tools)

| Category | Tool Name | Description & Parameters |
|---|---|---|
| **Portfolio & Accounts** | `get_net_worth` | Total wealth, liquid cash, liabilities breakdown (currency: INR/USD). |
| | `list_accounts` | Bank accounts, cards, wallets with balances & types. |
| | `create_account` | Add new bank account or wallet (`name`, `type`, `balance`, `classification`, `lastFour`). |
| | `get_portfolio_holdings`| Query holdings across `stocks`, `mutual_funds`, `bullion`, `bonds`, `crypto`, or `all`. |
| **Transactions & Ledger** | `record_expense` | Atomic expense deduction via `fn_record_expense_atomic`. |
| | `record_income` | Atomic income addition via `fn_record_income_atomic`. |
| | `record_transfer` | Atomic double-entry transfer via `fn_record_transfer_atomic`. |
| | `query_transactions` | Search & filter expenses, income, transfers with date/category filters. |
| | `delete_transaction` | Undo / delete transaction atomically by ID (`type`: expense/income). |
| **Budgets** | `get_budget_status` | Inspect current monthly category budgets and actual burn. |
| | `set_budget` | Set or update monthly budget limit for a category (`category`, `amount`, `month?`). |
| **Investments** | `record_stock_trade` | Record stock purchase/sale, updates average buy price & transactions (`symbol`, `quantity`, `price`, `exchange`, `action`). |
| | `record_mutual_fund_trade`| Record mutual fund purchase/SIP (`schemeName`, `amount`, `units?`, `nav?`). |
| | `record_bullion_trade` | Record gold/silver trade (`metal`: GOLD/SILVER, `weightGrams`, `amount`, `purity?`). |
| | `record_crypto_trade` | Record crypto purchase (`coin`, `quantity`, `priceUsd`). |
| | `get_market_quote` | Fetch live ticker quote for NSE/BSE stocks (`symbol`, `exchange?`). |
| **Analytics & Intelligence** | `get_tax_analytics` | Realized LTCG/STCG, estimated tax liability, tax-loss harvesting opportunities. |
| | `get_financial_analytics`| Savings rate, daily burn velocity, projected month-end spend, category breakdown. |
| | `get_cash_flow_forecast`| Liquid cash runway & monthly balance burn forecast. |
| **Integrations** | `sync_integrations` | Trigger sync for `zerodha`, `binance`, `recurring`, or `all`. |

---

### 4.2. Autonomous Telegram Agent Architecture

```
User Input (Voice Note, Photo Receipt, UPI Screenshot, Casual Text, or Slash Command)
                              │
                              ▼
        Telegram Webhook (`/api/webhooks/telegram`)
                              │
                              ▼
           Gemini Multimodal & Autonomous Brain
         (Extracts intent, accounts, parameters, 
          supports multi-action autonomous reasoning)
                              │
                              ▼
                  Autonomous Action Dispatcher
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   Record Expense/       Set Budgets /         Investment Trades
   Income/Transfer     Account Operations     (Stocks, MF, Bullion)
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                Atomic PostgreSQL Execution
            (Stored procedures & audit tables)
                              │
                              ▼
                Redis Cache Invalidation
                              │
                              ▼
            Instant Autonomous Feedback to Telegram
             (Formatted result + 1-tap Undo button)
```

1. **Auto-Thinking Intent Resolution**:
   - Instead of checking if a string starts with `/command`, user messages (voice, photo, or text) are processed by Gemini with the full portfolio context (user accounts, current balances, current month).
   - Gemini autonomously extracts the required actions and parameters without needing a strict syntax.
2. **Immediate Execution (No Preview Wall)**:
   - All actions execute atomically against PostgreSQL immediately.
   - Confirmation is delivered instantly with the updated balances, category allocations, and an inline `[Undo]` button if the user made a mistake.
3. **Multi-Action Support**:
   - If the user says: *"Bought 5 shares of RELIANCE at 2500 and transferred 5000 to ICICI"*, the autonomous dispatcher handles both actions and reports both results in a single clear response.

---

### 4.3. Architectural Decisions & Edge Case Resolution

1. **Investment Trades vs. Bank Account Linking**:
   - In arthaX, asset holdings (`stock_holdings`, `mutual_fund_holdings`, `bullion_holdings`, `crypto_holdings`) are decoupled from liquid cash accounts in the database schema.
   - Recording an investment trade updates the holding units, weighted average buy price, and logs the investment transaction without arbitrarily debiting liquid bank accounts (preventing artificial distortion of monthly expense budgets and burn velocity).
   - If an account is casually mentioned (e.g. *"bought from HDFC"*), it is preserved in transaction notes for tracking.
2. **Scope of 1-Tap Undo**:
   - Full reverse-atomic undo is supported for ledger transactions (expenses, incomes) via `fn_delete_expense_atomic` and `fn_delete_income_atomic`.
   - For multi-action messages containing an expense or income, the response attaches individual undo callback buttons for those mutations.
3. **Multi-Action Execution Semantics (Partial Success)**:
   - When multiple actions are parsed from a single prompt, they execute sequentially.
   - The response provides an itemized execution report (e.g., *"✅ Logged 10 shares of Tata Motors at ₹780; ⚠️ Transfer failed: account not found"*), ensuring that a failure in one action does not discard other valid actions.
4. **Parameter Auto-Inference (Zero Preview Friction)**:
   - When mandatory parameters are omitted, the autonomous engine auto-infers sensible defaults:
     - Stock prices: Auto-fetches live CMP via `fetchStockQuote` if price is missing.
     - Exchange: Defaults to `NSE`.
     - Accounts for expenses: Defaults to primary/first active bank account if unstated.
     - Budgets: Defaults to current month (`YYYY-MM`).
   - If critical information cannot be inferred (e.g., no amount or category at all), the agent replies with a brief 1-line guidance message.

---

## 5. Verification & Testing Plan

1. **MCP Test Suite**:
   - Unit tests for all new MCP tools (`budgets`, `holdings`, `accounts`, `tax`, `analytics`, `sync`).
   - JSON-RPC protocol tests over `InMemoryTransport` verifying tool registration and schema validation.
2. **Telegram Agent Test Suite**:
   - Test autonomous execution for natural language, voice transcription, and photo receipts.
   - Test multi-action handling and 1-tap undo behavior.
   - Verify that all existing 74 Vitest tests continue to pass without regression.
3. **Typecheck & Linting**:
   - Full TypeScript compilation (`npm run typecheck`).
