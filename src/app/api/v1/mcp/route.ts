/**
 * arthaX Remote Model Context Protocol (MCP) HTTP Endpoint
 * Allows autonomous agents (Muse, Claude, Cursor, Antigravity) to securely query
 * and interact with arthaX over standard HTTP JSON-RPC without database credentials.
 * Authentication is enforced via signed personal MCP tokens, verified Supabase JWTs,
 * or explicitly configured server-side MCP_API_KEY secrets.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { createMcpServer } from "@/mcp/server";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { constantTimeCompare } from "@/utils/crypto";
import { verifyPersonalMcpToken } from "@/utils/mcpAuth";
import { rateLimit } from "@/utils/rateLimit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-mcp-client, x-api-key, api-key, x-mcp-key, x-token, x-user-id, accept",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractHeaderToken(req: NextRequest): string {
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader =
    req.headers.get("x-api-key") ||
    req.headers.get("api-key") ||
    req.headers.get("x-mcp-key") ||
    req.headers.get("x-token") ||
    "";

  let raw = (apiKeyHeader || authHeader).trim();
  while (raw.toLowerCase().startsWith("bearer ")) {
    raw = raw.slice(7).trim();
  }
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}

export async function resolveMcpUser(
  req?: NextRequest
): Promise<{ userId: string | null; error: string | null }> {
  if (!req) {
    return { userId: null, error: "No request provided" };
  }

  const raw = extractHeaderToken(req);

  // 1. Signed Personal MCP Bearer Token (ax_mcp_...)
  if (raw.startsWith("ax_mcp_")) {
    const verified = verifyPersonalMcpToken(raw);
    if (verified) {
      return { userId: verified.sub, error: null };
    }
    return {
      userId: null,
      error: "Unauthorized: Personal MCP token is invalid or expired. Generate a fresh token in Settings > Integrations.",
    };
  }

  // 2. Explicitly Configured Server-Side API Keys (never hardcoded in source)
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  if (raw && adminKey && constantTimeCompare(raw, adminKey)) {
    const requestedUserId = req.headers.get("x-user-id")?.trim();
    if (requestedUserId) {
      if (!UUID_REGEX.test(requestedUserId)) {
        return { userId: null, error: "Unauthorized: Invalid x-user-id format." };
      }
      return { userId: requestedUserId, error: null };
    }
  }

  const serviceKeys = [
    process.env.MCP_API_KEY,
    process.env.ARTHAX_MCP_KEY,
    process.env.INTERNAL_SERVICE_KEY,
    process.env.SHORTCUTS_API_KEY,
    adminKey,
  ]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k && k.length > 0));

  const ownerUserId =
    process.env.SHORTCUTS_AUTHORIZED_USER_ID ||
    process.env.WHATSAPP_AUTHORIZED_USER_ID ||
    process.env.TELEGRAM_AUTHORIZED_USER_ID ||
    process.env.ZERODHA_AUTHORIZED_USER_ID?.split(",")[0]?.trim() ||
    null;

  if (raw && serviceKeys.some((key) => constantTimeCompare(raw, key))) {
    if (!ownerUserId) {
      return {
        userId: null,
        error: "Server configuration error: Authorized owner user ID is not configured for service key access.",
      };
    }
    return { userId: ownerUserId, error: null };
  }

  // 3. Verified Supabase Auth JWT or HTTP-only Session Cookies
  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.userId && !auth.error) {
      return { userId: auth.userId, error: null };
    }
  } catch {
    // Fall through to unified unauthorized error
  }

  return {
    userId: null,
    error:
      "Unauthorized: Missing or invalid API token. Copy your personal MCP configuration from Settings > Integrations.",
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
      authentication: "Authorization: Bearer <personal-mcp-token-or-jwt>",
      authenticated: authStatus,
      ...(authenticatedUserId ? { userId: authenticatedUserId } : {}),
      description: "Remote HTTP MCP server for arthaX sovereign wealth and portfolio intelligence",
    },
    {
      headers: CORS_HEADERS,
    }
  );
}

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous";
  const ipRl = await rateLimit(`mcp_ip:${clientIp}`, 120, 60);
  if (!ipRl.success) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32005, message: "Rate limit exceeded. Please wait before retrying." },
      },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  // 1. Authenticate user strictly from signed personal MCP token, configured key, or verified JWT
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
            "Unauthorized: Missing or invalid API token. Copy your personal MCP configuration from arthaX Settings > Integrations.",
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

  const isBatch = Array.isArray(body);
  if (
    (!isBatch && (typeof body !== "object" || body === null)) ||
    (isBatch && (body as unknown[]).length === 0)
  ) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "Invalid Request: Expected JSON-RPC object or non-empty array",
        },
      },
      { status: 400, headers: CORS_HEADERS }
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

  // Single multiplexed dispatcher so concurrent JSON-RPC batch calls match their exact IDs
  const pendingResponses = new Map<
    string | number,
    { resolve: (value: unknown) => void; timer: ReturnType<typeof setTimeout> }
  >();

  clientTransport.onmessage = (responseMsg: unknown) => {
    if (responseMsg && typeof responseMsg === "object" && "id" in responseMsg) {
      const msgId = (responseMsg as { id?: string | number | null }).id;
      if (msgId !== undefined && msgId !== null) {
        const entry = pendingResponses.get(msgId);
        if (entry) {
          clearTimeout(entry.timer);
          pendingResponses.delete(msgId);
          entry.resolve(responseMsg);
        }
      }
    }
  };

  const executeCall = (rpcMsg: unknown): Promise<unknown> => {
    if (!rpcMsg || typeof rpcMsg !== "object" || Array.isArray(rpcMsg)) {
      return Promise.resolve({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request" },
      });
    }

    const msgObj = rpcMsg as Record<string, unknown>;
    const msgId = msgObj.id;

    if (msgId === undefined || msgId === null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return clientTransport.send(msgObj as any).then(() => null);
    }

    if (typeof msgId !== "string" && typeof msgId !== "number") {
      return Promise.resolve({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid JSON-RPC id" },
      });
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingResponses.delete(msgId);
        resolve({
          jsonrpc: "2.0",
          id: msgId,
          error: {
            code: -32603,
            message: "Internal error: MCP request timed out after 15 seconds",
          },
        });
      }, 15000);

      pendingResponses.set(msgId, { resolve, timer });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clientTransport.send(msgObj as any).catch((err: unknown) => {
        clearTimeout(timer);
        pendingResponses.delete(msgId);
        const errMsg = err instanceof Error ? err.message : "Failed to process MCP request";
        resolve({
          jsonrpc: "2.0",
          id: msgId,
          error: {
            code: -32603,
            message: errMsg,
          },
        });
      });
    });
  };

  try {
    if (isBatch) {
      const responses = await Promise.all((body as unknown[]).map(executeCall));
      return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
    }

    const response = await executeCall(body);
    if (!response) {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } finally {
    for (const entry of pendingResponses.values()) {
      clearTimeout(entry.timer);
    }
    pendingResponses.clear();
    await clientTransport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}
