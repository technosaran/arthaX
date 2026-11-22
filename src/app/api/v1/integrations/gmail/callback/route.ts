import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { encryptSensitiveData } from "@/utils/crypto";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  const baseOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 1. Surface direct Google error if present
  if (error) {
    console.error("[Gmail OAuth Callback] Google OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Missing authorization code or state from Google")}`
    );
  }

  // 2. Validate cryptographic signature and expiration of state parameter
  let userId: string;
  try {
    const rawState = Buffer.from(state, "base64url").toString("utf-8");
    const parsedState = JSON.parse(rawState);
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "arthax-oauth-state-signing-secret";
    const expectedSig = crypto.createHmac("sha256", secret).update(parsedState.payload).digest("hex");

    if (parsedState.sig !== expectedSig) {
      throw new Error("Invalid state signature");
    }

    const payload = JSON.parse(parsedState.payload);
    if (!payload.userId) {
      throw new Error("Invalid user ID in state");
    }
    if (payload.exp && Date.now() > payload.exp) {
      throw new Error("OAuth state expired. Please try connecting again.");
    }

    userId = payload.userId;
  } catch (stateErr: any) {
    console.error("[Gmail OAuth Callback] State verification failed:", stateErr?.message);
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent(stateErr?.message || "Invalid OAuth state")}`
    );
  }

  // 3. Exchange code for Google OAuth tokens
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseOrigin}/api/v1/integrations/gmail/callback`;

  if (!clientId || !clientSecret) {
    console.error("[Gmail OAuth Callback] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing on server");
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Server Google OAuth credentials missing")}`
    );
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Gmail OAuth Callback] Token exchange failed:", tokenRes.status, errText);
      return NextResponse.redirect(
        `${baseOrigin}/?tab=settings&error=${encodeURIComponent(`Google token exchange failed (${tokenRes.status})`)}`
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!accessToken) {
      return NextResponse.redirect(
        `${baseOrigin}/?tab=settings&error=${encodeURIComponent("No access token returned by Google")}`
      );
    }

    // 4. Retrieve connected user's primary email address
    let emailAddress = "";
    try {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userinfoRes.ok) {
        const userInfo = await userinfoRes.json();
        emailAddress = userInfo.email || "";
      }
    } catch (uErr) {
      console.warn("[Gmail OAuth Callback] Could not fetch user email:", uErr);
    }

    // 5. Encrypt tokens and upsert into database
    const encAccess = encryptSensitiveData(accessToken, "gmail-tokens");
    const encRefresh = refreshToken ? encryptSensitiveData(refreshToken, "gmail-tokens") : null;
    const tokenExpiry = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

    const dbPayload: Record<string, any> = {
      user_id: userId,
      access_token_encrypted: encAccess,
      token_expiry: tokenExpiry,
      sync_status: "ACTIVE",
      error_details: null,
      updated_at: new Date().toISOString(),
    };

    if (emailAddress) {
      dbPayload.email_address = emailAddress.toLowerCase();
    }
    if (encRefresh) {
      dbPayload.refresh_token_encrypted = encRefresh;
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("gmail_integrations")
      .upsert(dbPayload, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("[Gmail OAuth Callback] Database upsert failed:", upsertErr);
      return NextResponse.redirect(
        `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Database error saving Google integration tokens")}`
      );
    }

    await invalidateUserCaches(userId, ["ACCOUNTS", "PORTFOLIO", "LEDGER"]);

    return NextResponse.redirect(`${baseOrigin}/?tab=settings&connected=gmail`);
  } catch (err: any) {
    console.error("[Gmail OAuth Callback] Exception during token processing:", err);
    return NextResponse.redirect(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent(err?.message || "Unexpected failure during Google authentication")}`
    );
  }
}
