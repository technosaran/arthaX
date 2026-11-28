import { createClient, SupabaseClient } from "@supabase/supabase-js";

function resolveSupabaseAdminConfig() {
  const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    (isTest ? "https://example.supabase.co" : "");

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (isTest ? "test-dummy-service-role-key" : "");

  return { supabaseUrl, supabaseServiceKey };
}

export const isServiceRoleConfigured = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY
);

let cachedClient: SupabaseClient | null = null;
let cachedConfigSignature = "";

/**
 * Lazily creates the server-side Supabase admin client on first runtime access
 * so build-time module evaluation (e.g. `next build`) succeeds without live env vars.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const { supabaseUrl, supabaseServiceKey } = resolveSupabaseAdminConfig();
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL and a Supabase API key are required at runtime."
    );
  }

  const sig = `${supabaseUrl}::${supabaseServiceKey}`;
  if (cachedClient && cachedConfigSignature === sig) {
    return cachedClient;
  }

  if (!isServiceRoleConfigured && process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    console.warn(
      "[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not defined. Admin operations will execute under publishable anon scope with RLS constraints."
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  cachedConfigSignature = sig;
  return cachedClient;
}

/**
 * Server-side Supabase client with elevated service privileges for automated webhooks and background jobs.
 * Bypasses RLS when SUPABASE_SERVICE_ROLE_KEY is provided in environment variables.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
