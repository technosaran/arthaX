import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE"
  | (string & {});

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
  const trimmed = incomingId?.trim();
  if (trimmed && /^[a-zA-Z0-9_.:-]{1,64}$/.test(trimmed)) return trimmed;
  return `req_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Standardized Success Response builder
 */
export function apiSuccess<T>(
  data: T,
  meta?: ApiResponse["meta"],
  statusOrReq?: number | Request | NextRequest,
  req?: Request | NextRequest
): NextResponse<ApiResponse<T>> {
  const status = typeof statusOrReq === "number" ? statusOrReq : 200;
  const effectiveReq = (statusOrReq && typeof statusOrReq === "object" ? statusOrReq : req) as
    | Request
    | NextRequest
    | undefined;
  const requestId = extractRequestId(effectiveReq);
  
  // Backward compatibility: If data is a non-null plain object and not an array,
  // shallow-merge its properties into the top level of the response payload
  // so that legacy components expecting json.holdings or json.stats directly
  // continue to function seamlessly alongside modern json.data consumers.
  const objectPayload =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  const payload: ApiResponse<T> & Record<string, unknown> = {
    ...objectPayload,
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
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
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
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
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
