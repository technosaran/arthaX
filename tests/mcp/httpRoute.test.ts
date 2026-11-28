import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, OPTIONS } from "../../src/app/api/v1/mcp/route";
import { createPersonalMcpToken, verifyPersonalMcpToken } from "../../src/utils/mcpAuth";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

import { getAuthenticatedUser } from "@/utils/auth";

describe("Remote MCP HTTP API Route (/api/v1/mcp)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      user: null,
      userId: null,
      error: "Unauthorized",
    });
  });

  it("handles OPTIONS request with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("x-api-key");
  });

  it("handles GET request returning server status and capabilities", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("online");
    expect(json.endpoint).toBe("/api/v1/mcp");
    expect(json.authenticated).toBe(false);
  });

  it("rejects unauthorized POST requests with 401 and JSON-RPC error", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe(-32000);
  });

  it("rejects hardcoded legacy static token (arthax_mcp_live_token)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer arthax_mcp_live_token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "legacy-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects bare user UUIDs sent as Bearer tokens", async () => {
    const testUuid = "640cb47d-abe8-4182-85d5-347f5ccd4aa2";
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUuid}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "uuid-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects query-string apiKey authentication", async () => {
    vi.stubEnv("MCP_API_KEY", "super-secret-env-mcp-key");
    vi.stubEnv("SHORTCUTS_AUTHORIZED_USER_ID", "640cb47d-abe8-4182-85d5-347f5ccd4aa2");

    const req = new NextRequest("http://localhost:3000/api/v1/mcp?apiKey=super-secret-env-mcp-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "qs-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects tampered or expired personal MCP tokens", async () => {
    const valid = createPersonalMcpToken("640cb47d-abe8-4182-85d5-347f5ccd4aa2");
    const tampered = `${valid.slice(0, -4)}zzzz`;
    expect(verifyPersonalMcpToken(tampered)).toBeNull();

    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tampered}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tampered-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("authenticates via signed personal MCP token (ax_mcp_...)", async () => {
    const token = createPersonalMcpToken("640cb47d-abe8-4182-85d5-347f5ccd4aa2");
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "personal-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.id).toBe("personal-1");
  });

  it("processes tools/list successfully when authenticated via verified Supabase JWT", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: "user-test-uuid" } as unknown as import("@supabase/supabase-js").User,
      userId: "user-test-uuid",
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-user-jwt-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("result");
    const names = json.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("get_net_worth");
    expect(names).toContain("list_accounts");
    expect(names).toContain("record_expense");
  });

  it("authenticates via configured environment MCP_API_KEY header", async () => {
    vi.stubEnv("MCP_API_KEY", "env-configured-mcp-key-xyz");
    vi.stubEnv("SHORTCUTS_AUTHORIZED_USER_ID", "640cb47d-abe8-4182-85d5-347f5ccd4aa2");

    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "env-configured-mcp-key-xyz",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-env-key-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.id).toBe("req-env-key-1");
  });

  it("handles concurrent JSON-RPC batch calls cleanly without ID cross-contamination", async () => {
    const token = createPersonalMcpToken("640cb47d-abe8-4182-85d5-347f5ccd4aa2");
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: "batch-tools", method: "tools/list", params: {} },
        { jsonrpc: "2.0", id: "batch-prompts", method: "prompts/list", params: {} },
      ]),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(2);
    const byId = new Map(json.map((item: { id: string; result?: unknown }) => [item.id, item]));
    expect((byId.get("batch-tools") as { result?: { tools?: unknown[] } })?.result?.tools).toBeDefined();
    expect((byId.get("batch-prompts") as { result?: { prompts?: unknown[] } })?.result?.prompts).toBeDefined();
  });
});
