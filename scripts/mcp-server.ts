#!/usr/bin/env tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables from .env.local or .env
const envLocalPath = path.join(process.cwd(), ".env.local");
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const server = new Server(
  {
    name: "financeos-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_financial_overview",
        description: "Fetch comprehensive financial overview including net worth, accounts, cashflow summary, liabilities, and monthly budgets.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: { type: "string", description: "Optional user ID to scope queries" },
          },
        },
      },
      {
        name: "list_accounts",
        description: "List all user bank accounts, credit cards, institutions, currencies, and current balances.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: { type: "string", description: "Optional user ID filter" },
          },
        },
      },
      {
        name: "list_recent_transactions",
        description: "Get recent financial transactions (expenses and incomes) with optional category or type filter.",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["expense", "income", "all"], description: "Filter transaction type" },
            category: { type: "string", description: "Filter by category name (e.g. Groceries, Salary, Utilities)" },
            limit: { type: "number", description: "Maximum number of transactions to return (default 20)" },
          },
        },
      },
      {
        name: "add_transaction",
        description: "Log a new transaction (expense or income), update account balance, and create audit ledger log.",
        inputSchema: {
          type: "object",
          properties: {
            account_name_or_id: { type: "string", description: "Account name (e.g. HDFC, ICICI, Cash) or Account UUID" },
            type: { type: "string", enum: ["expense", "income"], description: "Transaction type" },
            amount: { type: "number", description: "Transaction amount" },
            description: { type: "string", description: "Description or merchant name" },
            category: { type: "string", description: "Category (e.g. Food, Shopping, Transport, Salary)" },
          },
          required: ["type", "amount", "description", "category"],
        },
      },
      {
        name: "get_portfolio_summary",
        description: "Get summary of all investment assets: Stock portfolio, Mutual Funds, Bonds, and Alternative Assets.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "search_ledger",
        description: "Search historical ledger log records for audit trails and account balance adjustments.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keyword for ledger log details or account names" },
            limit: { type: "number", description: "Maximum logs to return (default 20)" },
          },
        },
      },
    ],
  };
});

// Execute tool requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_financial_overview") {
      const [{ data: accountsArr }, { data: expensesArr }, { data: incomesArr }, { data: liabilitiesArr }] = await Promise.all([
        supabase.from("accounts").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("incomes").select("*"),
        supabase.from("liabilities").select("*"),
      ]);

      const totalBalance = (accountsArr || []).reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
      const totalExpenses = (expensesArr || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const totalIncomes = (incomesArr || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const totalLiabilities = (liabilitiesArr || []).reduce((acc, curr) => acc + Number(curr.remaining_amount || 0), 0);

      const netWorth = totalBalance - totalLiabilities;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                net_worth: netWorth,
                total_bank_balance: totalBalance,
                total_incomes: totalIncomes,
                total_expenses: totalExpenses,
                total_liabilities: totalLiabilities,
                accounts_count: accountsArr?.length || 0,
                accounts: accountsArr?.map((a) => ({ name: a.name, type: a.type, balance: a.balance, currency: a.currency })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "list_accounts") {
      const { data: accountsArr, error } = await supabase.from("accounts").select("*");
      if (error) throw error;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(accountsArr || [], null, 2),
          },
        ],
      };
    }

    if (name === "list_recent_transactions") {
      const type = (args?.type as string) || "all";
      const category = args?.category as string | undefined;
      const limit = Number(args?.limit || 20);

      let query = supabase.from("transactions").select("*").order("date", { ascending: false }).limit(limit);

      if (type !== "all") {
        query = query.eq("type", type);
      }
      if (category) {
        query = query.ilike("category", `%${category}%`);
      }

      const { data: transactionsArr, error } = await query;
      if (error) throw error;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(transactionsArr || [], null, 2),
          },
        ],
      };
    }

    if (name === "add_transaction") {
      const type = args?.type as string;
      const amount = Number(args?.amount);
      const description = args?.description as string;
      const category = args?.category as string;
      const accountInput = args?.account_name_or_id as string | undefined;

      // 1. Fetch account
      let account: any = null;
      const { data: allAccounts } = await supabase.from("accounts").select("*");

      if (allAccounts && allAccounts.length > 0) {
        if (accountInput) {
          account = allAccounts.find(
            (a) => a.id === accountInput || a.name.toLowerCase().includes(accountInput.toLowerCase())
          );
        }
        if (!account) {
          account = allAccounts[0]; // fallback to first account
        }
      }

      const userId = account?.user_id || "00000000-0000-0000-0000-000000000000";
      const accountId = account?.id || null;

      let newBalance = Number(account?.balance || 0);
      const oldBalance = newBalance;

      if (type === "expense") {
        newBalance -= amount;
      } else {
        newBalance += amount;
      }

      // 2. Update account balance if account exists
      if (accountId) {
        await supabase.from("accounts").update({ balance: newBalance.toString() }).eq("id", accountId);
      }

      // 3. Insert transaction
      const { data: newTx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          account_id: accountId,
          type,
          amount: amount.toString(),
          description,
          category,
          date: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (txErr) throw txErr;

      // 4. Insert into expense or income table
      if (type === "expense") {
        await supabase.from("expenses").insert({
          user_id: userId,
          account_id: accountId,
          description,
          amount: amount.toString(),
          category,
          date: new Date().toISOString(),
        });
      } else {
        await supabase.from("incomes").insert({
          user_id: userId,
          account_id: accountId,
          description,
          amount: amount.toString(),
          category,
          date: new Date().toISOString(),
        });
      }

      // 5. Write to ledger log
      await supabase.from("ledger_logs").insert({
        user_id: userId,
        account_id: accountId,
        account_name: account?.name || "General",
        action_type: type === "expense" ? "ADJUST_DOWN" : "ADJUST_UP",
        amount: amount.toString(),
        previous_balance: oldBalance.toString(),
        new_balance: newBalance.toString(),
        details: `MCP Transaction: ${description} (${category})`,
        source_type: type,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: `Logged ${type} of ₹${amount} for '${description}' under '${category}'.`,
                account_updated: account?.name || "N/A",
                old_balance: oldBalance,
                new_balance: newBalance,
                transaction: newTx,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "get_portfolio_summary") {
      const [{ data: stocks }, { data: mutualFunds }, { data: bonds }, { data: altAssets }] = await Promise.all([
        supabase.from("investments").select("*"),
        supabase.from("mutual_funds").select("*"),
        supabase.from("bonds").select("*"),
        supabase.from("alternative_assets").select("*"),
      ]);

      const stocksValue = (stocks || []).reduce((acc, curr) => acc + Number(curr.quantity || 0) * Number(curr.current_price || 0), 0);
      const mfValue = (mutualFunds || []).reduce((acc, curr) => acc + Number(curr.units || 0) * Number(curr.current_nav || 0), 0);
      const bondsValue = (bonds || []).reduce((acc, curr) => acc + Number(curr.current_value || 0), 0);
      const altAssetsValue = (altAssets || []).reduce((acc, curr) => acc + Number(curr.current_value || 0), 0);

      const totalPortfolioValue = stocksValue + mfValue + bondsValue + altAssetsValue;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total_portfolio_value: totalPortfolioValue,
                stocks: { count: stocks?.length || 0, total_value: stocksValue, items: stocks },
                mutual_funds: { count: mutualFunds?.length || 0, total_value: mfValue, items: mutualFunds },
                bonds: { count: bonds?.length || 0, total_value: bondsValue, items: bonds },
                alternative_assets: { count: altAssets?.length || 0, total_value: altAssetsValue, items: altAssets },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "search_ledger") {
      const queryStr = (args?.query as string) || "";
      const limit = Number(args?.limit || 20);

      let query = supabase.from("ledger_logs").select("*").order("created_at", { ascending: false }).limit(limit);

      if (queryStr) {
        query = query.or(`details.ilike.%${queryStr}%,account_name.ilike.%${queryStr}%`);
      }

      const { data: logs, error } = await query;
      if (error) throw error;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(logs || [], null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${error.message || String(error)}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FinanceOS MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting FinanceOS MCP Server:", error);
  process.exit(1);
});
