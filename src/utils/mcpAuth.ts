import crypto from "crypto";
import { constantTimeCompare } from "./crypto";

const MCP_TOKEN_PREFIX = "ax_mcp_";
const DEFAULT_MCP_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

export interface PersonalMcpTokenPayload {
  sub: string;
  iat: number;
  exp: number;
  scope: "mcp";
}

function getMcpSigningKey(): Buffer {
  const dedicated = process.env.MCP_TOKEN_SECRET?.trim();
  if (dedicated) {
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        Buffer.from(dedicated),
        Buffer.from("arthax-mcp-token-salt"),
        Buffer.from("personal-mcp-bearer-v1"),
        32
      )
    );
  }

  const fallbackMaster =
    process.env.ENCRYPTION_MASTER_KEY?.trim() ||
    process.env.OAUTH_STATE_SECRET?.trim();
  if (fallbackMaster) {
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        Buffer.from(fallbackMaster),
        Buffer.from("arthax-mcp-token-salt"),
        Buffer.from("personal-mcp-bearer-v1"),
        32
      )
    );
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (isProd) {
    throw new Error(
      "[MCP Security] MCP_TOKEN_SECRET (or ENCRYPTION_MASTER_KEY) must be configured in production."
    );
  }

  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from("dev-testing-mcp-token-secret-32-chars!"),
      Buffer.from("arthax-mcp-token-salt"),
      Buffer.from("personal-mcp-bearer-v1"),
      32
    )
  );
}

/**
 * Mints an HMAC-SHA256 signed personal MCP bearer token bound strictly to one userId.
 */
export function createPersonalMcpToken(
  userId: string,
  ttlSeconds: number = DEFAULT_MCP_TOKEN_TTL_SECONDS
): string {
  const cleanUserId = userId?.trim();
  if (!cleanUserId) {
    throw new Error("[MCP Security] userId is required to mint an MCP token.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload: PersonalMcpTokenPayload = {
    sub: cleanUserId,
    iat: nowSec,
    exp: nowSec + Math.max(60, ttlSeconds),
    scope: "mcp",
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const key = getMcpSigningKey();
  const sig = crypto.createHmac("sha256", key).update(payloadB64).digest("base64url");
  return `${MCP_TOKEN_PREFIX}${payloadB64}.${sig}`;
}

/**
 * Verifies signature, format, scope, and expiration of a personal MCP bearer token.
 */
export function verifyPersonalMcpToken(token: string): PersonalMcpTokenPayload | null {
  if (!token || typeof token !== "string" || !token.startsWith(MCP_TOKEN_PREFIX)) {
    return null;
  }

  const body = token.slice(MCP_TOKEN_PREFIX.length);
  const dotIdx = body.indexOf(".");
  if (dotIdx <= 0 || dotIdx === body.length - 1) {
    return null;
  }

  const payloadB64 = body.slice(0, dotIdx);
  const sig = body.slice(dotIdx + 1);

  try {
    const key = getMcpSigningKey();
    const expectedSig = crypto.createHmac("sha256", key).update(payloadB64).digest("base64url");
    if (!constantTimeCompare(sig, expectedSig)) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as Partial<PersonalMcpTokenPayload>;

    if (
      !decoded ||
      typeof decoded.sub !== "string" ||
      !decoded.sub.trim() ||
      decoded.scope !== "mcp" ||
      typeof decoded.exp !== "number"
    ) {
      return null;
    }

    if (Math.floor(Date.now() / 1000) > decoded.exp) {
      return null;
    }

    return decoded as PersonalMcpTokenPayload;
  } catch {
    return null;
  }
}
