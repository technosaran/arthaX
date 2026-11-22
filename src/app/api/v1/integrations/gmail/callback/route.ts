import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { encryptSensitiveData } from "@/utils/crypto";
import { invalidateUserCaches } from "@/lib/backend/cacheInvalidation";
import { getAuthenticatedUser } from "@/utils/auth";
import { getTrustedOrigin, getOAuthStateSigningSecret } from "../oauth/route";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const baseOrigin = getTrustedOrigin(req);
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Helper response builder that ensures cleanup of temporary OAuth cookies
  const buildRedirectResponse = (url: string) => {
    const res = NextResponse.redirect(url);
    res.cookies.delete("arthax_oauth_verifier");
    res.cookies.delete("arthax_oauth_nonce");
    return res;
  };

  // 1. Surface direct Google error if present
  if (error) {
    console.error("[Gmail OAuth Callback] Google OAuth error:", error, errorDescription);
    return buildRedirectResponse(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return buildRedirectResponse(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Missing authorization code or state from Google")}`
    );
  }

  // 2. Validate cryptographic signature, expiration, and one-time nonce consumption
  let userId: string;
  let nonce: string | undefined;

  try {
    const signingSecret = getOAuthStateSigningSecret();
    const rawState = Buffer.from(state, "base64url").toString("utf-8");
    const parsedState = JSON.parse(rawState);

    const expectedSig = crypto.createHmac("sha256", signingSecret).update(parsedState.payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(parsedState.sig || ""), Buffer.from(expectedSig))) {
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
    nonce = payload.nonce;

    // 2b. Session Binding: Validate current session matches initiating user if session exists
    const currentAuth = await getAuthenticatedUser(req);
    if (currentAuth.userId && currentAuth.userId !== userId) {
      throw new Error("Security Alert: User session mismatch. Re-authentication required.");
    }

    // 2c. Enforce one-time state consumption
    const cookieNonce = req.cookies.get("arthax_oauth_nonce")?.value;
    if (nonce) {
      if (cookieNonce && cookieNonce !== nonce) {
        throw new Error("CSRF state nonce mismatch between cookie and state payload.");
      }

      // Check server-side one-time consumption RPC if table is present
      try {
        const { data: consumed, error: nonceRpcErr } = await supabaseAdmin.rpc("fn_consume_oauth_nonce", {
          p_user_id: userId,
          p_nonce: nonce,
        });

        if (!nonceRpcErr && consumed === false) {
          throw new Error("OAuth state has already been used or has expired. Please initiate a new connection.");
        }
      } catch (rpcErr: unknown) {
        if (rpcErr instanceof Error && rpcErr.message.includes("OAuth state has already been used")) {
          throw rpcErr;
        }
      }
    }
  } catch (stateErr: unknown) {
    const msg = stateErr instanceof Error ? stateErr.message : "Invalid OAuth state";
    console.error("[Gmail OAuth Callback] State verification failed:", msg);
    return buildRedirectResponse(`${baseOrigin}/?tab=settings&error=${encodeURIComponent(msg)}`);
  }

  // 3. Exchange code for Google OAuth tokens using PKCE verifier if available
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = `${baseOrigin}/api/v1/integrations/gmail/callback`;
  const codeVerifier = req.cookies.get("arthax_oauth_verifier")?.value;

  if (!clientId || !clientSecret) {
    console.error("[Gmail OAuth Callback] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing on server");
    return buildRedirectResponse(
      `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Server Google OAuth credentials missing")}`
    );
  }

  try {
    const tokenRequestBody: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    if (codeVerifier) {
      tokenRequestBody.code_verifier = codeVerifier;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenRequestBody),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Gmail OAuth Callback] Token exchange failed:", tokenRes.status, errText);
      return buildRedirectResponse(
        `${baseOrigin}/?tab=settings&error=${encodeURIComponent(`Google token exchange failed (${tokenRes.status})`)}`
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!accessToken) {
      return buildRedirectResponse(
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

    // 5. Encrypt tokens at rest using dedicated master key
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
      return buildRedirectResponse(
        `${baseOrigin}/?tab=settings&error=${encodeURIComponent("Database error saving Google integration tokens")}`
      );
    }

    await invalidateUserCaches(userId, ["ACCOUNTS", "PORTFOLIO", "LEDGER"]);

    return buildRedirectResponse(`${baseOrigin}/?tab=settings&connected=gmail`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected failure during Google authentication";
    console.error("[Gmail OAuth Callback] Exception during token processing:", msg);
    return buildRedirectResponse(`${baseOrigin}/?tab=settings&error=${encodeURIComponent(msg)}`);
  }
}
