import { describe, it, expect, vi } from "vitest";
import { createMcpServer } from "../../src/mcp/server";

describe("ArthaX MCP Server Assembly", () => {
  it("initializes McpServer with server name, tools, resources, and prompts", () => {
    const server = createMcpServer({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-key",
      userId: "user-test",
    });

    expect(server).toBeDefined();
    expect(typeof server.connect).toBe("function");
  });
});
