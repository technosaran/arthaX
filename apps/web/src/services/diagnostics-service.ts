import { createClient } from "@/lib/supabase-server";
import { isRedisHealthy, isRedisConfigured } from "@/lib/redis";
import { EXTERNAL_APIS, probeExternalApi, ApiHealthResult } from "@/lib/external-apis";

export class DiagnosticsService {
  static async checkDatabase(): Promise<ApiHealthResult> {
    const start = Date.now();
    try {
      const supabase = await createClient();
      // Use profiles as it's a small table
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const latency = Date.now() - start;
      if (error) {
        return { name: "Supabase DB Connection", status: "Degraded", latency: `${latency}ms`, code: 500, error: error.message };
      }
      return { name: "Supabase DB Connection", status: "Healthy", latency: `${latency}ms`, code: 200 };
    } catch (err) {
      return { name: "Supabase DB Connection", status: "Offline", latency: "—", code: 500, error: err instanceof Error ? err.message : "Unknown" };
    }
  }

  static async checkRedis(): Promise<ApiHealthResult> {
    const start = Date.now();
    const configured = isRedisConfigured();
    const healthy = isRedisHealthy();
    const latency = Date.now() - start;
    
    if (healthy) {
      return { name: "Redis Cache", status: "Healthy", latency: `${latency}ms`, code: 200 };
    } else if (configured) {
      return { name: "Redis Cache", status: "Degraded", latency: `${latency}ms`, code: 500, error: "Redis is configured but not healthy" };
    } else {
      return { name: "Redis Cache", status: "Offline", latency: "—", code: 200, error: "Bypassed / In-memory fallback active" };
    }
  }

  static async runAllDiagnostics(): Promise<ApiHealthResult[]> {
    const externalPromises = Object.values(EXTERNAL_APIS).map((api) => probeExternalApi(api));
    const internalPromises = [this.checkDatabase(), this.checkRedis()];
    
    const results = await Promise.all([...internalPromises, ...externalPromises]);
    return results;
  }
}
