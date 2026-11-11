import { NextRequest, NextResponse } from "next/server";
import { getCachedData, setCachedData, invalidateCachedData } from "@/utils/redis";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: "Missing cache key" },
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
    const body = await req.json();
    const { key, value, ttl = 3600 } = body;

    if (!key) {
      return NextResponse.json(
        { error: "Missing cache key" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    await setCachedData(key, value, ttl);
    return NextResponse.json({ success: true, key }, { headers: NO_CACHE_HEADERS });
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

    if (keysToDelete.length === 0) {
      return NextResponse.json(
        { error: "Missing cache key or keys" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    await invalidateCachedData(keysToDelete);
    return NextResponse.json(
      { success: true, invalidated: keysToDelete },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cache invalidation failed" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
