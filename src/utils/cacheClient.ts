/**
 * High-reliability client-side cache helper for arthaX
 * Guarantees zero browser HTTP caching via cache: "no-store" and Cache-Control headers
 */

export async function fetchFromCache<T>(key: string): Promise<T | null> {
  if (!key) return null;
  try {
    const res = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json.hit && json.data !== null && json.data !== undefined) {
      return json.data as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveToCache<T>(
  key: string,
  value: T,
  ttl: number = 3600
): Promise<void> {
  if (!key || value === undefined) return;
  try {
    await fetch("/api/cache", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
      body: JSON.stringify({ key, value, ttl }),
    });
  } catch {
    // Non-blocking
  }
}

export async function invalidateCacheKeys(keys: string | string[]): Promise<void> {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (list.length === 0) return;

  try {
    await fetch(`/api/cache?keys=${encodeURIComponent(list.join(","))}`, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch {
    // Non-blocking
  }
}
