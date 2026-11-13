import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/utils/supabase/admin";

export interface AuthResult {
  user: User | null;
  userId: string | null;
  error: string | null;
}

/**
 * Validates the authenticated user from cookies or Bearer Authorization header.
 * Always verifies cryptographically with Supabase Auth (getUser).
 */
export async function getAuthenticatedUser(req?: NextRequest): Promise<AuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { user: null, userId: null, error: "Supabase configuration missing" };
  }

  // 1. Check Bearer Authorization token in header
  if (req) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token) {
        const { data: { user }, error: jwtErr } = await supabaseAdmin.auth.getUser(token);
        if (user && !jwtErr) {
          return { user, userId: user.id, error: null };
        }
      }
    }
  }

  // 2. Check HTTP-only session cookies
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op for read-only user resolution
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (user && !error) {
      return { user, userId: user.id, error: null };
    }

    return { user: null, userId: null, error: error?.message || "Unauthorized" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication failed";
    return { user: null, userId: null, error: msg };
  }
}
