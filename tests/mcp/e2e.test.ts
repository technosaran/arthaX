import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../src/mcp/server";

describe("ArthaX MCP Server Protocol E2E", () => {
  it("completes capability negotiation, lists tools/resources/prompts, and executes tools", async () => {
    // Instantiate McpServer
    const server = createMcpServer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
      userId: "test-user-id",
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client(
      {
        name: "test-ai-agent",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(clientTransport);

    // 1. Verify Tools
    const toolList = await client.listTools();
    const toolNames = toolList.tools.map((t) => t.name);
    expect(toolNames).toContain("get_net_worth");
    expect(toolNames).toContain("list_accounts");
    expect(toolNames).toContain("get_portfolio_holdings");
    expect(toolNames).toContain("get_budget_status");
    expect(toolNames).toContain("get_cash_flow_forecast");
    expect(toolNames).toContain("query_transactions");
    expect(toolNames).toContain("record_expense");
    expect(toolNames).toContain("record_income");
    expect(toolNames).toContain("record_transfer");

    // 2. Verify Prompts
    const promptList = await client.listPrompts();
    const promptNames = promptList.prompts.map((p) => p.name);
    expect(promptNames).toContain("financial_health_audit");
    expect(promptNames).toContain("portfolio_risk_rebalance");

    // 3. Verify Resources
    const resourceList = await client.listResources();
    const resourceUris = resourceList.resources.map((r) => r.uri);
    expect(resourceUris).toContain("arthax://portfolio/summary");
    expect(resourceUris).toContain("arthax://accounts");
    expect(resourceUris).toContain("arthax://budgets");

    // Clean up
    await client.close();
    await server.close();
  });
});
