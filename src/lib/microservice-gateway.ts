import { MICROSERVICE_PORTS } from "@finance-os/shared-types";

export interface MicroserviceRouteMap {
  [prefix: string]: number;
}

export const SERVICE_PORTS = {
  accounts: process.env.ACCOUNT_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.ACCOUNT_SERVICE}`,
  transactions: process.env.ACCOUNT_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.ACCOUNT_SERVICE}`,
  investments: process.env.INVESTMENT_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.INVESTMENT_SERVICE}`,
  stocks: process.env.INVESTMENT_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.INVESTMENT_SERVICE}`,
  "mutual-funds": process.env.INVESTMENT_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.INVESTMENT_SERVICE}`,
  budgets: process.env.BUDGET_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.BUDGET_SERVICE}`,
  goals: process.env.BUDGET_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.BUDGET_SERVICE}`,
  expenses: process.env.BUDGET_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.BUDGET_SERVICE}`,
  "bank-parser": process.env.PARSER_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.PARSER_SERVICE}`,
  "cas-parser": process.env.PARSER_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.PARSER_SERVICE}`,
  ai: process.env.AI_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.AI_MCP_SERVICE}`,
  mcp: process.env.AI_SERVICE_URL || `http://localhost:${MICROSERVICE_PORTS.AI_MCP_SERVICE}`,
};

export async function proxyToMicroservice(req: Request, serviceUrl: string, userId?: string) {
  const url = new URL(req.url);
  const targetUrl = `${serviceUrl}${url.pathname}${url.search}`;

  const headers = new Headers(req.headers);
  if (userId) {
    headers.set("x-user-id", userId);
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: "Microservice Unavailable",
        details: error.message,
        targetUrl,
      },
      { status: 503 }
    );
  }
}
