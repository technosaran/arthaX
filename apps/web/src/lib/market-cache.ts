/**
 * Global High-Performance Market Data Cache Layer
 * Provides fast in-memory TTL caching with optional Redis support.
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

// Global in-memory cache store (survives hot-reloading in dev and reuses process memory in production)
const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data by key if not expired
 */
export async function getMarketCache<T>(key: string): Promise<T | null> {
  const entry = memoryCache.get(key);
  if (entry) {
    if (Date.now() < entry.expiresAt) {
      return entry.data as T;
    }
    memoryCache.delete(key);
  }
  return null;
}

/**
 * Set market cache with specified TTL in seconds (default: 60s)
 */
export async function setMarketCache<T>(key: string, data: T, ttlSeconds: number = 60): Promise<void> {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Helper to fetch with market caching wrapper
 */
export async function fetchWithMarketCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const cached = await getMarketCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fetcher();
  if (fresh !== null && fresh !== undefined) {
    await setMarketCache(key, fresh, ttlSeconds);
  }
  return fresh;
}

/**
 * Periodically clean up expired entries to prevent memory leaks.
 * Expired keys are only removed on explicit re-request otherwise.
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now >= entry.expiresAt) {
      memoryCache.delete(key);
    }
  }
}

// Run cleanup every 60 seconds
const _gcInterval = setInterval(cleanupExpiredEntries, 60000);
if (_gcInterval.unref) _gcInterval.unref();
