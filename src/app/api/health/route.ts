import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { isRedisConfigured, redis } from "@/utils/redis";
import { extractRequestId } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const startTime = Date.now();
  const requestId = extractRequestId(req);
  const checks: Record<
    string,
    { status: "healthy" | "unhealthy" | "disabled" | "configured"; latencyMs?: number; error?: string; details?: unknown }
  > = {};

  // 1. Supabase PostgreSQL Connectivity
  try {
    const dbStart = Date.now();
    const { error } = await supabaseAdmin.from("user_settings").select("id").limit(1);
    const dbLatency = Date.now() - dbStart;
    if (error) {
      checks.database = { status: "unhealthy", latencyMs: dbLatency, error: error.message };
    } else {
      checks.database = { status: "healthy", latencyMs: dbLatency };
    }
  } catch (err: unknown) {
    checks.database = {
      status: "unhealthy",
      error: err instanceof Error ? err.message : "Database connection failed",
    };
  }

  // 2. Upstash Redis Connectivity
  if (isRedisConfigured && redis) {
    try {
      const redisStart = Date.now();
      await redis.ping();
      const redisLatency = Date.now() - redisStart;
      checks.redis = { status: "healthy", latencyMs: redisLatency };
    } catch (err: unknown) {
      checks.redis = {
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Redis ping failed",
      };
    }
  } else {
    checks.redis = { status: "disabled" };
  }

  // 3. Telegram Integration Readiness
  const isTelegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  checks.telegram = {
    status: isTelegramConfigured ? "healthy" : "disabled",
    details: {
      bot_username: process.env.TELEGRAM_BOT_USERNAME || "Artha_X_bot",
      has_webhook_secret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      has_authorized_user: Boolean(process.env.TELEGRAM_AUTHORIZED_USER_ID),
    },
  };

  // 4. Gemini Generative AI Readiness
  const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  checks.geminiAi = {
    status: isGeminiConfigured ? "healthy" : "disabled",
  };

  const isAllHealthy = checks.database.status === "healthy";
  const totalDuration = Date.now() - startTime;

  return NextResponse.json(
    {
      success: isAllHealthy,
      status: isAllHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      durationMs: totalDuration,
      services: checks,
      version: "2.0.0",
      requestId,
    },
    {
      status: isAllHealthy ? 200 : 503,
      headers: {
        "X-Request-Id": requestId,
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
