import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=Google%20OAuth%20Client%20ID%20is%20not%20configured%20on%20the%20server", req.url));
  }

  // Get current user to attach userId to OAuth state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=Please%20log%20in%20to%20connect%20Gmail", req.url));
  }

  // Construct target redirect URI dynamically based on request origin / NEXT_PUBLIC_SITE_URL
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isEnvLocalhost = !rawSiteUrl || rawSiteUrl.includes("localhost");
  const isReqRemote = !req.nextUrl.origin.includes("localhost");
  const siteUrl = (isEnvLocalhost && isReqRemote ? req.nextUrl.origin : (rawSiteUrl || req.nextUrl.origin)).replace(/\/$/, "");
  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  // Scopes requested (Gmail read-only to fetch transaction alerts)
  // gmail.modify is required because we mark messages as read after processing
  const scope = "https://www.googleapis.com/auth/gmail.modify";

  const googleOAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleOAuthUrl.searchParams.append("client_id", clientId);
  googleOAuthUrl.searchParams.append("redirect_uri", redirectUri);
  googleOAuthUrl.searchParams.append("response_type", "code");
  googleOAuthUrl.searchParams.append("scope", scope);
  googleOAuthUrl.searchParams.append("access_type", "offline"); // Crucial to obtain a refresh token
  googleOAuthUrl.searchParams.append("prompt", "consent"); // Force consent to guarantee a new refresh token
  
  // CSRF Protection & User Binding: state = `${user.id}:${randomUUID()}`
  const randomState = crypto.randomUUID();
  const fullState = `${user.id}:${randomState}`;
  googleOAuthUrl.searchParams.append("state", fullState);

  const response = NextResponse.redirect(googleOAuthUrl.toString());

  // Copy incoming cookies to preserve session across redirect
  req.cookies.getAll().forEach((c) => {
    response.cookies.set(c.name, c.value, { path: "/", sameSite: "lax" });
  });

  response.cookies.set("gmail_oauth_state", randomState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
