import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/utils/auth";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  const baseOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  // 1. Authenticate user from session cookies or authorization header
  const auth = await getAuthenticatedUser(req);
  if (!auth.user || !auth.userId) {
    return NextResponse.redirect(`${baseOrigin}/login?next=/?tab=settings`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[Gmail OAuth] GOOGLE_CLIENT_ID is not configured in environment variables.");
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Google Client ID not configured on server")}`
    );
  }

  // 2. Generate cryptographically signed state containing userId and expiration (15 minutes)
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "arthax-oauth-state-signing-secret";
  const statePayload = JSON.stringify({
    userId: auth.userId,
    exp: Date.now() + 15 * 60 * 1000,
  });
  const sig = crypto.createHmac("sha256", secret).update(statePayload).digest("hex");
  const state = Buffer.from(JSON.stringify({ payload: statePayload, sig })).toString("base64url");

  // 3. Construct direct Google OAuth authorization URL
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

  return NextResponse.redirect(googleAuthUrl.toString());
}
