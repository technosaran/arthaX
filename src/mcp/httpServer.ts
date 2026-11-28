/**
 * arthaX Model Context Protocol (MCP) HTTP / SSE Server
 * Enables remote AI assistants (such as Muse, remote Claude agents, and cloud bots)
 * to securely communicate with the arthaX MCP server over HTTP + Server-Sent Events (SSE).
 */

import http, { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server";
import { getMcpConfig, McpConfig } from "./config";
import { constantTimeCompare, maskApiKey } from "../utils/crypto";

// Active sessions map: sessionId -> SSEServerTransport
const activeSessions = new Map<string, SSEServerTransport>();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-MCP-Key");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
}

function sendJsonResponse(res: ServerResponse, statusCode: number, data: unknown) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

export function startHttpServer(portOverride?: number) {
  const baseConfig: McpConfig = getMcpConfig();
  const port = portOverride || parseInt(process.env.MCP_PORT || process.env.PORT || "3005", 10);
  const secretKey = (
    process.env.MCP_API_KEY ||
    process.env.ARTHAX_MCP_KEY ||
    process.env.INTERNAL_SERVICE_KEY ||
    ""
  ).trim();

  if (!secretKey) {
    throw new Error(
      "[arthaX MCP HTTP] MCP_API_KEY (or ARTHAX_MCP_KEY / INTERNAL_SERVICE_KEY) must be configured before starting the HTTP/SSE server."
    );
  }

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers.host || `localhost:${port}`;
    const parsedUrl = new URL(req.url || "/", `http://${host}`);
    const pathname = parsedUrl.pathname;

    // Health Check Endpoint
    if (pathname === "/" || pathname === "/health") {
      sendJsonResponse(res, 200, {
        status: "healthy",
        service: "arthaX Model Context Protocol (MCP) Server",
        transport: "sse",
        version: "1.0.0",
        activeSessions: activeSessions.size,
        endpoints: {
          sse: "/sse",
          messages: "/messages",
        },
      });
      return;
    }

    // Verify Secret Token / API Key strictly from headers (no query string tokens in URL logs)
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const headerToken = req.headers["x-mcp-key"] as string | undefined;

    const providedToken = (bearerToken || headerToken || "").trim();

    if (!providedToken || !constantTimeCompare(providedToken, secretKey)) {
      sendJsonResponse(res, 401, {
        error: "Unauthorized",
        message: "Valid MCP Secret Token required via 'Authorization: Bearer <token>' or 'X-MCP-Key' header.",
      });
      return;
    }

    // SSE Connection Initiation (GET /sse)
    if (pathname === "/sse" && req.method === "GET") {
      try {
        // Resolve target user ID: defaults to server config; optional override only with valid UUID
        const requestedUser = (req.headers["x-user-id"] as string | undefined)?.trim();
        if (requestedUser && !UUID_REGEX.test(requestedUser)) {
          sendJsonResponse(res, 400, { error: "Bad Request", message: "Invalid X-User-Id format." });
          return;
        }
        const targetUserId = requestedUser || baseConfig.userId;

        const sessionConfig: McpConfig = {
          ...baseConfig,
          userId: targetUserId,
        };

        const transport = new SSEServerTransport("/messages", res);
        const sessionId = transport.sessionId;
        activeSessions.set(sessionId, transport);

        transport.onclose = () => {
          activeSessions.delete(sessionId);
          process.stderr.write(`[arthaX MCP HTTP] Session closed: ${sessionId} (Remaining: ${activeSessions.size})\n`);
        };

        process.stderr.write(
          `[arthaX MCP HTTP] New SSE connection established. Session: ${sessionId} | User: ${targetUserId}\n`
        );

        const mcpServer = createMcpServer(sessionConfig);
        await mcpServer.connect(transport);
      } catch (err: any) {
        process.stderr.write(`[arthaX MCP HTTP] SSE connection error: ${err.message}\n`);
        if (!res.headersSent) {
          sendJsonResponse(res, 500, { error: "Failed to establish SSE transport", details: err.message });
        }
      }
      return;
    }

    // JSON-RPC Message Receiver (POST /messages)
    if (pathname === "/messages" && req.method === "POST") {
      const sessionId = parsedUrl.searchParams.get("sessionId");
      if (!sessionId) {
        sendJsonResponse(res, 400, {
          error: "Bad Request",
          message: "Missing 'sessionId' query parameter.",
        });
        return;
      }

      const transport = activeSessions.get(sessionId);
      if (!transport) {
        sendJsonResponse(res, 404, {
          error: "Not Found",
          message: `Active session '${sessionId}' not found or has expired.`,
        });
        return;
      }

      try {
        await transport.handlePostMessage(req, res);
      } catch (err: any) {
        process.stderr.write(`[arthaX MCP HTTP] Error handling message for session ${sessionId}: ${err.message}\n`);
      }
      return;
    }

    sendJsonResponse(res, 404, {
      error: "Not Found",
      message: `Endpoint '${pathname}' not recognized. Use /sse to initiate an MCP SSE stream.`,
    });
  });

  server.listen(port, () => {
    process.stderr.write("\n=======================================================\n");
    process.stderr.write("   arthaX Model Context Protocol (MCP) HTTP Server     \n");
    process.stderr.write("=======================================================\n");
    process.stderr.write(`  Listening on:     http://localhost:${port}\n`);
    process.stderr.write(`  SSE Endpoint:     http://localhost:${port}/sse\n`);
    process.stderr.write(`  Messages URL:     http://localhost:${port}/messages\n`);
    process.stderr.write(`  Auth Token:       ${maskApiKey(secretKey) || "[configured]"}\n`);
    process.stderr.write("-------------------------------------------------------\n");
    process.stderr.write("  Tunnel Command (Free Cloudflare Tunnel):\n");
    process.stderr.write(`    npx cloudflared tunnel --url http://localhost:${port}\n`);
    process.stderr.write("=======================================================\n\n");
  });

  return server;
}

// When executed directly via `npx tsx src/mcp/httpServer.ts`
if (
  process.argv[1] &&
  (process.argv[1].endsWith("httpServer.ts") || process.argv[1].endsWith("httpServer.js"))
) {
  startHttpServer();
}
