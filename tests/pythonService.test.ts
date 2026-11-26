import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPythonServiceUrl,
  isPythonServiceHealthy,
  ensurePythonServiceOnline,
  getCalculationEngineUnreachableMessage,
} from "@/utils/pythonService";

describe("Python Service Manager Suite", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("isPythonServiceHealthy", () => {
    it("returns true when health endpoint responds with 200 and healthy status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "healthy", service: "arthax-python-analytics" }),
      });

      const result = await isPythonServiceHealthy("http://127.0.0.1:8000");
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8000/api/py/health",
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it("returns false when service is unreachable (network error)", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed (ECONNREFUSED)"));

      const result = await isPythonServiceHealthy("http://127.0.0.1:8000");
      expect(result).toBe(false);
    });

    it("returns false when service returns non-200 HTTP code", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ status: "unhealthy" }),
      });

      const result = await isPythonServiceHealthy("http://127.0.0.1:8000");
      expect(result).toBe(false);
    });
  });

  describe("ensurePythonServiceOnline", () => {
    it("returns true immediately if service is already healthy", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "healthy" }),
      });

      const result = await ensurePythonServiceOnline("http://127.0.0.1:8000");
      expect(result).toBe(true);
    });

    it("returns false without spawning in production environment", async () => {
      const env = process.env as Record<string, string | undefined>;
      const prevNodeEnv = env.NODE_ENV;
      const prevVercel = env.VERCEL;
      try {
        env.NODE_ENV = "production";
        env.VERCEL = "1";

        global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
        const result = await ensurePythonServiceOnline("http://127.0.0.1:8000");
        expect(result).toBe(false);
      } finally {
        env.NODE_ENV = prevNodeEnv;
        if (prevVercel !== undefined) {
          env.VERCEL = prevVercel;
        } else {
          delete env.VERCEL;
        }
      }
    });

    it("returns false without spawning if target is an external production URL", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
      const result = await ensurePythonServiceOnline("https://arthax.vercel.app");
      expect(result).toBe(false);
    });
  });

  describe("getCalculationEngineUnreachableMessage", () => {
    it("provides specific guidance to run npm run dev:all for local URLs", () => {
      const msgLocal = getCalculationEngineUnreachableMessage("http://127.0.0.1:8000");
      expect(msgLocal).toContain("Python microservice on port 8000");
      expect(msgLocal).toContain("npm run dev:all");
      expect(msgLocal).toContain("python_service/main.py");

      const msgLocalhost = getCalculationEngineUnreachableMessage("http://localhost:8000");
      expect(msgLocalhost).toContain("npm run dev:all");
    });

    it("provides cloud guidance for remote URLs", () => {
      const msgRemote = getCalculationEngineUnreachableMessage("https://arthax.vercel.app");
      expect(msgRemote).toContain("backend analytics service is online");
    });
  });

  describe("getPythonServiceUrl", () => {
    it("resolves explicit env, dev loopback, and production origins cleanly", () => {
      const env = process.env as Record<string, string | undefined>;
      const saved = {
        PYTHON_BACKEND_URL: env.PYTHON_BACKEND_URL,
        PYTHON_SERVICE_URL: env.PYTHON_SERVICE_URL,
        NODE_ENV: env.NODE_ENV,
        VERCEL: env.VERCEL,
        VERCEL_URL: env.VERCEL_URL,
        NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
      };
      try {
        delete env.PYTHON_BACKEND_URL;
        delete env.PYTHON_SERVICE_URL;
        delete env.VERCEL;
        env.NODE_ENV = "development";
        env.NEXT_PUBLIC_APP_URL = "https://arthax.vercel.app";
        expect(getPythonServiceUrl()).toBe("http://127.0.0.1:8000");

        env.NODE_ENV = "production";
        expect(getPythonServiceUrl("https://preview.arthax.app/")).toBe("https://preview.arthax.app");

        env.PYTHON_SERVICE_URL = "https://py.internal.local/";
        expect(getPythonServiceUrl("https://preview.arthax.app")).toBe("https://py.internal.local");
      } finally {
        for (const [k, v] of Object.entries(saved)) {
          if (v !== undefined) env[k] = v;
          else delete env[k];
        }
      }
    });
  });
});
