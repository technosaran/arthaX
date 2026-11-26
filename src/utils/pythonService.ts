import { spawn } from "child_process";
import { logger } from "./logger";

let isSpawning = false;
let lastSpawnAttempt = 0;

/**
 * Resolves the active Python calculation service base URL across dev and Vercel deployments.
 */
export function getPythonServiceUrl(originFallback?: string): string {
  const explicit = process.env.PYTHON_BACKEND_URL || process.env.PYTHON_SERVICE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const isProd =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_ENV);

  if (isProd) {
    const fallback =
      originFallback ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://arthax.vercel.app";
    return fallback.replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
}

/**
 * Checks if the Python calculation engine service is online and healthy.
 */
export async function isPythonServiceHealthy(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/py/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data?.status === "healthy" || res.status === 200;
    }
  } catch {
    // Service offline or timeout
  }
  return false;
}

/**
 * Ensures the Python calculation service is online.
 * In local development, if the service on 127.0.0.1:8000 is unreachable,
 * it attempts to auto-spawn `python python_service/main.py` in the background.
 */
export async function ensurePythonServiceOnline(baseUrl: string): Promise<boolean> {
  // 1. Fast check if already healthy
  if (await isPythonServiceHealthy(baseUrl)) {
    return true;
  }

  // 2. Only attempt local auto-spawn in local development environments
  const isLocal =
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("0.0.0.0");
  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_ENV);

  if (!isLocal || isProduction) {
    return false;
  }

  // 3. Prevent duplicate concurrent spawn attempts
  const now = Date.now();
  if (isSpawning || now - lastSpawnAttempt < 8000) {
    await new Promise((r) => setTimeout(r, 2000));
    return isPythonServiceHealthy(baseUrl);
  }

  isSpawning = true;
  lastSpawnAttempt = now;

  try {
    logger.info("Attempting to auto-start Python calculation engine service...", "PythonServiceManager");

    const rootDir = process.cwd();
    const pythonExe = process.env.PYTHON_PATH || "python";

    const child = spawn(pythonExe, ["python_service/main.py"], {
      cwd: rootDir,
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    });

    child.unref();

    // Poll health endpoint for up to 5 seconds
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isPythonServiceHealthy(baseUrl)) {
        logger.info(`Python calculation engine service auto-started successfully on ${baseUrl}`, "PythonServiceManager");
        return true;
      }
    }
  } catch (err) {
    logger.warn("Failed to auto-spawn Python service", "PythonServiceManager", { error: String(err) });
  } finally {
    isSpawning = false;
  }

  return isPythonServiceHealthy(baseUrl);
}

/**
 * Returns a descriptive error message indicating how to resolve an unreachable calculation engine.
 */
export function getCalculationEngineUnreachableMessage(baseUrl: string): string {
  if (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) {
    return "Calculation engine service (Python microservice on port 8000) is unreachable. If running locally, please run 'npm run dev:all' or start 'python python_service/main.py' in a separate terminal.";
  }
  return "Calculation engine service is unreachable. Please ensure the backend analytics service is online and try again.";
}
