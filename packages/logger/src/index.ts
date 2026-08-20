import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "*.password",
      "authorization",
      "*.authorization",
      "req.headers.authorization",
      "req.headers[\"x-user-id\"]",
      "apiKey",
      "*.apiKey",
      "secret",
      "*.secret",
      "token",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
});

export function createServiceLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}
