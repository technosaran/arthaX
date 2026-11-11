import { Redis } from "@upstash/redis";

// Initialize Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "https://glad-chigger-197326.upstash.io",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAAwLOAAIgcDJhZTVmYTczN2I2MGM0MDM5YjhmMTkyN2ViYzNlOTI3Mg",
});

export const CACHE_KEYS = {
  ACCOUNTS: "accounts",
  INCOME: "income",
  EXPENSES: "expenses",
  SETTINGS: "settings",
  PORTFOLIO: "portfolio",
  LEDGER: "ledger",
  BUDGETS: "budgets",
} as const;

// Helper to scope cache keys per user for complete multi-tenant isolation
export const getUserCacheKey = (userId: string | undefined | null, resource: string) => {
  const safeId = userId || "default_user";
  return `arthax:cache:${safeId}:${resource}`;
};

/**
 * Get cached item from Upstash Redis with timeout fallback (max 1000ms)
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const fetchPromise = redis.get<T>(key);
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1000)
    );
    const data = await Promise.race([fetchPromise, timeoutPromise]);
    return data;
  } catch (err) {
    console.warn(`[Redis Cache] Failed to get ${key}:`, err);
    return null;
  }
}

/**
 * Set cached item in Upstash Redis with TTL (default 1 hour = 3600s)
 */
export async function setCachedData<T>(
  key: string,
  value: T,
  ttlSeconds: number = 3600
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn(`[Redis Cache] Failed to set ${key}:`, err);
  }
}

/**
 * Invalidate one or multiple cached items in Upstash Redis
 */
export async function invalidateCachedData(keys: string | string[]): Promise<void> {
  const keyList = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (keyList.length === 0) return;
  try {
    await Promise.all(keyList.map((k) => redis.del(k)));
  } catch (err) {
    console.warn(`[Redis Cache] Failed to invalidate keys:`, err);
  }
}
