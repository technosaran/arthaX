export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface UserContext {
  userId: string;
  email?: string;
  role?: string;
}

export interface ServiceConfig {
  serviceName: string;
  port: number;
  environment: string;
}

export const MICROSERVICE_PORTS = {
  WEB_GATEWAY: 3000,
  ACCOUNT_SERVICE: 4001,
  INVESTMENT_SERVICE: 4002,
  BUDGET_SERVICE: 4003,
  PARSER_SERVICE: 4004,
  AI_MCP_SERVICE: 4005,
} as const;
