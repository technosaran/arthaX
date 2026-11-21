import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { apiError, apiUnauthorized, extractRequestId } from "@/utils/apiResponse";
import { logger } from "@/utils/logger";

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

  const internalKey =
    process.env.INTERNAL_SERVICE_KEY ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  const baseUrl = getPythonServiceUrl(req);
  const targetUrl = `${baseUrl}/api/py/calculations/${subPath}${search}`;

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
