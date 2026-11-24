import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, OPTIONS } from "../../src/app/api/v1/mcp/route";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

import { getAuthenticatedUser } from "@/utils/auth";

describe("Remote MCP HTTP API Route (/api/v1/mcp)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("rejects unauthorized POST requests with 401 and JSON-RPC error", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: null,
      userId: null,
      error: "No authorization header",
    });

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
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe(-32000);
  });

  it("processes tools/list successfully when authenticated via standard Bearer token", async () => {
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
    expect(json.result).toHaveProperty("tools");
    const names = json.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("get_net_worth");
    expect(names).toContain("list_accounts");
    expect(names).toContain("record_expense");
  });

  it("authenticates via static API key in Authorization header (arthax_mcp_live_token)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer arthax_mcp_live_token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-key-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.id).toBe("req-key-1");
  });

  it("authenticates via x-api-key header", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "arthax_mcp_live_token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-x-api-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.id).toBe("req-x-api-1");
  });

  it("authenticates via query parameter ?apiKey=arthax_mcp_live_token", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/mcp?apiKey=arthax_mcp_live_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-query-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.id).toBe("req-query-1");
  });

  it("authenticates directly with a valid User UUID", async () => {
    const testUuid = "640cb47d-abe8-4182-85d5-347f5ccd4aa2";
    const req = new NextRequest("http://localhost:3000/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUuid}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-uuid-1",
        method: "tools/list",
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.id).toBe("req-uuid-1");
  });
});
