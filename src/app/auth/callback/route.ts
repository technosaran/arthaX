import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";

  // Prevent CWE-601 Open Redirect vulnerabilities
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  // Determine correct public origin (handles Vercel / reverse proxy headers)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const baseOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Auth Callback] Missing Supabase environment configuration.");
      return NextResponse.redirect(`${baseOrigin}/login?error=missing_config`);
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handled in server components/routes
          }
        },
      },
    });

    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && authData?.session) {
      const session = authData.session;
      const providerToken = (session as any).provider_token;
      const providerRefreshToken = (session as any).provider_refresh_token;
      const user = session.user;

      if (providerToken && user?.id) {
        try {
          const { supabaseAdmin } = await import("@/utils/supabase/admin");
          const { encryptSensitiveData } = await import("@/utils/crypto");
          const encAccess = encryptSensitiveData(providerToken, "gmail-tokens");
          const encRefresh = providerRefreshToken ? encryptSensitiveData(providerRefreshToken, "gmail-tokens") : null;
          await supabaseAdmin.from("gmail_integrations").upsert(
            {
              user_id: user.id,
              email_address: user.email?.toLowerCase() || "",
              access_token_encrypted: encAccess,
              refresh_token_encrypted: encRefresh,
              sync_status: "ACTIVE",
              error_details: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        } catch (tokenErr) {
          console.warn("[Auth Callback] Failed to store Google provider tokens:", tokenErr);
        }
      }

      return NextResponse.redirect(`${baseOrigin}${safeNext}`);
    }

    console.error("[Auth Callback] Error exchanging code for session:", error?.message || "No session returned");
  }

  return NextResponse.redirect(`${baseOrigin}/login?error=auth_callback_failed`);
}
