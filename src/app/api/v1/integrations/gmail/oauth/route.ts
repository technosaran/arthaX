import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { supabaseAdmin } from "@/utils/supabase/admin";
import {
  getOAuthStateSigningSecret,
  createSignedOAuthState,
  getTrustedOrigin,
} from "@/utils/oauthSecurity";
import crypto from "crypto";

// Re-export for route/test compatibility
export { getOAuthStateSigningSecret, getTrustedOrigin };

export async function GET(req: NextRequest) {
  const baseOrigin = getTrustedOrigin(req);

  // 1. Authenticate user from session cookies or authorization header
  const auth = await getAuthenticatedUser(req);
  if (!auth.user || !auth.userId) {
    return NextResponse.redirect(`${baseOrigin}/login?next=/?tab=settings`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
  if (!clientId) {
    console.error("[Gmail OAuth] GOOGLE_CLIENT_ID is not configured in environment variables.");
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Google Client ID not configured on server")}`
    );
  }

  // 2. Validate dedicated OAuth signing secret configuration (fail-closed in production)
  try {
    getOAuthStateSigningSecret();
  } catch (err: unknown) {
    console.error("[Gmail OAuth] Server secret configuration error:", err);
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Server security configuration missing: OAUTH_STATE_SECRET required")}`
    );
  }

  // 3. Generate PKCE code_verifier and code_challenge (RFC 7636)
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  // 4. Generate cryptographically unpredictable nonce for one-time state consumption
  const nonce = crypto.randomBytes(24).toString("hex");

  // Store in database for server-side one-time consumption (Fail closed on database errors)
  const { error: nonceInsertErr } = await supabaseAdmin.from("oauth_state_nonces").insert({
    user_id: auth.userId,
    nonce,
    code_challenge: codeChallenge,
    code_verifier_hash: crypto.createHash("sha256").update(codeVerifier).digest("hex"),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });

  if (nonceInsertErr) {
    console.error("[Gmail OAuth] Nonce persistence failed in database:", nonceInsertErr);
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Database error: Unable to record one-time OAuth nonce. Failing closed.")}`
    );
  }

  // 5. Generate cryptographically signed state containing userId, nonce, and expiration
  const state = createSignedOAuthState({
    userId: auth.userId,
    nonce,
    expiresInSeconds: 900, // 15 minutes
  });

  // 6. Construct direct Google OAuth authorization URL with PKCE
  const redirectUri = `${baseOrigin}/api/v1/integrations/gmail/callback`;
  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "email",
    "profile",
    "openid",
  ].join(" ");

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", scopes);
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("code_challenge", codeChallenge);
  googleAuthUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(googleAuthUrl.toString());

  // Bind PKCE verifier and nonce to HTTP-only secure cookies
  const isSecure = process.env.NODE_ENV === "production";
  response.cookies.set("arthax_oauth_verifier", codeVerifier, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 900, // 15 minutes
  });
  response.cookies.set("arthax_oauth_nonce", nonce, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });

  return response;
}
