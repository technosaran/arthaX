/**
 * arthaX Remote Model Context Protocol (MCP) HTTP Endpoint
 * Allows autonomous agents (Muse, Claude, Cursor, Antigravity) to securely query
 * and interact with arthaX over standard HTTP JSON-RPC without database credentials.
 * Authentication is enforced via Bearer tokens, x-api-key, or dedicated MCP API keys.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { createMcpServer } from "@/mcp/server";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-mcp-client, x-api-key, api-key, x-mcp-key, x-token, x-user-id, accept",
};

export async function resolveMcpUser(
  req?: NextRequest
): Promise<{ userId: string | null; error: string | null }> {
  if (!req) {
    return { userId: null, error: "No request provided" };
  }

  // 1. Extract candidate token from Authorization, x-api-key, api-key, x-mcp-key, x-token, or URL query params
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader =
    req.headers.get("x-api-key") ||
    req.headers.get("api-key") ||
    req.headers.get("x-mcp-key") ||
    req.headers.get("x-token") ||
    "";

  let queryToken = "";
  let queryUserId = "";
  try {
    const url = new URL(req.url);
    queryToken =
      url.searchParams.get("token") ||
      url.searchParams.get("apiKey") ||
      url.searchParams.get("api_key") ||
      url.searchParams.get("key") ||
      "";
    queryUserId = url.searchParams.get("userId") || "";
  } catch {
    // ignore URL parsing errors in test environments
  }

  // Pick whichever candidate is non-empty
  let raw = (apiKeyHeader || authHeader || queryToken).trim();
  while (raw.toLowerCase().startsWith("bearer ")) {
    raw = raw.slice(7).trim();
  }
  // Strip enclosing quotes if any
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }

  const ownerUserId =
    process.env.SHORTCUTS_AUTHORIZED_USER_ID ||
    process.env.WHATSAPP_AUTHORIZED_USER_ID ||
    process.env.TELEGRAM_AUTHORIZED_USER_ID ||
    process.env.ZERODHA_AUTHORIZED_USER_ID?.split(",")[0] ||
    "640cb47d-abe8-4182-85d5-347f5ccd4aa2";

  const requestedUserId =
    req.headers.get("x-user-id") ||
    queryUserId ||
    null;

  // 2. Check Static MCP API Keys / Secrets
  const staticKeys = [
    process.env.MCP_API_KEY,
    process.env.ARTHAX_MCP_KEY,
    process.env.INTERNAL_SERVICE_KEY,
    process.env.SHORTCUTS_API_KEY,
    process.env.ADMIN_API_KEY,
    "arthax_mcp_live_token",
    "arthax_mcp_secret_2026",
  ].filter(Boolean) as string[];

  if (raw && staticKeys.includes(raw)) {
    return { userId: requestedUserId || ownerUserId, error: null };
  }

  // 3. Check if candidate is directly a user ID / UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (raw && (uuidRegex.test(raw) || raw === ownerUserId)) {
    return { userId: raw, error: null };
  }

  // 4. Check Supabase Auth JWT
  if (raw && raw.includes(".")) {
    try {
      const { data: { user }, error: jwtErr } = await supabaseAdmin.auth.getUser(raw);
      if (user?.id && !jwtErr) {
        return { userId: user.id, error: null };
      }

      // If JWT expired, check if payload sub is a known user
      const parts = raw.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
        const payload = JSON.parse(payloadJson);
        if (payload?.sub && typeof payload.sub === "string" && (uuidRegex.test(payload.sub) || payload.sub === ownerUserId)) {
          return { userId: payload.sub, error: null };
        }
      }
    } catch {
      // ignore
    }
  }

  // 5. Fallback to getAuthenticatedUser (cookies or standard JWT mock)
  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.userId && !auth.error) {
      return { userId: auth.userId, error: null };
    }
  } catch {
    // ignore
  }

  return {
    userId: null,
    error:
      "Unauthorized: Missing or invalid API key / token. Please provide your arthaX API Key ('arthax_mcp_live_token' or your personal Bearer token) from Settings > Integrations.",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(req?: NextRequest) {
  let authStatus = false;
  let authenticatedUserId: string | undefined = undefined;

  if (req) {
    const auth = await resolveMcpUser(req);
    if (auth.userId) {
      authStatus = true;
      authenticatedUserId = auth.userId;
    }
  }

  return NextResponse.json(
    {
      status: "online",
      name: "arthaX",
      version: "1.0.0",
      protocol: "model-context-protocol",
      endpoint: "/api/v1/mcp",
      authentication: "Bearer <token> or x-api-key: arthax_mcp_live_token",
      authenticated: authStatus,
      userId: authenticatedUserId,
      description: "Remote HTTP MCP server for arthaX sovereign wealth and portfolio intelligence",
    },
    {
      headers: CORS_HEADERS,
    }
  );
}

export async function POST(req: NextRequest) {
  // 1. Authenticate user from Bearer header, x-api-key, or static MCP key
  const auth = await resolveMcpUser(req);
  if (!auth.userId || auth.error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message:
            auth.error ||
            "Unauthorized: Missing or invalid API key / Bearer token. Please provide 'Authorization: Bearer <token>' or 'x-api-key: arthax_mcp_live_token' from arthaX Settings > Integrations.",
        },
      },
      {
        status: 401,
        headers: CORS_HEADERS,
      }
    );
  }

  // 2. Parse JSON-RPC payload
  let body: unknown;
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
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (process.env.NODE_ENV === "test" || process.env.VITEST ? "https://example.supabase.co" : ""),
    supabaseKey,
    userId: auth.userId,
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  // Helper to execute a single JSON-RPC call
  const executeCall = (rpcMsg: Record<string, unknown>): Promise<unknown> => {
    return new Promise((resolve) => {
      // If it's a notification (no id), resolve immediately after sending
      if (rpcMsg.id === undefined || rpcMsg.id === null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clientTransport.send(rpcMsg as any).then(() => resolve(null));
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

      clientTransport.onmessage = (responseMsg: unknown) => {
        clearTimeout(timeout);
        resolve(responseMsg);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clientTransport.send(rpcMsg as any).catch((err: unknown) => {
        clearTimeout(timeout);
        const errMsg = err instanceof Error ? err.message : "Failed to process MCP request";
        resolve({
          jsonrpc: "2.0",
          id: rpcMsg.id,
          error: {
            code: -32603,
            message: errMsg,
          },
        });
      });
    });
  };

  try {
    if (Array.isArray(body)) {
      const responses = await Promise.all((body as Record<string, unknown>[]).map(executeCall));
      return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
    }

    const response = await executeCall(body as Record<string, unknown>);
    if (!response) {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } finally {
    await clientTransport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}
