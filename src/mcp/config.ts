/**
 * arthaX MCP Server Configuration
 * Loads environment variables and ensures required database and multi-tenant credentials exist.
 */

export interface McpConfig {
  supabaseUrl: string;
  supabaseKey: string;
  userId: string;
}

export function getMcpConfig(): McpConfig {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase configuration missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment or .env.local"
    );
  }

  const userId =
    process.env.ARTHAX_USER_ID ||
    process.env.USER_ID ||
    "default-arthax-user";

  return {
    supabaseUrl,
    supabaseKey,
    userId,
  };
}
