/**
 * Client-side utility to get CSRF token from meta tag or cookie.
 * Strictly browser-safe with zero server imports (`next/headers`).
 */

const CSRF_TOKEN_NAME = "csrf_token";

export function getClientCsrfToken(): string | null {
  if (typeof window === "undefined") return null;

  // Try to get from meta tag first
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    return metaTag.getAttribute("content");
  }

  // Fallback: parse from cookies
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === CSRF_TOKEN_NAME) {
      return value;
    }
  }

  return null;
}
