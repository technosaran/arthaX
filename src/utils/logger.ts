type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  message: string;
  level?: LogLevel;
  context?: string;
  metadata?: Record<string, unknown>;
  error?: Error | unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "access_token",
  "refresh_token",
  "service_role",
  "service_key",
  "cookie",
]);

/**
 * Redacts sensitive fields (passwords, tokens, keys) from structured logs.
 */
function sanitizeMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMetadata(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeMetadata(val, depth + 1);
    }
  }
  return sanitized;
}

class StructuredLogger {
  private format(payload: LogPayload): string {
    const timestamp = new Date().toISOString();
    const level = payload.level || "info";
    const context = payload.context ? `[${payload.context}]` : "[App]";
    const meta = payload.metadata ? JSON.stringify(sanitizeMetadata(payload.metadata)) : "";
    const errorStr = payload.error
      ? ` Error: ${payload.error instanceof Error ? payload.error.stack || payload.error.message : String(payload.error)}`
      : "";

    return `${timestamp} ${level.toUpperCase()} ${context} ${payload.message}${meta ? ` Meta: ${meta}` : ""}${errorStr}`;
  }

  debug(message: string, context?: string, metadata?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.format({ message, level: "debug", context, metadata }));
    }
  }

  info(message: string, context?: string, metadata?: Record<string, unknown>) {
    console.info(this.format({ message, level: "info", context, metadata }));
  }

  warn(message: string, context?: string, metadata?: Record<string, unknown>, error?: unknown) {
    console.warn(this.format({ message, level: "warn", context, metadata, error }));
  }

  error(message: string, context?: string, error?: unknown, metadata?: Record<string, unknown>) {
    console.error(this.format({ message, level: "error", context, metadata, error }));
  }
}

export const logger = new StructuredLogger();
