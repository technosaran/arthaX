import { describe, it, expect } from "vitest";
import { getMcpClientConfig } from "../../src/components/McpIntegrationCard";

describe("McpIntegrationCard Config Generator", () => {
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
