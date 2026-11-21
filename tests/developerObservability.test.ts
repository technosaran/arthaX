import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as calculationsGet } from "@/app/api/v1/calculations/[...path]/route";
import { GET as healthGet } from "@/app/api/health/route";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "test" }], error: null }),
    }),
  },
}));

vi.mock("@/utils/redis", () => ({
  isRedisConfigured: false,
  redis: null,
}));

describe("Developer Observability & Admin Security Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      ADMIN_API_KEY: "secure-admin-key-99999",
      CRON_SECRET: "secure-cron-secret-11111",
      PYTHON_SERVICE_URL: "http://127.0.0.1:8000",
    };
  });

  describe("GET /api/v1/calculations/validation", () => {
    it("denies access with 403 Forbidden to regular non-admin authenticated users", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: { id: "regular-user-uuid" } as any,
        userId: "regular-user-uuid",
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/v1/calculations/validation");
      const res = await calculationsGet(req, { params: Promise.resolve({ path: ["validation"] }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message || json.error).toContain("restricted to developer/admin access");
    });

    it("allows access to authorized admin using x-admin-key", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: { id: "admin-user-uuid" } as any,
        userId: "admin-user-uuid",
        error: null,
      });

      // Mock fetch to Python calculation engine
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_executed: 120,
          pass_rate_percent: 100.0,
          status: "healthy",
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/v1/calculations/validation", {
        headers: {
          "x-admin-key": "secure-admin-key-99999",
        },
      });

      const res = await calculationsGet(req, { params: Promise.resolve({ path: ["validation"] }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total_executed).toBe(120);

      global.fetch = originalFetch;
    });
  });

  describe("GET /api/v1/calculations/history", () => {
    it("scopes history query to requesting user_id for regular users", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: { id: "user-456" } as any,
        userId: "user-456",
        error: null,
      });

      const originalFetch = global.fetch;
      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          json: async () => ({ history: [] }),
        });
      });

      // Regular user tries to query without user_id or with another user's id
      const req = new NextRequest("http://localhost:3000/api/v1/calculations/history?user_id=victim-user-999");
      const res = await calculationsGet(req, { params: Promise.resolve({ path: ["history"] }) });

      expect(res.status).toBe(200);
      // Verify that effective search was forced to user-456
      expect(requestedUrl).toContain("user_id=user-456");

      global.fetch = originalFetch;
    });
  });

  describe("GET /api/health", () => {
    it("reports system health status and registered services", async () => {
      const req = new Request("http://localhost:3000/api/health");
      const res = await healthGet(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.services).toHaveProperty("database");
      expect(json.services).toHaveProperty("calculationEngine");
    });
  });
});
