import { describe, it, expect } from "vitest";
import { getMcpClientConfig, getMcpRemoteConfig } from "../../src/components/McpIntegrationCard";

describe("McpIntegrationCard Config Generator", () => {
  it("generates remote MCP config using supplied token without hardcoded live secrets", () => {
    const raw = getMcpRemoteConfig("claude", "ax_mcp_sample.sig", "https://arthax.example.com");
    const parsed = JSON.parse(raw);

    expect(parsed.mcpServers.arthax.url).toBe("https://arthax.example.com/api/v1/mcp");
    expect(parsed.mcpServers.arthax.headers.Authorization).toBe("Bearer ax_mcp_sample.sig");

    const defaultRaw = getMcpRemoteConfig("claude");
    expect(defaultRaw).not.toContain("arthax_mcp_live_token");
    expect(defaultRaw).toContain("YOUR_PERSONAL_MCP_TOKEN");
  });

  it("generates Muse config with user-scoped ARTHAX_USER_ID", () => {
    const raw = getMcpClientConfig("muse", "user-uuid-abc-123", "https://example.supabase.co");
    const parsed = JSON.parse(raw);

    expect(parsed).toHaveProperty("mcpServers");
    expect(parsed.mcpServers).toHaveProperty("arthax");
    expect(parsed.mcpServers.arthax.env.ARTHAX_USER_ID).toBe("user-uuid-abc-123");
    expect(parsed.mcpServers.arthax.env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(parsed.mcpServers.arthax.args).toContain("src/mcp/server.ts");
  });

  it("generates Claude Desktop config with user-scoped ARTHAX_USER_ID", () => {
    const raw = getMcpClientConfig("claude", "user-uuid-xyz-789");
    const parsed = JSON.parse(raw);

    expect(parsed.mcpServers.arthax.env.ARTHAX_USER_ID).toBe("user-uuid-xyz-789");
  });

  it("generates Cursor config without plain text secrets", () => {
    const raw = getMcpClientConfig("cursor", "user-uuid-123");
    const parsed = JSON.parse(raw);

    expect(parsed.mcpServers.arthax).toBeDefined();
    expect(parsed.mcpServers.arthax.command).toBe("npx");
  });
});
