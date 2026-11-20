import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getStatements } from "@/app/api/v1/statements/route";
import { POST as uploadStatement } from "@/app/api/v1/statements/upload/route";
import { GET as getAutomationStatus } from "@/app/api/v1/automation/status/route";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "test-stmt-id" }, error: null }),
    }),
  },
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Statements & Automation API Route Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/v1/statements", () => {
    it("returns 401 when user is unauthenticated", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: null,
        userId: null,
        error: "Unauthorized",
      });

      const req = new NextRequest("http://localhost:3000/api/v1/statements");
      const res = await getStatements(req);
      expect(res.status).toBe(401);
    });

    it("returns statement records when authenticated", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        userId: "user-123",
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/v1/statements");
      const res = await getStatements(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.statements)).toBe(true);
    });
  });

  describe("POST /api/v1/statements/upload", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: null,
        userId: null,
        error: "Unauthorized",
      });

      const req = new NextRequest("http://localhost:3000/api/v1/statements/upload", {
        method: "POST",
      });
      const res = await uploadStatement(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when no file is uploaded", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        userId: "user-123",
        error: null,
      });

      const formData = new FormData();
      const req = new NextRequest("http://localhost:3000/api/v1/statements/upload", {
        method: "POST",
        body: formData,
      });

      const res = await uploadStatement(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error?.message || json.error).toContain("No file provided");
    });
  });

  describe("GET /api/v1/automation/status", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: null,
        userId: null,
        error: "Unauthorized",
      });

      const req = new NextRequest("http://localhost:3000/api/v1/automation/status");
      const res = await getAutomationStatus(req);
      expect(res.status).toBe(401);
    });

    it("returns comprehensive automation telemetry when authenticated", async () => {
      const { getAuthenticatedUser } = await import("@/utils/auth");
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
        user: { id: "user-123" } as any,
        userId: "user-123",
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/v1/automation/status");
      const res = await getAutomationStatus(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.automation).toBeDefined();
      expect(json.automation.gmail).toBeDefined();
      expect(json.automation.statements).toBeDefined();
      expect(json.automation.transactions).toBeDefined();
      expect(json.automation.zerodha).toBeDefined();
    });
  });
});
