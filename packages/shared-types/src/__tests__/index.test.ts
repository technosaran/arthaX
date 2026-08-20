import {
  MICROSERVICE_PORTS,
  ApiResponse,
  UserContext,
  ServiceConfig,
} from "../index";

describe("Shared Types Package", () => {
  describe("MICROSERVICE_PORTS", () => {
    it("should export correct microservice port definitions", () => {
      expect(MICROSERVICE_PORTS).toBeDefined();
      expect(MICROSERVICE_PORTS.WEB_GATEWAY).toBe(3000);
      expect(MICROSERVICE_PORTS.ACCOUNT_SERVICE).toBe(4001);
      expect(MICROSERVICE_PORTS.INVESTMENT_SERVICE).toBe(4002);
      expect(MICROSERVICE_PORTS.BUDGET_SERVICE).toBe(4003);
      expect(MICROSERVICE_PORTS.PARSER_SERVICE).toBe(4004);
      expect(MICROSERVICE_PORTS.AI_MCP_SERVICE).toBe(4005);
    });

    it("should have unique ports for each microservice", () => {
      const ports = Object.values(MICROSERVICE_PORTS);
      const uniquePorts = new Set(ports);
      expect(uniquePorts.size).toBe(ports.length);
    });
  });

  describe("Interface Type Contracts", () => {
    it("should allow valid ApiResponse structures", () => {
      const successResponse: ApiResponse<{ count: number }> = {
        success: true,
        data: { count: 42 },
        timestamp: new Date().toISOString(),
      };
      expect(successResponse.success).toBe(true);
      expect(successResponse.data?.count).toBe(42);

      const errorResponse: ApiResponse = {
        success: false,
        error: "Internal Server Error",
        timestamp: new Date().toISOString(),
      };
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe("Internal Server Error");
    });

    it("should allow valid UserContext structures", () => {
      const user: UserContext = {
        userId: "usr-12345",
        email: "user@example.com",
        role: "admin",
      };
      expect(user.userId).toBe("usr-12345");
      expect(user.email).toBe("user@example.com");
      expect(user.role).toBe("admin");
    });

    it("should allow valid ServiceConfig structures", () => {
      const config: ServiceConfig = {
        serviceName: "account-service",
        port: MICROSERVICE_PORTS.ACCOUNT_SERVICE,
        environment: "production",
      };
      expect(config.serviceName).toBe("account-service");
      expect(config.port).toBe(4001);
      expect(config.environment).toBe("production");
    });
  });
});
