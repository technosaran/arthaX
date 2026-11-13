import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Fast bypass for API routes, auth callbacks, and static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")
  );

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

  // Fast-path 1: Unauthenticated request to private routes (e.g. /) without any auth cookies
  // Instantly redirect to /login without waiting for an external Supabase network round-trip (saves 300-800ms TTFB)
  if (!hasAuthCookie && !isAuthRoute) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Fast-path 2: Unauthenticated request to login/auth routes without any auth cookies
  // Instantly proceed without waiting for an external Supabase network round-trip
  if (!hasAuthCookie && isAuthRoute) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do NOT run code between createServerClient and supabase.auth.getUser().
  // A simple mistake could compromise user sessions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is not authenticated and trying to access private application routes (e.g. /)
  if (!user && !isAuthRoute) {
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    // Forward any session cookies refreshed during getUser()
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // If user is already authenticated and visits /login, redirect directly to dashboard /
  if (user && pathname === "/login") {
    url.pathname = "/";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
};
