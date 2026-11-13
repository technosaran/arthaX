import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { isRedisConfigured, redis } from "@/utils/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: "healthy" | "unhealthy" | "disabled"; latencyMs?: number; error?: string }> = {};

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

  const isAllHealthy = checks.database.status === "healthy";
  const totalDuration = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isAllHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      durationMs: totalDuration,
      services: checks,
      version: "1.0.0",
    },
    { status: isAllHealthy ? 200 : 503 }
  );
}
