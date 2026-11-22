# arthaX Model Context Protocol (MCP) Server

The **arthaX MCP Server** connects conversational AI assistants (Claude Desktop, Antigravity, Cursor, Windsurf) directly to your arthaX sovereign wealth intelligence layer. Agents can query portfolio valuations, check account balances, analyze budget variances, forecast cash runway, and atomically record expenses, incomes, and transfers using natural language.

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure your `.env.local` contains valid Supabase credentials and an optional user identifier:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
ARTHAX_USER_ID="your-user-uuid" # optional, defaults to 'default-arthax-user'
```

### 2. Run Locally via Stdio
```bash
npm run mcp
```
*(Runs `npx tsx src/mcp/server.ts` over standard input/output).*

---

## 🔌 Client Configuration

### Claude Desktop
Add this entry to your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "arthax": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/server.ts"],
      "cwd": "C:/Users/saran/Desktop/arthaX",
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://fvpfzbuoizzjwgekuhot.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY",
        "ARTHAX_USER_ID": "YOUR_USER_ID"
      }
    }
  }
}
```

### Antigravity / Cursor
Add to your project or workspace MCP settings:

```json
{
  "mcpServers": {
    "arthax": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/server.ts"],
      "cwd": "C:/Users/saran/Desktop/arthaX"
    }
  }
}
```

---

## 🛠️ Available MCP Tools

| Tool Name | Parameters | Description |
|---|---|---|
| `get_net_worth` | `currency?: string` (default: `"INR"`) | Calculates total net worth, liquid cash, liabilities, and asset class breakdown using arthaX's precision calculation engine. |
| `list_accounts` | `includeArchived?: boolean` | Lists bank accounts, credit cards, and cash wallets with current balances and asset/liability classifications. |
| `get_portfolio_holdings` | `assetClass?: "all" \| "stocks" \| "mutual_funds" \| "bullion" \| "bonds" \| "crypto"` | Returns granular holdings, quantities, invested amounts, current prices, and P&L. |
| `get_budget_status` | `month?: string` (`YYYY-MM`) | Inspects monthly budgets, limits, actual category spending, remaining balances, and over-budget warnings. |
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
