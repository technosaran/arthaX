import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { rateLimit, checkAndSetIdempotency } from "@/utils/rateLimit";
import { claimDatabaseIdempotency, completeDatabaseIdempotency } from "./databaseIdempotency";
import {
  extractRequestId,
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiValidationError,
  apiRateLimited,
} from "@/utils/apiResponse";
import { logger } from "@/utils/logger";
import { constantTimeCompare } from "@/utils/crypto";
import { RouteConfig, ApiContext, AuthMode } from "./types";

const DEFAULT_BODY_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function verifyAdminOrCron(req: NextRequest, userId: string | null, mode: "admin" | "cron"): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const adminKey = process.env.ADMIN_API_KEY || cronSecret;
  const adminUserId = process.env.ADMIN_USER_ID;

  // 1. Check Bearer token or x-admin-key / x-cron-secret header
  const authHeader = req.headers.get("authorization") || "";
  const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const customHeader =
    req.headers.get("x-admin-key") ||
    req.headers.get("x-cron-secret") ||
    req.headers.get("x-api-key") ||
    "";

  const tokenToVerify = headerToken || customHeader.trim();

  if (mode === "cron") {
    // Vercel Cron header check
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    if (isVercelCron) return true;

    if (cronSecret && tokenToVerify && constantTimeCompare(tokenToVerify, cronSecret.trim())) {
      return true;
    }
    return false;
  }

  // Admin mode
  if (adminKey && tokenToVerify && constantTimeCompare(tokenToVerify, adminKey.trim())) {
    return true;
  }

  if (adminUserId && userId && constantTimeCompare(userId, adminUserId.trim())) {
    return true;
  }

  return false;
}

/**
 * Enterprise Next.js API Route Builder
 * Encapsulates authentication, rate limiting, idempotency, request body validation,
 * execution timing, logging, and unified response envelope formatting in a single call.
 */
export function createApiRoute<TBody = unknown, TParams = Record<string, string>>(
  config: RouteConfig<TBody, TParams>
) {
  const authMode: AuthMode = config.auth || "required";
  const maxBytes = config.maxBodySize || DEFAULT_BODY_MAX_BYTES;

  return async (
    req: NextRequest,
    rawRouteContext?: { params?: Promise<TParams> | TParams }
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = extractRequestId(req);
    const { pathname, searchParams } = req.nextUrl;

    // 1. Resolve Dynamic Route Params (Next.js 16 async params safe)
    let params: TParams = {} as TParams;
    if (rawRouteContext?.params) {
      params = (await Promise.resolve(rawRouteContext.params)) as TParams;
    }

    // 2. Authentication Resolution
    let user = null;
    let userId = null;

    if (authMode !== "none") {
      const authRes = await getAuthenticatedUser(req);
      user = authRes.user;
      userId = authRes.userId;

      if (authMode === "required" && (!user || !userId)) {
        return apiUnauthorized(authRes.error || "Authentication required", req);
      }

      if (authMode === "admin") {
        const isAdmin = verifyAdminOrCron(req, userId, "admin");
        if (!isAdmin) {
          logger.warn(`Unauthorized admin attempt on ${pathname}`, "SecurityGuard", {
            requestId,
            userId,
          });
          return apiForbidden("Access denied. Admin credentials required.", req);
        }
      }

      if (authMode === "cron") {
        const isCron = verifyAdminOrCron(req, userId, "cron");
        if (!isCron) {
          logger.warn(`Unauthorized cron attempt on ${pathname}`, "SecurityGuard", {
            requestId,
          });
          return apiUnauthorized("Unauthorized: Missing or invalid CRON_SECRET", req);
        }
      }
    }

    // 3. Rate Limiting Protection
    if (config.rateLimit !== false) {
      const limit = config.rateLimit?.limit ?? 60;
      const windowSec = config.rateLimit?.windowSeconds ?? 60;
      const prefix = config.rateLimit?.keyPrefix || pathname.replace(/[^a-zA-Z0-9]/g, "_");
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "anonymous";
      const rlKey = `${prefix}:${userId || clientIp}`;

      const rl = await rateLimit(rlKey, limit, windowSec);
      if (!rl.success) {
        logger.warn(`Rate limit exceeded on ${pathname}`, "RateLimiter", {
          requestId,
          userId,
          clientIp,
          limit,
        });
        return apiRateLimited("Rate limit exceeded. Please wait a moment before retrying.", req);
      }
    }

    // 4. Rate Limiting & Atomic Idempotency Check (for POST/PUT mutations)
    const idempotencyKey = req.headers.get("idempotency-key");
    if (config.idempotent && ["POST", "PUT", "PATCH"].includes(req.method)) {
      if (idempotencyKey) {
        const scope = userId || "global";
        const lockKey = `route_idemp:${scope}:${idempotencyKey.trim()}`;
        const isFirstAttempt = await checkAndSetIdempotency(lockKey, 86400); // 24hr TTL
        if (!isFirstAttempt) {
          logger.warn(`Duplicate transaction rejected via idempotency-key`, "Idempotency", {
            requestId,
            userId,
            idempotencyKey,
          });
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "CONFLICT",
                message: "Duplicate operation rejected (Idempotency conflict)",
              },
              requestId,
              timestamp: new Date().toISOString(),
            },
            { status: 409, headers: { "X-Request-Id": requestId } }
          );
        }
      }
    }

    // 5. Parse and Validate Request Body
    let body: TBody = undefined as unknown as TBody;
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
      if (contentLength > maxBytes) {
        return apiError(`Payload too large. Maximum size is ${maxBytes} bytes.`, "BAD_REQUEST", 413, undefined, req);
      }

      const contentType = req.headers.get("content-type") || "";
      const isMultipart = contentType.includes("multipart/form-data");

      if (!isMultipart) {
        try {
          const rawJson = await req.json();
          if (config.schema) {
            const parsed = config.schema.safeParse(rawJson);
            if (!parsed.success) {
              const validationDetails = parsed.error.format();
              return apiValidationError(validationDetails, "Validation failed", req);
            }
            body = parsed.data;
          } else {
            body = rawJson as TBody;
          }
        } catch {
          // If schema was required, empty/malformed json is an error
          if (config.schema) {
            return apiError("Malformed or missing JSON request body", "VALIDATION_ERROR", 400, undefined, req);
          }
          body = {} as TBody;
        }
      }
    }

    // 5b. Database-Enforced Idempotency Verification
    if (config.idempotent && idempotencyKey && ["POST", "PUT", "PATCH"].includes(req.method)) {
      const dbClaim = await claimDatabaseIdempotency(
        userId || "anonymous",
        idempotencyKey,
        `${req.method}:${pathname}`,
        body
      );

      if (dbClaim.action === "CACHED_RESPONSE" && dbClaim.cachedResponse) {
        return NextResponse.json(dbClaim.cachedResponse.body, {
          status: dbClaim.cachedResponse.status,
          headers: { "X-Request-Id": requestId, "X-Idempotent-Replay": "true" },
        });
      }

      if (!dbClaim.isFirstAttempt && (dbClaim.action === "IN_FLIGHT_CONFLICT" || dbClaim.action === "REJECTED_MISMATCH")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONFLICT",
              message: dbClaim.message || "Duplicate operation rejected (Idempotency conflict)",
            },
            requestId,
            timestamp: new Date().toISOString(),
          },
          { status: 409, headers: { "X-Request-Id": requestId } }
        );
      }
    }

    // 6. Build Type-Safe Context and Execute Handler
    const ctx: ApiContext<TBody, TParams> = {
      req,
      requestId,
      user,
      userId,
      body,
      params,
      query: searchParams,
      startTime,
    };

    try {
      const result = await config.handler(ctx);
      const durationMs = Date.now() - startTime;

      // Complete database idempotency on successful mutation
      if (config.idempotent && idempotencyKey) {
        const statusCode = result instanceof NextResponse ? result.status : 200;
        await completeDatabaseIdempotency(userId || "anonymous", idempotencyKey, statusCode, result);
      }

      // If handler returned a NextResponse directly, ensure headers and return
      if (result instanceof NextResponse) {
        result.headers.set("X-Request-Id", requestId);
        logger.info(`${req.method} ${pathname} -> ${result.status} (${durationMs}ms)`, "API", {
          requestId,
          status: result.status,
          durationMs,
        });
        return result;
      }

      // Automatically wrap raw return data in standardized apiSuccess
      logger.info(`${req.method} ${pathname} -> 200 (${durationMs}ms)`, "API", {
        requestId,
        durationMs,
      });
      return apiSuccess(result, undefined, 200, req);
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
      logger.error(`${req.method} ${pathname} failed after ${durationMs}ms: ${errorMsg}`, "API", err, {
        requestId,
        userId,
      });

      return apiError(errorMsg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
  };
}
