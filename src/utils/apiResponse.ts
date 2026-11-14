import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { logger } from "@/utils/logger";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
  requestId: string;
  timestamp: string;
}

/**
 * Extracts or generates a unique correlation Request ID.
 */
export function extractRequestId(req?: Request | NextRequest): string {
  if (!req) return `req_${crypto.randomBytes(8).toString("hex")}`;
  const incomingId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    req.headers.get("cf-ray");
  if (incomingId) return incomingId;
  return `req_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Standardized Success Response builder
 */
export function apiSuccess<T>(
  data: T,
  meta?: ApiResponse["meta"],
  status: number = 200,
  req?: Request | NextRequest
): NextResponse<ApiResponse<T>> {
  const requestId = extractRequestId(req);
  const payload: ApiResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    requestId,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status,
    headers: {
      "X-Request-Id": requestId,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Standardized Error Response builder
 */
export function apiError(
  message: string,
  code: ApiErrorCode = "INTERNAL_SERVER_ERROR",
  status: number = 500,
  details?: unknown,
  req?: Request | NextRequest
): NextResponse<ApiResponse<null>> {
  const requestId = extractRequestId(req);
  const payload: ApiResponse<null> = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    requestId,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status,
    headers: {
      "X-Request-Id": requestId,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Specialized Shortcut Error Helpers
 */
export const apiUnauthorized = (msg: string = "Unauthorized", req?: Request) =>
  apiError(msg, "UNAUTHORIZED", 401, undefined, req);

export const apiForbidden = (msg: string = "Access forbidden", req?: Request) =>
  apiError(msg, "FORBIDDEN", 403, undefined, req);

export const apiNotFound = (msg: string = "Resource not found", req?: Request) =>
  apiError(msg, "NOT_FOUND", 404, undefined, req);

export const apiValidationError = (details: unknown, msg: string = "Validation failed", req?: Request) =>
  apiError(msg, "VALIDATION_ERROR", 422, details, req);

export const apiRateLimited = (msg: string = "Rate limit exceeded. Please try again shortly.", req?: Request) =>
  apiError(msg, "RATE_LIMITED", 429, undefined, req);

/**
 * Higher-order wrapper for route handlers that guarantees correlation IDs and safe exception catching.
 */
export function withApiHandler<T = unknown>(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse<ApiResponse<T>> | NextResponse>
) {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    const requestId = extractRequestId(req);
    const start = Date.now();
    try {
      const response = await handler(req, ctx);
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.nextUrl.pathname} -> ${response.status} (${duration}ms)`, "API", {
        requestId,
        path: req.nextUrl.pathname,
        status: response.status,
      });
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
      logger.error(`${req.method} ${req.nextUrl.pathname} failed after ${duration}ms: ${errorMsg}`, "API", err, {
        requestId,
        path: req.nextUrl.pathname,
      });

      return apiError(errorMsg, "INTERNAL_SERVER_ERROR", 500, undefined, req);
    }
  };
}
