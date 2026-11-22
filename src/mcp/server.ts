/**
 * arthaX Model Context Protocol (MCP) Server Entry Point
 * Implements McpServer with stdio transport for local AI assistants (Claude Desktop, Antigravity, Cursor).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getMcpConfig, McpConfig } from "./config";
import { getMcpDb } from "./db";
import { registerMcpTools } from "./tools";
import { registerMcpResources } from "./resources";
import { registerMcpPrompts } from "./prompts";

export function createMcpServer(customConfig?: McpConfig) {
  const config = customConfig || getMcpConfig();
  const db = getMcpDb(config);

  const server = new McpServer({
    name: "arthaX",
    version: "1.0.0",
  });

  // Register domain tools, resources, and prompts
  registerMcpTools(server, db, config.userId);
  registerMcpResources(server, db, config.userId);
  registerMcpPrompts(server);

  return server;
}

export async function startStdioServer() {
  try {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    // Standard log to stderr so stdout remains clean for MCP JSON-RPC protocol
    process.stderr.write("[arthaX MCP] Starting server over stdio transport...\n");

    await server.connect(transport);
    process.stderr.write("[arthaX MCP] Server connected and ready for requests.\n");
  } catch (err: any) {
    process.stderr.write(`[arthaX MCP] Fatal startup error: ${err.message}\n`);
    process.exit(1);
  }
}

// When executed directly as CLI script
if (
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"))
) {
  startStdioServer();
}
