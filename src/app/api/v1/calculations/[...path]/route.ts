import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { apiError, apiUnauthorized, extractRequestId } from "@/utils/apiResponse";
import { logger } from "@/utils/logger";

const PYTHON_SERVICE_URL =
  process.env.PYTHON_BACKEND_URL ||
  process.env.PYTHON_SERVICE_URL ||
  "http://127.0.0.1:8000";

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

  try {
    const targetUrl = `${PYTHON_SERVICE_URL}/api/py/calculations/${subPath}${search}`;
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Request-Id": requestId,
        "X-User-Id": userId,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { success: false, error: errText || "Calculation engine error", status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    logger.warn("Calculation engine bridge error (GET)", "CalculationEngineBridge", {
      subPath,
      userId,
    }, err);
    return apiError(
      "Calculation engine unreachable or processing error",
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

  try {
    const body = await req.json().catch(() => ({}));
    // Securely enforce authenticated user_id
    body.user_id = userId;

    const targetUrl = `${PYTHON_SERVICE_URL}/api/py/calculations/${subPath}`;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-Id": requestId,
        "X-User-Id": userId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { success: false, error: errText || "Calculation engine execution error", status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    logger.warn("Calculation engine bridge error (POST)", "CalculationEngineBridge", {
      subPath,
      userId,
    }, err);
    return apiError(
      "Calculation engine execution failed",
      "SERVICE_UNAVAILABLE",
      503,
      undefined,
      req
    );
  }
}
