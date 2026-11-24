import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { apiError, apiUnauthorized, apiForbidden, extractRequestId } from "@/utils/apiResponse";
import { logger } from "@/utils/logger";
import { constantTimeCompare } from "@/utils/crypto";
import {
  executeNetWorthTS,
  executeTaxRegimesTS,
} from "@/lib/engine/embeddedEngine";

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

function formatEngineResponse(data: Record<string, unknown> | null | undefined) {
  const isWrapped = data && typeof data === "object" && data.data && typeof data.data === "object";
  const meta = data?.metadata as Record<string, unknown> | undefined;
  return {
    success: true,
    ...(data || {}),
    ...(isWrapped ? (data!.data as Record<string, unknown>) : {}),
    ...(meta && typeof meta === "object"
      ? {
          execution_time_ms: meta.execution_time_ms,
          calculation_version: meta.version,
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
    logger.warn("Calculation engine bridge error (GET), evaluating embedded fallback", "CalculationEngineBridge", {
      subPath,
      userId,
      error: errMsg,
    }, err);

    if (subPath === "health") {
      return NextResponse.json({
        status: "healthy",
        engine: "ArthaX Financial Calculation Engine (AFCE - TypeScript Embedded Fallback)",
        version: "2.0.0",
        precision_engine: "TypeScript Integer-Paise Precision",
        active_modules: [
          "ExpenseEngine",
          "IncomeEngine",
          "BudgetEngine",
          "NetWorthEngine",
          "InvestmentEngine",
          "PortfolioEngine",
          "ReconciliationEngine",
          "TaxEngine",
        ],
        _engine: "ts_embedded_fallback",
      }, { headers: { "X-Request-Id": requestId } });
    }

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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {}

  try {
    // Securely enforce authenticated user_id
    body.user_id = userId;

    const internalKey =
      process.env.INTERNAL_SERVICE_KEY ||
      process.env.CRON_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "";

    // Fast 2500ms timeout for Python service so UI never hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(targetUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-Id": requestId,
        "X-User-Id": userId,
        ...(internalKey ? { "X-Internal-Service-Key": internalKey } : {}),
      },
      body: JSON.stringify(body),
    });
    clearTimeout(timeoutId);

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
    logger.warn("Calculation engine bridge error (POST), activating embedded TS fallback", "CalculationEngineBridge", {
      subPath,
      userId,
      error: errMsg,
    }, err);

    // High-resilience embedded TypeScript calculation fallback
    if (subPath === "networth") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = executeNetWorthTS(body as any);
      return NextResponse.json(formatEngineResponse({ success: true, result, ...result, _engine: "ts_embedded_fallback" }), {
        headers: { "X-Request-Id": requestId },
      });
    }

    if (subPath === "tax/regimes") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = executeTaxRegimesTS(body as any);
      return NextResponse.json(formatEngineResponse({ success: true, result, ...result, _engine: "ts_embedded_fallback" }), {
        headers: { "X-Request-Id": requestId },
      });
    }

    return apiError(
      `Calculation engine unreachable at ${baseUrl}. Ensure the Python analytics microservice is running.`,
      "SERVICE_UNAVAILABLE",
      503,
      undefined,
      req
    );
  }
}
