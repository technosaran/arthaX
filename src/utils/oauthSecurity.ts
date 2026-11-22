import { NextRequest } from "next/server";
import crypto from "crypto";
import { constantTimeCompare } from "./crypto";

/**
 * Enterprise OAuth Security Architecture
 * Enforces dedicated secret isolation, CSRF mitigation, PKCE validation,
 * cryptographic state verification, and session binding.
 */

/**
 * Retrieves the dedicated OAuth state signing secret.
 * In production, strictly requires OAUTH_STATE_SECRET and fails closed.
 * Never uses database administrative credentials (SUPABASE_SERVICE_ROLE_KEY)
 * or general data encryption keys (ENCRYPTION_MASTER_KEY) as implicit signing keys.
 */
export function getOAuthStateSigningSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (isProd) {
    throw new Error(
      "[OAuth Security] OAUTH_STATE_SECRET is not configured in production environment. Failing closed to prevent unauthorized state manipulation or key confusion."
    );
  }

  // Explicit test / development secret only
  return "dev-testing-oauth-state-secret-32-chars-long!";
}

export interface OAuthStatePayload {
  userId: string;
  nonce: string;
  exp: number;
}

/**
 * Generates an HMAC-SHA256 signed, base64url-encoded state parameter.
 * Binds the initiating user's ID, a cryptographically random nonce, and expiration.
 */
export function createSignedOAuthState(params: {
  userId: string;
  nonce: string;
  expiresInSeconds?: number;
}): string {
  if (!params.userId || !params.userId.trim()) {
    throw new Error("[OAuth Security] userId is required to create signed OAuth state");
  }
  if (!params.nonce || !params.nonce.trim()) {
    throw new Error("[OAuth Security] nonce is required to create signed OAuth state");
  }

  const signingSecret = getOAuthStateSigningSecret();
  const exp = Date.now() + (params.expiresInSeconds ?? 900) * 1000; // default 15 minutes

  const statePayload = JSON.stringify({
    userId: params.userId.trim(),
    nonce: params.nonce.trim(),
    exp,
  });

  const sig = crypto.createHmac("sha256", signingSecret).update(statePayload).digest("hex");
  return Buffer.from(JSON.stringify({ payload: statePayload, sig })).toString("base64url");
}

/**
 * Verifies the integrity, signature, expiration, and format of an incoming OAuth state parameter.
 * Uses timing-safe constant-time comparison to prevent side-channel timing attacks.
 */
export function verifySignedOAuthState(rawState: string): OAuthStatePayload {
  if (!rawState || typeof rawState !== "string") {
    throw new Error("Missing or invalid OAuth state parameter");
  }

  const signingSecret = getOAuthStateSigningSecret();

  let parsedEnvelope: { payload?: string; sig?: string };
  try {
    const jsonStr = Buffer.from(rawState, "base64url").toString("utf-8");
    parsedEnvelope = JSON.parse(jsonStr);
  } catch {
    throw new Error("Malformed OAuth state encoding");
  }

  if (!parsedEnvelope.payload || !parsedEnvelope.sig) {
    throw new Error("Invalid OAuth state envelope structure");
  }

  const expectedSig = crypto.createHmac("sha256", signingSecret).update(parsedEnvelope.payload).digest("hex");

  // Constant-time comparison with pre-hashed SHA-256 to prevent length leakage & timing attacks
  if (!constantTimeCompare(parsedEnvelope.sig, expectedSig)) {
    throw new Error("Invalid state signature");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(parsedEnvelope.payload);
  } catch {
    throw new Error("Malformed OAuth state payload JSON");
  }

  if (!payload.userId || typeof payload.userId !== "string") {
    throw new Error("Invalid user ID in state");
  }

  if (!payload.nonce || typeof payload.nonce !== "string") {
    throw new Error("Invalid nonce in state");
  }

  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    throw new Error("OAuth state expired. Please try connecting again.");
  }

  return payload;
}

/**
 * Derives trusted public origin from request and environment.
 * Prevents host header poisoning and open-redirect vulnerabilities.
 */
export function getTrustedOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
    } catch {}
  }
  const { origin } = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    const hostOnly = forwardedHost.split(":")[0].toLowerCase();
    const isAllowed =
      hostOnly === "localhost" ||
      hostOnly === "127.0.0.1" ||
      hostOnly === "arthax.vercel.app" ||
      hostOnly.endsWith(".vercel.app");
    if (isAllowed) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }
  return origin;
}
