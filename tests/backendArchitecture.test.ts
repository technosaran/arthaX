import { describe, it, expect } from "vitest";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiValidationError,
  apiForbidden,
  extractRequestId,
} from "@/utils/apiResponse";
import { rateLimit, checkAndSetIdempotency } from "@/utils/rateLimit";

describe("Advanced Backend Architecture Suite", () => {
  describe("API Response Formatting & Correlation IDs", () => {
    it("generates a unique request ID if not provided in headers", () => {
      const id1 = extractRequestId();
      const id2 = extractRequestId();
      expect(id1).toMatch(/^req_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^req_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it("preserves incoming X-Request-Id header", () => {
      const req = new Request("https://arthax.vercel.app/api/health", {
        headers: { "x-request-id": "client-trace-12345" },
      });
      const extracted = extractRequestId(req);
      expect(extracted).toBe("client-trace-12345");
    });

    it("creates a standardized successful API response", async () => {
      const data = { user: "Saran", netWorth: 150000 };
      const meta = { page: 1, limit: 10, total: 1 };
      const res = apiSuccess(data, meta, 200);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      expect(res.headers.get("X-Request-Id")).toBeTruthy();

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.meta).toEqual(meta);
      expect(body.timestamp).toBeTruthy();
      expect(body.requestId).toBeTruthy();
    });

    it("creates a standardized error API response with error code", async () => {
      const res = apiError("Invalid database credentials", "INTERNAL_SERVER_ERROR", 500);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(body.error.message).toBe("Invalid database credentials");
    });

    it("formats specialized 401 unauthorized response", async () => {
      const res = apiUnauthorized("Missing session token");
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toBe("Missing session token");
    });

    it("formats specialized 422 validation error with schema details", async () => {
      const details = { amount: ["Amount must be greater than 0"] };
      const res = apiValidationError(details, "Validation failed");
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toEqual(details);
    });
  });

  describe("Distributed Rate Limiter & Abuse Prevention", () => {
    it("allows requests within configured threshold", async () => {
      const testKey = `test_limit_${Date.now()}`;
      const r1 = await rateLimit(testKey, 5, 10);
      expect(r1.success).toBe(true);
      expect(r1.remaining).toBe(4);

      const r2 = await rateLimit(testKey, 5, 10);
      expect(r2.success).toBe(true);
      expect(r2.remaining).toBe(3);
    });

    it("blocks requests once limit is exceeded", async () => {
      const testKey = `test_exceed_${Date.now()}`;
      for (let i = 0; i < 3; i++) {
        const res = await rateLimit(testKey, 3, 10);
        expect(res.success).toBe(true);
      }

      // 4th request must be blocked
      const blocked = await rateLimit(testKey, 3, 10);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  describe("Atomic Idempotency Engine", () => {
    it("accepts first execution and rejects duplicate replay within TTL", async () => {
      const idempotencyKey = `idemp_test_${Date.now()}_abc`;

      // 1st attempt: Should succeed
      const firstAttempt = await checkAndSetIdempotency(idempotencyKey, 60);
      expect(firstAttempt).toBe(true);

      // 2nd attempt with same key: Must be rejected as duplicate
      const duplicateAttempt = await checkAndSetIdempotency(idempotencyKey, 60);
      expect(duplicateAttempt).toBe(false);
    });
  });
});
