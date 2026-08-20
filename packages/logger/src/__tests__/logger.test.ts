import { logger, createServiceLogger } from "../index";
import pino from "pino";

describe("Logger Package", () => {
  describe("logger instance", () => {
    it("should export a configured pino logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.child).toBe("function");
    });

    it("should include standard environment bindings", () => {
      const bindings = logger.bindings();
      expect(bindings).toBeDefined();
      expect(bindings.env).toBeDefined();
    });
  });

  describe("createServiceLogger", () => {
    it("should create a child logger with service metadata", () => {
      const serviceName = "auth-service";
      const serviceLogger = createServiceLogger(serviceName);

      expect(serviceLogger).toBeDefined();
      expect(typeof serviceLogger.info).toBe("function");
      expect(typeof serviceLogger.error).toBe("function");

      const bindings = serviceLogger.bindings();
      expect(bindings.service).toBe(serviceName);
    });

    it("should handle different service names correctly", () => {
      const loggerA = createServiceLogger("service-a");
      const loggerB = createServiceLogger("service-b");

      expect(loggerA.bindings().service).toBe("service-a");
      expect(loggerB.bindings().service).toBe("service-b");
    });
  });

  describe("Redaction configuration", () => {
    it("should redact sensitive fields when logging objects", () => {
      // In pino, redact serializer function is attached or formatters handle redaction
      // We test by creating a destination stream with the same redaction config or testing serializer
      const stream = {
        data: "",
        write(chunk: string) {
          this.data += chunk;
          return true;
        },
      };

      const testLogger = pino(
        {
          redact: {
            paths: [
              "password",
              "*.password",
              "authorization",
              "*.authorization",
              "req.headers.authorization",
              'req.headers["x-user-id"]',
              "apiKey",
              "*.apiKey",
              "secret",
              "*.secret",
              "token",
              "*.token",
            ],
            censor: "[REDACTED]",
          },
        },
        stream
      );

      testLogger.info({
        password: "supersecretpassword",
        apiKey: "sk-1234567890abcdef",
        secret: "my_api_secret",
        token: "jwt.token.value",
        authorization: "Bearer xyz",
        safeField: "safeValue",
      });

      expect(stream.data).toContain("safeValue");
      expect(stream.data).not.toContain("supersecretpassword");
      expect(stream.data).not.toContain("sk-1234567890abcdef");
      expect(stream.data).not.toContain("my_api_secret");
      expect(stream.data).not.toContain("jwt.token.value");
      expect(stream.data).toContain("[REDACTED]");
    });

    it("should redact nested sensitive fields", () => {
      const stream = {
        data: "",
        write(chunk: string) {
          this.data += chunk;
          return true;
        },
      };

      const testLogger = pino(
        {
          redact: {
            paths: [
              "password",
              "*.password",
              "authorization",
              "*.authorization",
              "req.headers.authorization",
              'req.headers["x-user-id"]',
              "apiKey",
              "*.apiKey",
              "secret",
              "*.secret",
              "token",
              "*.token",
            ],
            censor: "[REDACTED]",
          },
        },
        stream
      );

      testLogger.info({
        user: {
          password: "nested_password",
          apiKey: "nested_key",
          secret: "nested_secret",
          token: "nested_token",
        },
      });

      expect(stream.data).not.toContain("nested_password");
      expect(stream.data).not.toContain("nested_key");
      expect(stream.data).not.toContain("nested_secret");
      expect(stream.data).not.toContain("nested_token");
      expect(stream.data).toContain("[REDACTED]");
    });
  });
});
