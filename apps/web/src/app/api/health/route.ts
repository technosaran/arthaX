import { NextResponse } from "next/server";
import { DiagnosticsService } from "@/services/diagnostics-service";

export async function GET() {
  const startTime = Date.now();
  const dbCheck = await DiagnosticsService.checkDatabase();
  const redisCheck = await DiagnosticsService.checkRedis();

  const totalDurationMs = Date.now() - startTime;
  const isHealthy = dbCheck.status === "Healthy";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs: totalDurationMs,
      services: {
        database: {
          status: dbCheck.status.toLowerCase(),
          latencyMs: parseInt(dbCheck.latency.replace("ms", "")) || 0,
        },
        redis: {
          configured: redisCheck.status !== "Offline",
          status: redisCheck.status === "Healthy" ? "healthy" : (redisCheck.status === "Offline" ? "bypassed_in_memory" : "degraded"),
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
