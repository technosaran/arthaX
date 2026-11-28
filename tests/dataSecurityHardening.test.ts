import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { encryptSensitiveData, decryptSensitiveData } from "@/utils/crypto";
import { getTrustedOrigin } from "@/utils/oauthSecurity";
import { verifyTelegramSecret, extractTelegramLinkCandidate, normalizeLinkTokenCandidates } from "@/utils/telegram";
import { apiSuccess, extractRequestId } from "@/utils/apiResponse";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const HOLDING_ID = "22222222-2222-4222-8222-222222222222";

const eqHistory = vi.hoisted(() => [] as Array<{ table: string; op: string; col: string; val: unknown }>);

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    user: { id: TEST_USER_ID },
    userId: TEST_USER_ID,
    error: null,
  })),
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  checkAndSetIdempotency: vi.fn(async () => true),
  releaseIdempotency: vi.fn(async () => undefined),
}));

vi.mock("@/lib/backend/cacheInvalidation", () => ({
  invalidateUserCaches: vi.fn(async () => undefined),
}));

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      let currentOp = "select";
      const recordEq = (col: string, val: unknown) => {
        eqHistory.push({ table, op: currentOp, col, val });
      };
      const builder = {
        select: () => builder,
        insert: () => {
          currentOp = "insert";
          return builder;
        },
        update: () => {
          currentOp = "update";
          return builder;
        },
        delete: () => {
          currentOp = "delete";
          return builder;
        },
        eq: (col: string, val: unknown) => {
          recordEq(col, val);
          return builder;
        },
        single: async () => {
          if (table === "bullion_holdings") {
            return {
              data: {
                id: HOLDING_ID,
                user_id: TEST_USER_ID,
                name: "24K Coin",
                weight_grams: 10,
                quantity: 1,
                total_buy_price: 75000,
              },
              error: null,
            };
          }
          if (table === "bullion_transactions") {
            return { data: { id: "tx-1" }, error: null };
          }
          return { data: null, error: null };
        },
        then: (
          onFulfilled?: (val: { data: unknown; error: null }) => unknown,
          onRejected?: (err: unknown) => unknown
        ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      };
      return builder;
    }),
  },
}));

describe("Data Security & Multi-Tenant Isolation Hardening", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    eqHistory.length = 0;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.unstubAllGlobals();
  });

  it("crypto fail-closes decryption in production when ENCRYPTION_MASTER_KEY is missing (no service-role fallback)", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-that-must-not-decrypt-in-prod";
    const legacyCipher = encryptSensitiveData("sensitive-bank-password", "statement-passwords");
    expect(legacyCipher).toMatch(/^enc:v1:/);

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.ENCRYPTION_MASTER_KEY;

    expect(() => decryptSensitiveData(legacyCipher, "statement-passwords")).toThrow(
      /ENCRYPTION_MASTER_KEY is not configured in production/
    );
  });

  it("getTrustedOrigin and auth callback block Host Header Poisoning and backslash open redirects", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const poisonedReq = new Request("https://arthax.vercel.app/auth/callback?error=access_denied&next=/\\evil.com", {
      headers: {
        "x-forwarded-host": "evil.attacker.com",
        "x-forwarded-proto": "javascript:",
      },
    });
    expect(getTrustedOrigin(poisonedReq)).toBe("https://arthax.vercel.app");

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(poisonedReq);
    expect(res.status).toBe(307);
    const location = res.headers.get("location") || "";
    expect(location.startsWith("https://arthax.vercel.app/login?error=")).toBe(true);
    expect(location).not.toContain("evil.attacker.com");
    expect(location).not.toContain("evil.com");
  });

  it("calculations proxy rejects path traversal and never leaks SUPABASE_SERVICE_ROLE_KEY over HTTP", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    delete process.env.INTERNAL_SERVICE_KEY;
    delete process.env.CRON_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "super-secret-db-service-role-key";

    const { GET } = await import("@/app/api/v1/calculations/[...path]/route");

    const traversalRes = await GET(new NextRequest("http://localhost:3000/api/v1/calculations/../../secrets"), {
      params: Promise.resolve({ path: ["..", "secrets"] }),
    });
    expect(traversalRes.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();

    const validRes = await GET(new NextRequest("http://localhost:3000/api/v1/calculations/networth"), {
      params: Promise.resolve({ path: ["networth"] }),
    });
    expect(validRes.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callHeaders = ((fetchSpy.mock.calls as unknown[][])[0]?.[1] as { headers?: Record<string, string> } | undefined)?.headers;
    expect(callHeaders?.["X-Internal-Service-Key"]).toBeUndefined();
    expect(JSON.stringify(callHeaders)).not.toContain("super-secret-db-service-role-key");
  });

  it("bullion transactions scopes holding delete and update strictly by user_id", async () => {
    const { POST } = await import("@/app/api/v1/bullion/transactions/route");

    const sellAllReq = new NextRequest("http://localhost:3000/api/v1/bullion/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        holding_id: HOLDING_ID,
        metal: "GOLD",
        type: "SELL",
        weight_grams: 10,
        price_per_gram: 7800,
      }),
    });

    const sellRes = await POST(sellAllReq);
    expect(sellRes.status).toBe(201);
    expect(
      eqHistory.some((e) => e.table === "bullion_holdings" && e.op === "delete" && e.col === "user_id" && e.val === TEST_USER_ID)
    ).toBe(true);

    eqHistory.length = 0;
    const buyMoreReq = new NextRequest("http://localhost:3000/api/v1/bullion/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        holding_id: HOLDING_ID,
        metal: "GOLD",
        type: "BUY",
        weight_grams: 5,
        price_per_gram: 7800,
      }),
    });

    const buyRes = await POST(buyMoreReq);
    expect(buyRes.status).toBe(201);
    expect(
      eqHistory.some((e) => e.table === "bullion_holdings" && e.op === "update" && e.col === "user_id" && e.val === TEST_USER_ID)
    ).toBe(true);
  });

  it("webhooks fail closed when deployed without secrets and support high-entropy Telegram link tokens", async () => {
    process.env.VERCEL_ENV = "preview";
    expect(verifyTelegramSecret("anything", "")).toBe(false);

    expect(extractTelegramLinkCandidate("/link AX-1234ABCD5678")).toBe("AX-1234ABCD5678");
    const candidates = normalizeLinkTokenCandidates("ax-1234abcd5678");
    expect(candidates).toContain("AX-1234ABCD5678");
    expect(candidates).toContain("1234ABCD5678");

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.VITEST;
    delete process.env.WHATSAPP_APP_SECRET;

    const { POST: whatsappPost } = await import("@/app/api/webhooks/whatsapp/route");
    const waRes = await whatsappPost(
      new NextRequest("https://arthax.vercel.app/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Dinner 500 HDFC", user_id: TEST_USER_ID }),
      })
    );
    expect(waRes.status).toBe(500);
  });

  it("apiResponse sanitizes X-Request-Id against header/log injection and prevents proxy caching", () => {
    const poisonedReq = {
      headers: {
        get: (name: string) => (name === "x-request-id" ? "bad\r\ninjected header" : null),
      },
    } as unknown as NextRequest;
    const reqId = extractRequestId(poisonedReq);
    expect(reqId).toMatch(/^req_[a-f0-9]{16}$/);

    const res = apiSuccess({ ok: true }, undefined, 200, poisonedReq);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Pragma")).toBe("no-cache");
  });
});
