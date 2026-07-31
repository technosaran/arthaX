/**
 * High-performance logo caching service with persistent storage (localStorage)
 * and negative lookup caching ("NOT_FOUND") to eliminate redundant network requests.
 */

const CACHE_KEY = "arthax_logo_cache_v4";
export const NOT_FOUND = "NOT_FOUND";

// In-memory cache for instant synchronous lookups
const memoryCache = new Map<string, string>();
let isStorageLoaded = false;

function loadFromStorage() {
  if (typeof window === "undefined" || isStorageLoaded) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: Record<string, string> = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        memoryCache.set(k, v);
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
    const obj: Record<string, string> = {};
    const entries = Array.from(memoryCache.entries()).slice(-500);
    for (const [k, v] of entries) {
      obj[k] = v;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (_e) {
    // Ignore storage quota errors
  }
}

/**
 * Get cached logo URL or NOT_FOUND state
 */
export function getCachedLogo(queryOrDomain: string): string | null {
  if (!queryOrDomain) return null;
  const key = queryOrDomain.trim().toLowerCase();
  loadFromStorage();
  return memoryCache.get(key) || null;
}

/**
 * Store successful logo URL or negative lookup state in cache
 */
export function setCachedLogo(queryOrDomain: string, url: string): void {
  if (!queryOrDomain) return;
  const key = queryOrDomain.trim().toLowerCase();
  loadFromStorage();
  memoryCache.set(key, url);
  saveToStorage();
}

/**
 * Mark a domain/query as permanently failed to prevent future retries
 */
export function setCachedLogoNotFound(queryOrDomain: string): void {
  setCachedLogo(queryOrDomain, NOT_FOUND);
}

/**
 * Check if a domain/query is cached as NOT_FOUND
 */
export function isLogoNotFound(queryOrDomain: string): boolean {
  return getCachedLogo(queryOrDomain) === NOT_FOUND;
}
