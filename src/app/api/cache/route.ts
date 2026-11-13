import { NextRequest, NextResponse } from "next/server";
import { getCachedData, setCachedData, invalidateCachedData } from "@/utils/redis";
import { getAuthenticatedUser } from "@/utils/auth";
import { z } from "zod";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

// Safe cache key validator: must start with arthax:cache:<userId>:
function isUserKeyAllowed(key: string, userId: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (key.length > 256) return false;
  const userPrefix = `arthax:cache:${userId}:`;
  return key.startsWith(userPrefix);
}

const PostCacheSchema = z.object({
  key: z.string().min(1).max(256),
  value: z.unknown(),
  ttl: z.number().int().positive().max(86400 * 7).default(3600),
});

export async function GET(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required to access cache", details: authError },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawKey = searchParams.get("key");

  if (!rawKey || !rawKey.trim()) {
    return NextResponse.json(
      { error: "Missing cache key" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const key = rawKey.trim();
  if (!isUserKeyAllowed(key, userId)) {
    return NextResponse.json(
      { error: "Forbidden: Access to another tenant's cache is denied." },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  const data = await getCachedData(key);
  return NextResponse.json(
    { key, data, hit: data !== null },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required to write to cache", details: authError },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    let jsonBody: unknown;
    try {
      jsonBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const parseResult = PostCacheSchema.safeParse(jsonBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { key, value, ttl } = parseResult.data;
    const trimmedKey = key.trim();

    if (!isUserKeyAllowed(trimmedKey, userId)) {
      return NextResponse.json(
        { error: "Forbidden: Cannot write into another tenant's cache partition." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    await setCachedData(trimmedKey, value, ttl);

    return NextResponse.json(
      { success: true, key: trimmedKey },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cache set failed";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { user, userId, error: authError } = await getAuthenticatedUser(req);
  if (!user || !userId) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required to invalidate cache", details: authError },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const keysParam = searchParams.get("keys");

    let keysToDelete: string[] = [];

    if (keysParam) {
      keysToDelete = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
    } else if (key) {
      keysToDelete = [key.trim()];
    } else {
      try {
        const body = await req.json();
        if (Array.isArray(body?.keys)) {
          keysToDelete = body.keys.map((k: unknown) => String(k).trim()).filter(Boolean);
        } else if (body?.key) {
          keysToDelete = [String(body.key).trim()];
        }
      } catch {
        // empty body
      }
    }

    // Only allow deletion of keys that strictly belong to the current authenticated user
    const validatedKeys = keysToDelete.filter((k) => isUserKeyAllowed(k, userId));

    if (validatedKeys.length === 0) {
      return NextResponse.json(
        { error: "No authorized cache keys provided for invalidation" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    await invalidateCachedData(validatedKeys);
    return NextResponse.json(
      { success: true, invalidated: validatedKeys },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cache invalidation failed";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
