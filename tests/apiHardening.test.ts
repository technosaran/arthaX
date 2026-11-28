import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  isValidUuid,
  parseIntParam,
  parseMonthParam,
  getMonthBounds,
} from "@/lib/backend/queryParams";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const HOLDING_UUID = "22222222-2222-4222-8222-222222222222";
const MISSING_UUID = "33333333-3333-4333-8333-333333333333";

const state = vi.hoisted(() => ({
  bullionTxInserts: [] as Array<Record<string, unknown>>,
  bondTxInserts: [] as Array<Record<string, unknown>>,
  tableData: {} as Record<string, unknown[]>,
  deleteReturnsRow: false,
  claimDbIdempotencyResult: {
    action: "FALLBACK" as "CLAIMED" | "RECLAIMED" | "CACHED_RESPONSE" | "IN_FLIGHT_CONFLICT" | "REJECTED_MISMATCH" | "FALLBACK",
    isFirstAttempt: true,
    cachedResponse: undefined as { status: number; body: unknown } | undefined,
  },
}));

vi.mock("@/utils/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    user: { id: TEST_USER_ID, email: "test@example.com" },
    userId: TEST_USER_ID,
    error: null,
  })),
}));

vi.mock("@/utils/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  checkAndSetIdempotency: vi.fn(async () => true),
  releaseIdempotency: vi.fn(async () => undefined),
}));

vi.mock("@/utils/redis", () => ({
  getCachedData: vi.fn(async () => null),
  setCachedData: vi.fn(async () => undefined),
  invalidateCachedData: vi.fn(async () => undefined),
  getUserCacheKey: vi.fn((uid: string, key: string) => `${uid}:${key}`),
  CACHE_KEYS: {
    BONDS: "bonds",
    ANALYTICS: "analytics",
    PORTFOLIO: "portfolio",
  },
}));

vi.mock("@/lib/backend/cacheInvalidation", () => ({
  invalidateUserCaches: vi.fn(async () => undefined),
}));

vi.mock("@/lib/backend/databaseIdempotency", () => ({
  claimDatabaseIdempotency: vi.fn(async () => state.claimDbIdempotencyResult),
  completeDatabaseIdempotency: vi.fn(async () => undefined),
}));

function makeSupabaseTableBuilder(table: string) {
  let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";

  const resolveRows = () => ({
    data: state.tableData[table] ?? [],
    error: null,
  });

  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    upsert: () => {
      op = "upsert";
      return builder;
    },
    insert: (payload: Record<string, unknown>) => {
      op = "insert";
      if (table === "bullion_transactions") {
        state.bullionTxInserts.push(payload);
      } else if (table === "bond_transactions") {
        state.bondTxInserts.push(payload);
      }
      return builder;
    },
    update: () => {
      op = "update";
      return builder;
    },
    delete: () => {
      op = "delete";
      return builder;
    },
    single: async () => {
      if (op === "insert" && table === "bullion_holdings") {
        return { data: { id: HOLDING_UUID, metal: "GOLD", name: "24K Coin" }, error: null };
      }
      if (op === "insert" && table === "bond_transactions") {
        return { data: { id: "tx-1" }, error: null };
      }
      const rows = state.tableData[table] ?? [];
      if (rows.length > 0) {
        return { data: rows[0], error: null };
      }
      return { data: null, error: { message: "Not found" } };
    },
    maybeSingle: async () => {
      if (op === "delete") {
        return state.deleteReturnsRow
          ? { data: { id: HOLDING_UUID }, error: null }
          : { data: null, error: null };
      }
      const rows = state.tableData[table] ?? [];
      return { data: rows[0] ?? null, error: null };
    },
    then: (
      onFulfilled?: (val: { data: unknown[]; error: null }) => unknown,
      onRejected?: (err: unknown) => unknown
    ) => Promise.resolve(resolveRows()).then(onFulfilled, onRejected),
  };

  return builder;
}

vi.mock("@/utils/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => makeSupabaseTableBuilder(table)),
    rpc: vi.fn(async () => ({ data: { success: true }, error: null })),
  },
}));

describe("Query Param Validation Helpers", () => {
  it("parseIntParam clamps ranges and never produces NaN", () => {
    expect(parseIntParam("NaN", 50, 1, 500)).toBe(50);
    expect(parseIntParam("abc", 20, 1, 100)).toBe(20);
    expect(parseIntParam("", 20, 1, 100)).toBe(20);
    expect(parseIntParam(null, 20, 1, 100)).toBe(20);
    expect(parseIntParam("-10", 20, 1, 100)).toBe(1);
    expect(parseIntParam("9999", 20, 1, 500)).toBe(500);
    expect(parseIntParam("42", 20, 1, 100)).toBe(42);
  });

  it("parseMonthParam rejects invalid months like 2026-13 or SQL injection", () => {
    expect(parseMonthParam(null)).toEqual({ valid: true, value: null });
    expect(parseMonthParam("2026-11")).toEqual({ valid: true, value: "2026-11" });
    expect(parseMonthParam("2026-13").valid).toBe(false);
    expect(parseMonthParam("2026-00").valid).toBe(false);
    expect(parseMonthParam("2026/11").valid).toBe(false);
    expect(parseMonthParam("2026-11' OR 1=1--").valid).toBe(false);
  });

  it("getMonthBounds computes leap-year February and December rollover", () => {
    expect(getMonthBounds("2024-02")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
      nextMonthStart: "2024-03-01",
      lastDay: 29,
    });
    expect(getMonthBounds("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
      nextMonthStart: "2027-01-01",
      lastDay: 31,
    });
  });

  it("isValidUuid validates UUIDs strictly", () => {
    expect(isValidUuid(TEST_USER_ID)).toBe(true);
    expect(isValidUuid("rule-1")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid(null)).toBe(false);
  });
});

describe("API Hardening & Schema Guarantees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.bullionTxInserts = [];
    state.bondTxInserts = [];
    state.tableData = {};
    state.deleteReturnsRow = false;
    state.claimDbIdempotencyResult = {
      action: "FALLBACK",
      isFirstAttempt: true,
      cachedResponse: undefined,
    };
  });

  it("analytics GET returns 400 for malformed ?month= and keeps USD crypto separate from INR net worth", async () => {
    const { GET } = await import("@/app/api/v1/analytics/route");

    const badReq = new NextRequest("http://localhost:3000/api/v1/analytics?month=2026-13");
    const badRes = await GET(badReq);
    expect(badRes.status).toBe(400);

    state.tableData = {
      accounts: [{ id: "a1", name: "HDFC Savings", type: "Savings", classification: "asset", balance: 100000 }],
      crypto_holdings: [{ asset: "BTC", total_value_usd: 1000 }],
    };

    const goodReq = new NextRequest("http://localhost:3000/api/v1/analytics?month=2026-11&refresh=true");
    const goodRes = await GET(goodReq);
    expect(goodRes.status).toBe(200);
    const json = await goodRes.json();
    expect(json.data.portfolio.netWorth).toBe(100000);
    expect(json.data.portfolio.totalAssets).toBe(100000);
    expect(json.data.usdPortfolio).toEqual({
      cryptoUsd: 1000,
      assetsCount: 1,
      currency: "USD",
    });
  });

  it("bullion holdings POST inserts valid bullion_transactions schema columns and DELETE returns 404 when missing", async () => {
    const { POST, DELETE } = await import("@/app/api/v1/bullion/holdings/route");

    const postReq = new NextRequest("http://localhost:3000/api/v1/bullion/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metal: "GOLD",
        name: "MMTC 24K Coin",
        item_type: "COIN",
        purity: "24K",
        weight_grams: 10,
        quantity: 1,
        buy_price_per_gram: 7500,
        making_charges: 500,
        tax_gst: 225,
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);
    expect(state.bullionTxInserts).toHaveLength(1);
    const txPayload = state.bullionTxInserts[0];
    expect(txPayload.type).toBe("BUY");
    expect("transaction_type" in txPayload).toBe(false);
    expect("payment_account_id" in txPayload).toBe(false);
    expect("storage_location" in txPayload).toBe(false);

    const invalidDeleteRes = await DELETE(
      new NextRequest("http://localhost:3000/api/v1/bullion/holdings?id=not-a-uuid", {
        method: "DELETE",
      })
    );
    expect(invalidDeleteRes.status).toBe(400);

    state.deleteReturnsRow = false;
    const missingDeleteRes = await DELETE(
      new NextRequest(`http://localhost:3000/api/v1/bullion/holdings?id=${MISSING_UUID}`, {
        method: "DELETE",
      })
    );
    expect(missingDeleteRes.status).toBe(404);
  });

  it("bonds transactions POST rejects overselling BEFORE writing bond_transactions ledger row", async () => {
    state.tableData = {
      bond_holdings: [{ id: HOLDING_UUID, quantity: 2, invested_amount: 2000 }],
    };

    const { POST } = await import("@/app/api/v1/bonds/transactions/route");
    const req = new NextRequest("http://localhost:3000/api/v1/bonds/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        holding_id: HOLDING_UUID,
        type: "SELL",
        quantity: 5,
        price: 1000,
        amount: 5000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(state.bondTxInserts).toHaveLength(0);
  });

  it("routeHandler replays DB cached idempotent responses, blocks chunked oversized bodies, and rejects x-vercel-cron without CRON_SECRET", async () => {
    const { createApiRoute } = await import("@/lib/backend/routeHandler");
    const { NextResponse } = await import("next/server");

    // 1. DB CACHED_RESPONSE replay without invoking handler
    const handlerSpy = vi.fn(async () => ({ ok: true }));
    const idempotentHandler = createApiRoute({
      auth: "none",
      idempotent: true,
      handler: handlerSpy,
    });
    state.claimDbIdempotencyResult = {
      action: "CACHED_RESPONSE",
      isFirstAttempt: false,
      cachedResponse: { status: 201, body: { replayed: true } },
    };

    const replayReq = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "key-123456",
      },
      body: JSON.stringify({ amount: 100 }),
    });
    const replayRes = await idempotentHandler(replayReq);
    expect(replayRes.status).toBe(201);
    expect(replayRes.headers.get("X-Idempotent-Replay")).toBe("true");
    expect(await replayRes.json()).toEqual({ replayed: true });
    expect(handlerSpy).not.toHaveBeenCalled();

    // 2. Chunked/omitted content-length exceeding maxBodySize returns 413
    const limitedHandler = createApiRoute({
      auth: "none",
      maxBodySize: 32,
      handler: async () => NextResponse.json({ ok: true }),
    });
    const largeReq = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(120) }),
    });
    const largeRes = await limitedHandler(largeReq);
    expect(largeRes.status).toBe(413);

    // 3. Spoofed x-vercel-cron without Authorization Bearer CRON_SECRET is rejected
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "super-secret-cron-token-123456";
    try {
      const cronHandler = createApiRoute({
        auth: "cron",
        handler: async () => ({ ran: true }),
      });
      const spoofedReq = new NextRequest("http://localhost:3000/api/cron", {
        method: "GET",
        headers: { "x-vercel-cron": "1" },
      });
      const spoofedRes = await cronHandler(spoofedReq);
      expect(spoofedRes.status).toBe(401);
    } finally {
      if (prevSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = prevSecret;
      }
    }
  });
});
