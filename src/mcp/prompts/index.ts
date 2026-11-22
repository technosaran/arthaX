/**
 * MCP Prompts for arthaX
 * Provides structured financial audit and portfolio advisory prompt templates.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMcpPrompts(server: McpServer) {
  // 1. Comprehensive Financial Health Audit Prompt
  server.prompt(
    "financial_health_audit",
    "Run an end-to-end sovereign wealth and financial health diagnostic on the user's arthaX portfolio.",
    {
      riskTolerance: z
        .enum(["conservative", "moderate", "aggressive"])
        .optional()
        .default("moderate")
        .describe("User's risk tolerance profile"),
    },
    ({ riskTolerance }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Please conduct a comprehensive financial health audit for my arthaX portfolio with a ${riskTolerance} risk profile.
Follow these steps:
1. Call 'get_net_worth' to evaluate my total net worth, liquid cash, liabilities, and multi-asset valuations.
2. Call 'list_accounts' to check my liquid emergency reserves and identify any high-interest debt or credit balances.
3. Call 'get_budget_status' to inspect my spending velocity, category limits, and any budget overruns this month.
4. Call 'get_cash_flow_forecast' to assess my current runway in months and projected cash positions.
5. Provide actionable, high-impact recommendations categorized into: Immediate Liquidity & Safety, Budget Optimization, and Long-Term Asset Allocation.`,
          },
        },
      ],
    })
  );

  // 2. Portfolio Risk & Rebalancing Prompt
  server.prompt(
    "portfolio_risk_rebalance",
    "Analyze multi-asset allocation (stocks, mutual funds, bullion, bonds, crypto) against target diversification.",
    {
      targetEquityPercent: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .default(60)
        .describe("Target percentage for equities (stocks + mutual funds)"),
    },
    ({ targetEquityPercent }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Please analyze my arthaX investment portfolio against a target equity allocation of ${targetEquityPercent}%.
Follow these steps:
1. Call 'get_portfolio_holdings' with assetClass='all' to review my granular positions across stocks, mutual funds, bullion, bonds, and crypto.
2. Call 'get_net_worth' to see the exact current percentage allocation across each asset class.
3. Identify any asset class that is overweight or underweight relative to the target.
4. Highlight any individual stock concentration risks or sector imbalances.
5. Outline a tax-efficient rebalancing plan to align the portfolio with the target weights without triggering unnecessary capital gains.`,
          },
        },
      ],
    })
  );
}
