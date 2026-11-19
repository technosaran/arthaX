import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "../src/app/api/v1/integrations/zerodha/cron/route";
import { NextRequest } from "next/server";

describe("Zerodha Scheduled Cron API Endpoint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = "super-secret-cron-token-12345";
    (process.env as Record<string, string>).NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("handles GET requests from Vercel Crons with Bearer CRON_SECRET", async () => {
    const req = new NextRequest("https://arthax.vercel.app/api/v1/integrations/zerodha/cron", {
      method: "GET",
      headers: {
        Authorization: "Bearer super-secret-cron-token-12345",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("results");
  });

  it("handles POST requests from external cron runners with Bearer CRON_SECRET", async () => {
    const req = new NextRequest("https://arthax.vercel.app/api/v1/integrations/zerodha/cron", {
      method: "POST",
      headers: {
        Authorization: "Bearer super-secret-cron-token-12345",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("results");
  });

  it("rejects unauthorized cron triggers with 401 when CRON_SECRET does not match", async () => {
    // Override NODE_ENV and VITEST to test authentication logic
    (process.env as Record<string, string>).NODE_ENV = "production";
    delete (process.env as any).VITEST;

    const req = new NextRequest("https://arthax.vercel.app/api/v1/integrations/zerodha/cron", {
      method: "GET",
      headers: {
        Authorization: "Bearer wrong-secret",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});
