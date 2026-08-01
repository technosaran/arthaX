/**
 * High-performance logo caching service with persistent storage (localStorage)
 * and negative lookup caching ("NOT_FOUND") to eliminate redundant network requests.
 * v5: TTL-based expiry to auto-refresh stale/broken URLs.
 */

const CACHE_KEY = "arthax_logo_cache_v5";
const OLD_CACHE_KEYS = ["arthax_logo_cache_v4", "arthax_logo_cache_v3", "arthax_logo_cache_v2"];
export const NOT_FOUND = "NOT_FOUND";

// TTL durations in milliseconds
const SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for successful logos
const NOT_FOUND_TTL_MS = 1 * 24 * 60 * 60 * 1000; // 1 day for NOT_FOUND entries

interface CacheEntry {
  url: string;
  ts: number;
}

// In-memory cache for instant synchronous lookups
const memoryCache = new Map<string, CacheEntry>();
let isStorageLoaded = false;

function loadFromStorage() {
  if (typeof window === "undefined" || isStorageLoaded) return;
  try {
    // Clean up old cache versions
    for (const oldKey of OLD_CACHE_KEYS) {
      localStorage.removeItem(oldKey);
    }

    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: Record<string, CacheEntry | string> = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        // Handle both new format { url, ts } and legacy string format
        if (typeof v === "string") {
          memoryCache.set(k, { url: v, ts: Date.now() });
        } else {
          memoryCache.set(k, v);
        }
      }
    }
  } catch (_e) {
    // Ignore storage read errors
  }
  isStorageLoaded = true;
}

function saveToStorage() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, CacheEntry> = {};
    const entries = Array.from(memoryCache.entries()).slice(-500);
    for (const [k, v] of entries) {
      obj[k] = v;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (_e) {
    // Ignore storage quota errors
  }
}

function isExpired(entry: CacheEntry): boolean {
  const ttl = entry.url === NOT_FOUND ? NOT_FOUND_TTL_MS : SUCCESS_TTL_MS;
  return Date.now() - entry.ts > ttl;
}

/**
 * Get cached logo URL or NOT_FOUND state. Returns null if not cached or expired.
 */
export function getCachedLogo(queryOrDomain: string): string | null {
  if (!queryOrDomain) return null;
  const key = queryOrDomain.trim().toLowerCase();
  loadFromStorage();
  const entry = memoryCache.get(key);
  if (!entry) return null;

  // Check TTL expiry
  if (isExpired(entry)) {
    memoryCache.delete(key);
    return null;
  }

  return entry.url;
}

/**
 * Store successful logo URL in cache with timestamp
 */
export function setCachedLogo(queryOrDomain: string, url: string): void {
  if (!queryOrDomain) return;
  const key = queryOrDomain.trim().toLowerCase();
  loadFromStorage();
  memoryCache.set(key, { url, ts: Date.now() });
  saveToStorage();
}

/**
 * Mark a domain/query as temporarily failed to prevent retries (1 day TTL)
 */
export function setCachedLogoNotFound(queryOrDomain: string): void {
  setCachedLogo(queryOrDomain, NOT_FOUND);
}

/**
 * Check if a domain/query is cached as NOT_FOUND (and not expired)
 */
export function isLogoNotFound(queryOrDomain: string): boolean {
  return getCachedLogo(queryOrDomain) === NOT_FOUND;
}
