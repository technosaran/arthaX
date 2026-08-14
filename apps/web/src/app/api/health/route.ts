import { NextResponse } from "next/server";
import { isRedisHealthy, isRedisConfigured } from "@/lib/redis";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "unknown";
  let dbLatencyMs = 0;

  try {
    const supabase = await createClient();
    const dbStart = Date.now();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = error ? "degraded" : "healthy";
  } catch {
    dbStatus = "unhealthy";
  }

  const redisConfigured = isRedisConfigured();
  const redisHealthy = isRedisHealthy();

  const totalDurationMs = Date.now() - startTime;
  const isHealthy = dbStatus === "healthy";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs: totalDurationMs,
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        redis: {
          configured: redisConfigured,
          status: redisHealthy ? "healthy" : (redisConfigured ? "degraded" : "bypassed_in_memory"),
        },
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
