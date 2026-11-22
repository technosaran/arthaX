/**
 * arthaX MCP Supabase Database Client
 * Provides scoped database client for MCP operations.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { getMcpConfig, McpConfig } from "./config";

export function getMcpDb(config?: McpConfig): SupabaseClient<Database> {
  const resolved = config || getMcpConfig();
  return createClient<Database>(resolved.supabaseUrl, resolved.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
