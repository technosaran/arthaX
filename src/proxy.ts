import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  // 1. Process Supabase Edge session validation and redirection
  const response = await updateSession(request);

  // 2. Apply Enterprise-Grade Security Headers (OWASP Top 10 & FinTech Compliance)
  const headers = response.headers;

  // Anti-Clickjacking: Disallow framing entirely
  headers.set("X-Frame-Options", "DENY");

  // MIME type sniffing prevention
  headers.set("X-Content-Type-Options", "nosniff");

  // Referrer leakage prevention
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict sensitive browser APIs
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()"
  );

  // Strict Transport Security (HSTS) with 2-year duration and preload
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://*.githubusercontent.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://api.kite.trade",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  headers.set("Content-Security-Policy", cspDirectives.join("; "));

  // 3. Cache Restrictions for Sensitive Financial API Responses
  if (request.nextUrl.pathname.startsWith("/api/")) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt)$).*)",
  ],
};
