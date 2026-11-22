import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createApiRoute } from "@/lib/backend/routeHandler";
import { z } from "zod";

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 59, reset: 12345 }),
  checkAndSetIdempotency: vi.fn().mockResolvedValue(true),
}));

import { getAuthenticatedUser } from "@/utils/auth";
import { rateLimit, checkAndSetIdempotency } from "@/utils/rateLimit";

describe("Enterprise Route Handler Middleware Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks unauthenticated requests when auth is required", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: null,
      userId: null,
      error: "No active session",
    });

    const route = createApiRoute({
      auth: "required",
      handler: async () => ({ message: "secret" }),
    });

    const req = new NextRequest("http://localhost:3000/api/v1/test");
    const res = await route(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("executes handler and wraps response when authenticated", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: "user_123", email: "test@example.com" } as any,
      userId: "user_123",
      error: null,
    });

    const route = createApiRoute({
      auth: "required",
      handler: async (ctx) => {
        expect(ctx.userId).toBe("user_123");
        return { message: "hello world", count: 42 };
      },
    });

    const req = new NextRequest("http://localhost:3000/api/v1/test");
    const res = await route(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ message: "hello world", count: 42 });
    expect(body.message).toBe("hello world"); // top-level backward compatibility check
  });

  it("validates request body with Zod schema and returns 422 on error", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    const schema = z.object({
      symbol: z.string().min(1),
      quantity: z.number().positive(),
    });

    const route = createApiRoute({
      auth: "required",
      schema,
      handler: async (ctx) => ctx.body,
    });

    // Send invalid body (quantity is negative)
    const req = new NextRequest("http://localhost:3000/api/v1/test", {
      method: "POST",
      body: JSON.stringify({ symbol: "TCS", quantity: -10 }),
    });

    const res = await route(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.quantity).toBeTruthy();
  });

  it("handles rate limiting properly and returns 429", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      limit: 60,
      reset: 12345,
    });

    const route = createApiRoute({
      rateLimit: { limit: 10, windowSeconds: 60 },
      handler: async () => ({ ok: true }),
    });

    const req = new NextRequest("http://localhost:3000/api/v1/test");
    const res = await route(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("enforces idempotency on duplicate replay", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({
      user: { id: "user_123" } as any,
      userId: "user_123",
      error: null,
    });

    vi.mocked(checkAndSetIdempotency).mockResolvedValueOnce(false); // Second attempt

    const route = createApiRoute({
      idempotent: true,
      handler: async () => ({ ok: true }),
    });

    const req = new NextRequest("http://localhost:3000/api/v1/test", {
      method: "POST",
      headers: { "idempotency-key": "replay_key_abc" },
      body: JSON.stringify({ test: 1 }),
    });

    const res = await route(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
  });
});
