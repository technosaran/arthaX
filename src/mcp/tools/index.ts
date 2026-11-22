/**
 * MCP Tools Registry for arthaX
 * Registers all financial intelligence, query, and atomic mutation tools on McpServer.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";
import { handleGetNetWorth } from "./netWorth";
import { handleListAccounts } from "./accounts";
import { handleGetHoldings } from "./holdings";
import { handleGetBudgets } from "./budgets";
import { handleGetForecast } from "./forecast";
import { handleQueryTransactions } from "./transactions";
import {
  handleRecordExpense,
  handleRecordIncome,
  handleRecordTransfer,
} from "./recordAction";

export function registerMcpTools(
  server: McpServer,
  db: SupabaseClient<Database>,
  userId: string
) {
  // 1. Net Worth Tool
  server.tool(
    "get_net_worth",
    "Calculate comprehensive net worth across all asset classes (cash, stocks, mutual funds, bonds, bullion, crypto) and liabilities using arthaX's precision calculation engine.",
    {
      currency: z
        .string()
        .optional()
        .default("INR")
        .describe("Currency code for valuation (default: INR)"),
    },
    async ({ currency }) => {
      try {
        const result = await handleGetNetWorth(db, userId, currency);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 2. List Accounts Tool
  server.tool(
    "list_accounts",
    "List all bank accounts, credit cards, cash wallets, and investment accounts with current balances and asset/liability classifications.",
    {
      includeArchived: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include archived or closed accounts"),
    },
    async ({ includeArchived }) => {
      try {
        const result = await handleListAccounts(db, userId, includeArchived);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 3. Portfolio Holdings Tool
  server.tool(
    "get_portfolio_holdings",
    "Retrieve granular investment holdings across stocks, mutual funds, bullion (gold/silver), corporate/PSU bonds, and crypto.",
    {
      assetClass: z
        .enum(["all", "stocks", "mutual_funds", "bullion", "bonds", "crypto"])
        .optional()
        .default("all")
        .describe("Specific asset class to filter by or 'all'"),
    },
    async ({ assetClass }) => {
      try {
        const result = await handleGetHoldings(db, userId, assetClass);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 4. Budget Status Tool
  server.tool(
    "get_budget_status",
    "Inspect current monthly budgets, category spending limits, actual expenditure, remaining balance, and over-budget warnings.",
    {
      month: z
        .string()
        .optional()
        .describe("Target month in YYYY-MM format (defaults to current month)"),
    },
    async ({ month }) => {
      try {
        const result = await handleGetBudgets(db, userId, month);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 5. Cash Flow & Runway Forecast Tool
  server.tool(
    "get_cash_flow_forecast",
    "Forecast liquid cash runway and projected monthly balances based on historical burn rate and active recurring rules.",
    {
      monthsAhead: z
        .number()
        .min(1)
        .max(12)
        .optional()
        .default(3)
        .describe("Number of months ahead to project (1 to 12)"),
    },
    async ({ monthsAhead }) => {
      try {
        const result = await handleGetForecast(db, userId, monthsAhead);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 6. Query Transactions Tool
  server.tool(
    "query_transactions",
    "Search and filter ledger transactions (expenses, incomes, transfers) across accounts, dates, and categories.",
    {
      type: z
        .enum(["all", "expense", "income", "transfer"])
        .optional()
        .default("all")
        .describe("Transaction type filter"),
      accountId: z.string().optional().describe("Filter by specific account ID"),
      category: z.string().optional().describe("Filter by transaction category"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD"),
      limit: z.number().min(1).max(100).optional().default(20).describe("Max records to return"),
    },
    async (filters) => {
      try {
        const result = await handleQueryTransactions(db, userId, filters);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 7. Record Expense Tool (Atomic)
  server.tool(
    "record_expense",
    "Atomically record an expense and decrement the associated account balance via PostgreSQL stored procedure.",
    {
      accountId: z.string().describe("ID of the account paying for the expense"),
      amount: z.number().positive().describe("Expense amount strictly > 0"),
      category: z.string().describe("Expense category (e.g., Food & Dining, Shopping, Utilities)"),
      title: z.string().describe("Brief title/merchant of the expense"),
      date: z.string().optional().describe("Date of expense (YYYY-MM-DD, defaults to today)"),
      notes: z.string().optional().describe("Optional context or notes"),
      tags: z.array(z.string()).optional().describe("Optional categorization tags"),
    },
    async (params) => {
      try {
        const result = await handleRecordExpense(db, userId, params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 8. Record Income Tool (Atomic)
  server.tool(
    "record_income",
    "Atomically record income and increment the receiving account balance via PostgreSQL stored procedure.",
    {
      accountId: z.string().describe("ID of the account receiving the funds"),
      amount: z.number().positive().describe("Income amount strictly > 0"),
      category: z.string().describe("Income category (e.g., Salary, Dividend, Freelance, Rental)"),
      title: z.string().describe("Brief title/source of the income"),
      date: z.string().optional().describe("Date received (YYYY-MM-DD, defaults to today)"),
      frequency: z.string().optional().default("ONE_TIME").describe("Frequency (e.g. ONE_TIME, MONTHLY)"),
      notes: z.string().optional().describe("Optional notes"),
      tags: z.array(z.string()).optional().describe("Optional tags"),
    },
    async (params) => {
      try {
        const result = await handleRecordIncome(db, userId, params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // 9. Record Transfer Tool (Atomic)
  server.tool(
    "record_transfer",
    "Atomically record an internal fund transfer between two accounts, updating both account balances simultaneously.",
    {
      fromAccountId: z.string().describe("Source account ID"),
      toAccountId: z.string().describe("Destination account ID"),
      amount: z.number().positive().describe("Transfer amount strictly > 0"),
      date: z.string().optional().describe("Date of transfer (YYYY-MM-DD, defaults to today)"),
      notes: z.string().optional().describe("Optional transfer notes"),
    },
    async (params) => {
      try {
        const result = await handleRecordTransfer(db, userId, params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
