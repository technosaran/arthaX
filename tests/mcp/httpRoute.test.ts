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
  });

  it("handles GET request returning server status and capabilities", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("online");
    expect(json.endpoint).toBe("/api/v1/mcp");
  });

  it("rejects unauthorized POST requests with 401 and JSON-RPC error", async () => {
    (getAuthenticatedUser as any).mockResolvedValueOnce({
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

  it("processes tools/list successfully when authenticated", async () => {
    (getAuthenticatedUser as any).mockResolvedValueOnce({
      user: { id: "user-test-uuid" },
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
    const names = json.result.tools.map((t: any) => t.name);
    expect(names).toContain("get_net_worth");
    expect(names).toContain("list_accounts");
    expect(names).toContain("record_expense");
  });
});
