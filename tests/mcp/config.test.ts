import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMcpConfig } from "../../src/mcp/config";
import { getMcpDb } from "../../src/mcp/db";

describe("MCP Configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws descriptive error when Supabase URL or Key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(() => getMcpConfig()).toThrow(/Supabase configuration missing/);
  });

  it("loads configuration successfully when environment variables exist", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubEnv("ARTHAX_USER_ID", "user-123");

    const config = getMcpConfig();
    expect(config.supabaseUrl).toBe("https://example.supabase.co");
    expect(config.supabaseKey).toBe("test-service-key");
    expect(config.userId).toBe("user-123");
  });

  it("instantiates Supabase client from config", () => {
    const db = getMcpDb({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: "test-service-key",
      userId: "user-123",
    });
    expect(db).toBeDefined();
    expect(typeof db.from).toBe("function");
  });
});
