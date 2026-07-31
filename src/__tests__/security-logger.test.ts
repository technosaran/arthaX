jest.mock("@/lib/logger", () => {
  const infoMock = jest.fn();
  const warnMock = jest.fn();
  const errorMock = jest.fn();
  const debugMock = jest.fn();
  const fatalMock = jest.fn();
  const childMock = jest.fn().mockReturnThis();

  const mockInstance = {
    info: infoMock,
    warn: warnMock,
    error: errorMock,
    debug: debugMock,
    fatal: fatalMock,
    child: childMock,
  };

  class Logger {
    info = infoMock;
    warn = warnMock;
    error = errorMock;
    debug = debugMock;
    fatal = fatalMock;
    child = childMock;
  }

  return {
    Logger,
    defaultLogger: mockInstance,
    default: mockInstance,
  };
});

import { SecurityLogger } from "@/lib/security-logger";
import { Logger } from "@/lib/logger";

const vi = jest;

describe("SecurityLogger", () => {
  let mockLoggerInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoggerInstance = new Logger();
  });

  it("should log auth attempts successfully", () => {
    SecurityLogger.logAuthAttempt(true, "user-123", { method: "credentials" });
    
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      "[SECURITY] auth_login_success",
      expect.objectContaining({
        type: "auth_login_success",
        userId: "user-123",
        category: "security",
      })
    );
  });

  it("should log auth attempt failures as warnings", () => {
    SecurityLogger.logAuthAttempt(false, undefined, { ip: "1.2.3.4" });

    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining("auth_login_failure"),
      expect.objectContaining({
        type: "auth_login_failure",
        category: "security",
      })
    );
  });

  it("should log rate limit violations as warnings", () => {
    SecurityLogger.logRateLimitViolation("1.2.3.4", "/api/transactions");

    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining("rate_limit_exceeded"),
      expect.objectContaining({
        type: "rate_limit_exceeded",
        ip: "1.2.3.4",
        path: "/api/transactions",
        category: "security",
      })
    );
  });

  it("should log input validation failures as warnings", () => {
    SecurityLogger.logValidationFailure("/api/budgets", { amount: "Must be positive number" });

    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining("input_validation_failure"),
      expect.objectContaining({
        type: "input_validation_failure",
        path: "/api/budgets",
        category: "security",
      })
    );
  });
});
