/**
 * Ultra-Fast Multi-Tier Hybrid Cache for arthaX
 * Tier 1: In-Memory Map (0.001 ms)
 * Tier 2: LocalStorage (0.1 ms - instant across page refreshes)
 * Tier 3: Upstash Redis via /api/cache (background asynchronous cloud sync)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Synchronous instant retrieval from Tier 1 (Memory) or Tier 2 (LocalStorage)
 * Latency: 0ms (no async/await needed)
 */
export function getFromLocalCache<T>(key: string): T | null {
  if (typeof window === "undefined" || !key) return null;

  const now = Date.now();

  // Tier 1: Check memory cache (0.001ms)
  const mem = memoryCache.get(key);
  if (mem) {
    if (now - mem.timestamp < mem.ttl) {
      return mem.data as T;
    }
    memoryCache.delete(key);
  }

  // Tier 2: Check localStorage (0.1ms)
  try {
    const raw = window.localStorage.getItem(`arthax_c_${key}`);
    if (raw) {
      const parsed: CacheEntry<T> = JSON.parse(raw);
      if (now - parsed.timestamp < parsed.ttl) {
        // Hydrate memory cache for even faster subsequent reads
        memoryCache.set(key, parsed);
        return parsed.data;
      }
      window.localStorage.removeItem(`arthax_c_${key}`);
    }
  } catch {
    // Non-blocking quota or private mode fallback
  }

  return null;
}

/**
 * Save to Tier 1 and Tier 2 synchronously (0ms)
 */
export function saveToLocalCache<T>(key: string, value: T, ttlSeconds: number = 3600): void {
  if (typeof window === "undefined" || !key || value === undefined) return;

  const entry: CacheEntry<T> = {
    data: value,
    timestamp: Date.now(),
    ttl: ttlSeconds * 1000,
  };

  // Tier 1: Memory
  memoryCache.set(key, entry);

  // Tier 2: LocalStorage
  try {
    window.localStorage.setItem(`arthax_c_${key}`, JSON.stringify(entry));
  } catch {
    // Non-blocking quota fallback
  }
}

/**
 * Async fetch helper: checks Tier 1/2 first, falls back to /api/cache with a fast timeout (800ms)
 */
export async function fetchFromCache<T>(key: string): Promise<T | null> {
  if (!key) return null;

  // 1. Instant local check
  const local = getFromLocalCache<T>(key);
  if (local !== null) {
    return local;
  }

  // 2. Fallback to API cache with 800ms timeout so it NEVER delays the app
  if (typeof window !== "undefined") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);

      const res = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.hit && json.data !== null && json.data !== undefined) {
          saveToLocalCache(key, json.data, 3600);
          return json.data as T;
        }
      }
    } catch {
      // Non-blocking timeout or error
    }
  }

  return null;
}

/**
 * Save data: Immediately writes to local memory + localStorage (0ms),
 * and syncs to Upstash Redis in the background without blocking the UI.
 */
export async function saveToCache<T>(
  key: string,
  value: T,
  ttl: number = 3600
): Promise<void> {
  if (!key || value === undefined) return;

  // Instant local save
  saveToLocalCache(key, value, ttl);

  // Asynchronous background cloud sync (fire & forget)
  if (typeof window !== "undefined") {
    fetch("/api/cache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, value, ttl }),
    }).catch(() => {});
  }
}

/**
 * Invalidate cache keys across Tier 1, Tier 2, and cloud Redis
 */
export async function invalidateCacheKeys(keys: string | string[]): Promise<void> {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (list.length === 0) return;

  // Instant local purge
  if (typeof window !== "undefined") {
    for (const key of list) {
      memoryCache.delete(key);
      try {
        window.localStorage.removeItem(`arthax_c_${key}`);
      } catch {}
    }

    // Async background purge in Redis
    fetch(`/api/cache?keys=${encodeURIComponent(list.join(","))}`, {
      method: "DELETE",
    }).catch(() => {});
  }
}
