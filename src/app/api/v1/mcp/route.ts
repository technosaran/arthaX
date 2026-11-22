/**
 * arthaX Remote Model Context Protocol (MCP) HTTP Endpoint
 * Allows autonomous agents (Muse, Claude, Cursor, Antigravity) to securely query
 * and interact with arthaX over standard HTTP JSON-RPC without database credentials.
 * Authentication is enforced via Bearer tokens (Supabase Auth JWT).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { createMcpServer } from "@/mcp/server";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-mcp-client",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      status: "online",
      name: "arthaX",
      version: "1.0.0",
      protocol: "model-context-protocol",
      endpoint: "/api/v1/mcp",
      authentication: "Bearer <token>",
      description: "Remote HTTP MCP server for arthaX sovereign wealth and portfolio intelligence",
    },
    {
      headers: CORS_HEADERS,
    }
  );
}

export async function POST(req: NextRequest) {
  // 1. Authenticate user from Bearer header
  const auth = await getAuthenticatedUser(req);
  if (!auth.userId || auth.error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message:
            "Unauthorized: Missing or invalid Bearer token. Please provide 'Authorization: Bearer <token>' generated in arthaX Settings > Integrations.",
        },
      },
      {
        status: 401,
        headers: CORS_HEADERS,
      }
    );
  }

  // 2. Parse JSON-RPC payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error: Invalid JSON in request body",
        },
      },
      {
        status: 400,
        headers: CORS_HEADERS,
      }
    );
  }

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (process.env.NODE_ENV === "test" || process.env.VITEST ? "test-dummy-service-role-key" : "");

  // 3. Initialize scoped McpServer for this user
  const server = createMcpServer({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fvpfzbuoizzjwgekuhot.supabase.co",
    supabaseKey,
    userId: auth.userId,
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  // Helper to execute a single JSON-RPC call
  const executeCall = (rpcMsg: any): Promise<any> => {
    return new Promise((resolve) => {
      // If it's a notification (no id), resolve immediately after sending
      if (rpcMsg.id === undefined || rpcMsg.id === null) {
        clientTransport.send(rpcMsg).then(() => resolve(null));
        return;
      }

      const timeout = setTimeout(() => {
        resolve({
          jsonrpc: "2.0",
          id: rpcMsg.id,
          error: {
            code: -32603,
            message: "Internal error: MCP request timed out after 15 seconds",
          },
        });
      }, 15000);

      clientTransport.onmessage = (responseMsg: any) => {
        clearTimeout(timeout);
        resolve(responseMsg);
      };

      clientTransport.send(rpcMsg).catch((err: any) => {
        clearTimeout(timeout);
        resolve({
          jsonrpc: "2.0",
          id: rpcMsg.id,
          error: {
            code: -32603,
            message: err.message || "Failed to process MCP request",
          },
        });
      });
    });
  };

  try {
    if (Array.isArray(body)) {
      const responses = await Promise.all(body.map(executeCall));
      return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
    }

    const response = await executeCall(body);
    if (!response) {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } finally {
    await clientTransport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}
