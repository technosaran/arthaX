import { NextRequest, NextResponse } from "next/server";
import { User } from "@supabase/supabase-js";
import { z } from "zod";

export type AuthMode = "required" | "optional" | "admin" | "cron" | "none";

export interface RateLimitOptions {
  limit?: number;
  windowSeconds?: number;
  keyPrefix?: string;
}

export interface ApiContext<TBody = unknown, TParams = Record<string, string>> {
  req: NextRequest;
  requestId: string;
  user: User | null;
  userId: string | null;
  body: TBody;
  params: TParams;
  query: URLSearchParams;
  startTime: number;
}

export interface RouteConfig<TBody = unknown, TParams = Record<string, string>> {
  /**
   * Authentication requirement:
   * - "required" (default): Must be logged in via Supabase Bearer token or session cookie.
   * - "optional": Populates user/userId if authenticated, but allows unauthenticated access.
   * - "admin": Requires ADMIN_API_KEY, CRON_SECRET, or matching ADMIN_USER_ID.
   * - "cron": Requires Authorization: Bearer CRON_SECRET or Vercel cron header.
   * - "none": Public route without auth checks.
   */
  auth?: AuthMode;

  /**
   * Rate limiting configuration. Set to false to disable for this route.
   */
  rateLimit?: RateLimitOptions | false;

  /**
   * When true, checks the Idempotency-Key header to prevent duplicate execution.
   */
  idempotent?: boolean;

  /**
   * Maximum allowed JSON body size in bytes (default: 2MB).
   */
  maxBodySize?: number;

  /**
   * Optional Zod schema to validate incoming request JSON body.
   * If validation fails, automatically responds with 422 VALIDATION_ERROR.
   */
  schema?: z.ZodSchema<TBody>;

  /**
   * The core route business logic handler.
   * Can return a NextResponse directly or return raw data which will be
   * automatically wrapped in a standardized apiSuccess(data) envelope.
   */
  handler: (ctx: ApiContext<TBody, TParams>) => Promise<NextResponse | unknown>;
}
