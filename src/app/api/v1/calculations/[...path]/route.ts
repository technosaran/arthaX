import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { apiError, apiUnauthorized, apiForbidden, extractRequestId } from "@/utils/apiResponse";
import { logger } from "@/utils/logger";
import { constantTimeCompare } from "@/utils/crypto";

function isDeveloperOrAdmin(req: NextRequest, userId: string): boolean {
  const adminKey = process.env.ADMIN_API_KEY || process.env.CRON_SECRET;
  const headerKey =
    req.headers.get("x-admin-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (adminKey && headerKey && constantTimeCompare(headerKey.trim(), adminKey.trim())) {
    return true;
  }

  const adminUserId = process.env.ADMIN_USER_ID;
  if (adminUserId && userId === adminUserId) {
    return true;
  }

  return false;
}

function getPythonServiceUrl(req: NextRequest): string {
  if (process.env.PYTHON_BACKEND_URL) return process.env.PYTHON_BACKEND_URL;
  if (process.env.PYTHON_SERVICE_URL) return process.env.PYTHON_SERVICE_URL;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return req.nextUrl.origin;
  }
  return "http://127.0.0.1:8000";
}

function formatEngineResponse(data: any) {
  const isWrapped = data && typeof data === "object" && data.data && typeof data.data === "object";
  return {
    success: true,
    ...data,
    ...(isWrapped ? data.data : {}),
    ...(data?.metadata && typeof data.metadata === "object"
      ? {
          execution_time_ms: data.metadata.execution_time_ms,
          calculation_version: data.metadata.version,
        }
      : {}),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { path } = await context.params;
  const subPath = path ? path.join("/") : "";
  const { search } = new URL(req.url);

  // 1. Restrict global calculation metrics to authorized developer/admin access
  if (subPath === "validation") {
    if (!isDeveloperOrAdmin(req, userId)) {
      return apiForbidden("Access denied. Global calculation metrics are restricted to developer/admin access.", req);
    }
  }

  // 2. Restrict calculation history strictly to the authenticated user unless developer/admin
  let effectiveSearch = search;
  if (subPath === "history") {
    if (!isDeveloperOrAdmin(req, userId)) {
      const sp = new URLSearchParams(search);
      sp.set("user_id", userId);
      effectiveSearch = `?${sp.toString()}`;
    }
  }

  const internalKey =
    process.env.INTERNAL_SERVICE_KEY ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  const baseUrl = getPythonServiceUrl(req);
  const targetUrl = `${baseUrl}/api/py/calculations/${subPath}${effectiveSearch}`;

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Request-Id": requestId,
        "X-User-Id": userId,
        ...(internalKey ? { "X-Internal-Service-Key": internalKey } : {}),
      },
    });

    if (!res.ok) {
      let errDetail = "Calculation engine error";
      try {
        const text = await res.text();
        const json = JSON.parse(text);
        errDetail = json.detail || json.error || text;
      } catch {
        // use default
      }
      return NextResponse.json(
        { success: false, error: errDetail, status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(formatEngineResponse(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn("Calculation engine bridge error (GET)", "CalculationEngineBridge", {
      subPath,
      userId,
      error: errMsg,
    }, err);
    return apiError(
      `Calculation engine unreachable at ${baseUrl}. Ensure the Python analytics microservice is running.`,
      "SERVICE_UNAVAILABLE",
      503,
      undefined,
      req
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const requestId = extractRequestId(req);
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return apiUnauthorized(authError || "Unauthorized", req);
  }

  const { path } = await context.params;
  const subPath = path ? path.join("/") : "";

  const baseUrl = getPythonServiceUrl(req);
  const targetUrl = `${baseUrl}/api/py/calculations/${subPath}`;

  try {
    const body = await req.json().catch(() => ({}));
    // Securely enforce authenticated user_id
    body.user_id = userId;

    const internalKey =
      process.env.INTERNAL_SERVICE_KEY ||
      process.env.CRON_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "";

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-Id": requestId,
        "X-User-Id": userId,
        ...(internalKey ? { "X-Internal-Service-Key": internalKey } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errDetail = "Calculation engine execution error";
      try {
        const text = await res.text();
        const json = JSON.parse(text);
        errDetail = json.detail || json.error || text;
      } catch {
        // use default
      }
      return NextResponse.json(
        { success: false, error: errDetail, status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(formatEngineResponse(data));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn("Calculation engine bridge error (POST)", "CalculationEngineBridge", {
      subPath,
      userId,
      error: errMsg,
    }, err);
    return apiError(
      `Calculation engine unreachable at ${baseUrl}. Ensure the Python analytics microservice is running.`,
      "SERVICE_UNAVAILABLE",
      503,
      undefined,
      req
    );
  }
}
