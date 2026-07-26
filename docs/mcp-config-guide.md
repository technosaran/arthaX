# 🤖 FinanceOS MCP (Model Context Protocol) Integration Guide

This guide explains how to connect **FinanceOS** to AI assistants such as **Claude Desktop**, **Cursor**, **Antigravity**, or **ChatGPT Desktop** so they can read net worth, query account balances, search transactions, and log expenses using natural language.

---

## ⚡ Option 1: Stdio Transport (Local CLI)

Add the following to your AI client's configuration file (e.g. `claude_desktop_config.json` or `.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "financeos": {
      "command": "npx",
      "args": ["-y", "tsx", "c:/Users/saran/Desktop/dashboard/scripts/mcp-server.ts"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SUPABASE_KEY"
      }
    }
  }
}
```

---

## 🌐 Option 2: HTTP API Transport (Next.js Server)

When your FinanceOS server is running (`npm run dev` or production deployment), AI clients can call the MCP API endpoint directly:

- **Endpoint**: `http://localhost:3000/api/mcp`
- **Method**: `POST`
- **Payload Example**:

```json
{
  "name": "add_transaction",
  "arguments": {
    "type": "expense",
    "amount": 350,
    "description": "Starbucks Coffee",
    "category": "Food & Dining",
    "account_name_or_id": "HDFC"
  }
}
```

---

## 🛠️ Available MCP Tools

| Tool | Action | Example Prompt |
| :--- | :--- | :--- |
| `get_financial_overview` | Read | *"What is my current net worth and bank balance breakdown?"* |
| `list_accounts` | Read | *"List all my bank accounts and current balances."* |
| `list_recent_transactions` | Read | *"Show me my last 5 expenses in Groceries."* |
| `add_transaction` | Write | *"I just paid ₹1,200 for Internet Bill from SBI Account."* |
| `get_portfolio_summary` | Read | *"What is the current total value of my stock & mutual fund investments?"* |
| `search_ledger` | Read | *"Search ledger logs for Uber payments."* |
