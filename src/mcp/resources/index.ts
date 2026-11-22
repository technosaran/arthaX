/**
 * MCP Resources for arthaX
 * Exposes read-only contextual snapshot URIs for portfolio summary, accounts, and budgets.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";
import { handleGetNetWorth } from "../tools/netWorth";
import { handleListAccounts } from "../tools/accounts";
import { handleGetBudgets } from "../tools/budgets";

export function registerMcpResources(
  server: McpServer,
  db: SupabaseClient<Database>,
  userId: string
) {
  // 1. Portfolio Summary Snapshot
  server.resource(
    "portfolio-summary",
    "arthax://portfolio/summary",
    async (uri) => {
      const summary = await handleGetNetWorth(db, userId, "INR");
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(summary, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // 2. Active Accounts
  server.resource(
    "accounts-list",
    "arthax://accounts",
    async (uri) => {
      const accounts = await handleListAccounts(db, userId, false);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(accounts, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );

  // 3. Current Month Budgets
  server.resource(
    "budgets-status",
    "arthax://budgets",
    async (uri) => {
      const budgets = await handleGetBudgets(db, userId);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(budgets, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    }
  );
}
