import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (process.env.NODE_ENV === "test" || process.env.VITEST
    ? "https://example.supabase.co"
    : "");

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (process.env.NODE_ENV === "test" || process.env.VITEST ? "test-dummy-service-role-key" : "");

export const isServiceRoleConfigured = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY
);

if (!isServiceRoleConfigured && process.env.NODE_ENV !== "test") {
  console.warn(
    "[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not defined. Admin operations will execute under publishable anon scope with RLS constraints."
  );
}

/**
 * Server-side Supabase client with elevated service privileges for automated webhooks and background jobs.
 * Bypasses RLS when SUPABASE_SERVICE_ROLE_KEY is provided in environment variables.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
