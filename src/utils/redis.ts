import { Redis } from "@upstash/redis";

export * from "./cacheKeys";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const isRedisConfigured = Boolean(redisUrl && redisToken);

// Safe initialization: Only create Upstash client if valid credentials exist
export const redis: Redis | null = isRedisConfigured
  ? new Redis({
      url: redisUrl!,
      token: redisToken!,
    })
  : null;

if (typeof window === "undefined" && !isRedisConfigured && process.env.NODE_ENV !== "test") {
  console.warn(
    "[Redis Config] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Redis caching is operating in graceful bypass mode."
  );
}

/**
 * Get cached item from Upstash Redis with timeout fallback (max 1000ms)
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  if (!key || !redis) return null;
  try {
    const fetchPromise = redis.get<T>(key);
    fetchPromise.catch(() => {});
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1000)
    );
    const data = await Promise.race([fetchPromise, timeoutPromise]);
    return data ?? null;
  } catch (err) {
    console.warn(`[Redis Cache] Failed to get ${key}:`, err);
    return null;
  }
}

/**
 * Set cached item in Upstash Redis with TTL (default 1 hour = 3600s) with timeout safeguard
 */
export async function setCachedData<T>(
  key: string,
  value: T,
  ttlSeconds: number = 3600
): Promise<void> {
  if (!key || value === undefined || !redis) return;
  try {
    const setPromise = redis.set(key, value, { ex: ttlSeconds });
    setPromise.catch(() => {});
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(() => resolve(), 1200)
    );
    await Promise.race([setPromise, timeoutPromise]);
  } catch (err) {
    console.warn(`[Redis Cache] Failed to set ${key}:`, err);
  }
}

/**
 * Invalidate one or multiple cached items in Upstash Redis with timeout safeguard
 */
export async function invalidateCachedData(keys: string | string[]): Promise<void> {
  if (!redis) return;
  const keyList = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (keyList.length === 0) return;
  try {
    const delPromise = Promise.all(keyList.map((k) => redis!.del(k)));
    delPromise.catch(() => {});
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(() => resolve(), 1500)
    );
    await Promise.race([delPromise, timeoutPromise]);
  } catch (err) {
    console.warn(`[Redis Cache] Failed to invalidate keys:`, err);
  }
}
