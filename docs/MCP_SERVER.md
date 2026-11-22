# arthaX Model Context Protocol (MCP) Server

The **arthaX MCP Server** connects conversational AI assistants (Muse, Claude Desktop, Cursor, Antigravity) directly to your arthaX sovereign wealth intelligence layer. Agents can query portfolio valuations, check account balances, analyze budget variances, forecast cash runway, and atomically record expenses, incomes, and transfers using natural language.

---

## 🚀 Two Connection Modes

arthaX supports two connection methods depending on whether you are an end user or a local developer:

### 1. Remote HTTP Connection (Recommended for All Users)
Zero database keys, zero local files needed. Any logged-in user can connect directly over secure HTTPS using their personal session token.

**In Muse / Claude / Cursor:**
Add an MCP server with **HTTP / SSE Transport**:
- **URL:** `https://your-domain.com/api/v1/mcp`
- **Headers:**
  ```json
  {
    "Authorization": "Bearer <YOUR_ARTHAX_SESSION_TOKEN>"
  }
  ```

In the arthaX Web UI, users simply open **Settings → Integrations → Model Context Protocol (MCP)** and click **"Copy 1-Click Config"** to copy their pre-authenticated configuration!

---

### 2. Local Stdio Connection (For Developers / Self-Hosting)
For local testing or standalone single-tenant CLI development:

```bash
# Start local stdio MCP server
npm run mcp
```

**Client Configuration (`claude_desktop_config.json` or `muse.json`):**
```json
{
  "mcpServers": {
    "arthax": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/server.ts"],
      "cwd": "C:/Users/saran/Desktop/arthaX",
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://fvpfzbuoizzjwgekuhot.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SUPABASE_SERVICE_ROLE_KEY",
        "ARTHAX_USER_ID": "YOUR_USER_UUID"
      }
    }
  }
}
```

---

## 🛠️ Available MCP Tools

| Tool Name | Parameters | Description |
|---|---|---|
| `get_net_worth` | `currency?: string` (default: `"INR"`) | Calculates total net worth, liquid cash, liabilities, and asset class breakdown using arthaX's precision calculation engine (supports automatic INR/USD exchange rates). |
| `list_accounts` | `includeArchived?: boolean` | Lists bank accounts, credit cards, and cash wallets with current balances and asset/liability classifications. |
| `get_portfolio_holdings` | `assetClass?: "all" \| "stocks" \| "mutual_funds" \| "bullion" \| "bonds" \| "crypto"` | Returns granular holdings, quantities, invested amounts, current prices, and P&L. |
| `get_budget_status` | `month?: string` (`YYYY-MM`) | Inspects monthly budgets, limits, actual category spending, remaining balances, and over-budget warnings (with dynamic month-end calendar bounds). |
| `get_cash_flow_forecast` | `monthsAhead?: number` (1 to 12) | Projects liquid cash runway and monthly balance burn based on historical expenses and active recurring rules. |
| `query_transactions` | `type`, `accountId`, `category`, `startDate`, `endDate`, `limit` | Searches expenses, incomes, and transfers with pagination and date filtering. |
| `record_expense` | `accountId`, `amount`, `category`, `title`, `date?`, `notes?`, `tags?` | **Atomically** logs an expense and decrements account balance via PostgreSQL stored procedure (`fn_record_expense_atomic`). |
| `record_income` | `accountId`, `amount`, `category`, `title`, `date?`, `frequency?`, `notes?` | **Atomically** logs income and increments account balance via PostgreSQL stored procedure (`fn_record_income_atomic`). |
| `record_transfer` | `fromAccountId`, `toAccountId`, `amount`, `date?`, `notes?` | **Atomically** moves funds between two accounts, updating both balances simultaneously (`fn_record_transfer_atomic`). |

---

## 📑 Resources (Read-Only URIs)

AI agents can read contextual live state snapshots from these URIs:
- `arthax://portfolio/summary`: Real-time net worth and asset class valuation summary.
- `arthax://accounts`: All active bank accounts and balances.
- `arthax://budgets`: Current monthly budget limits and utilization percentages.

---

## 💬 Prompts

Built-in prompt templates to guide autonomous analysis:
1. `financial_health_audit`: Conducts a multi-step audit of emergency runway, debt, asset allocation, and spending velocity.
2. `portfolio_risk_rebalance`: Compares equity, debt, bullion, and crypto weightings against target allocation percentages and proposes tax-efficient rebalancing steps.

---

## 🧪 Verification & Testing

Run all MCP server unit, protocol, and end-to-end tests:
```bash
npx vitest run tests/mcp/
```

Run TypeScript compilation check:
```bash
npm run typecheck
```
