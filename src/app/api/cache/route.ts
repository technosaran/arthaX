import { NextRequest, NextResponse } from "next/server";
import { getCachedData, setCachedData, invalidateCachedData } from "@/utils/redis";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

// Safe cache key validator: must start with arthax:cache: and contain only safe chars
function isValidKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (key.length > 256) return false;
  return /^arthax:cache:[a-zA-Z0-9_\-:]+$/.test(key);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawKey = searchParams.get("key");

  if (!rawKey || !rawKey.trim()) {
    return NextResponse.json(
      { error: "Missing cache key" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const key = rawKey.trim();
  if (!isValidKey(key)) {
    return NextResponse.json(
      { error: "Invalid cache key format" },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const data = await getCachedData(key);
  return NextResponse.json(
    { key, data, hit: data !== null },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { key, value, ttl = 3600 } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid cache key" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const trimmedKey = key.trim();
    if (!isValidKey(trimmedKey)) {
      return NextResponse.json(
        { error: "Invalid cache key format" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const numericTtl = typeof ttl === "number" && ttl > 0 && ttl <= 86400 * 7 ? ttl : 3600;
    await setCachedData(trimmedKey, value, numericTtl);

    return NextResponse.json(
      { success: true, key: trimmedKey },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cache set failed" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(req: NextRequest) {
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
      // Try body JSON
      try {
        const body = await req.json();
        if (Array.isArray(body?.keys)) {
          keysToDelete = body.keys.map((k: any) => String(k).trim()).filter(Boolean);
        } else if (body?.key) {
          keysToDelete = [String(body.key).trim()];
        }
      } catch {
        // empty body
      }
    }

    const validatedKeys = keysToDelete.filter(isValidKey);

    if (validatedKeys.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid cache keys" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    await invalidateCachedData(validatedKeys);
    return NextResponse.json(
      { success: true, invalidated: validatedKeys },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cache invalidation failed" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
