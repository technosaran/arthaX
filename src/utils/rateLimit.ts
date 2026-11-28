import { redis, isRedisConfigured } from "@/utils/redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds when the window resets
}

// In-memory fallback map for environments without Redis or during Redis network blips
const MAX_MEMORY_ENTRIES = 10_000;
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function pruneMemoryStoreIfNeeded(now: number): void {
  if (inMemoryStore.size < MAX_MEMORY_ENTRIES) return;
  for (const [k, v] of inMemoryStore.entries()) {
    if (v.resetAt <= now) {
      inMemoryStore.delete(k);
    }
  }
  while (inMemoryStore.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = inMemoryStore.keys().next().value;
    if (!oldestKey) break;
    inMemoryStore.delete(oldestKey);
  }
}

// Periodic in-memory store cleanup to avoid memory leaks
if (typeof setInterval !== "undefined") {
  (setInterval(() => {
    const now = Date.now();
    for (const [k, v] of inMemoryStore.entries()) {
      if (v.resetAt <= now) {
        inMemoryStore.delete(k);
      }
    }
  }, 60000) as { unref?: () => void }).unref?.();
}

/**
 * Universal Distributed Rate Limiter
 * Uses Upstash Redis when configured, with seamless in-memory sliding window fallback.
 *
 * @param identifier Unique key (e.g., ip:endpoint or user_id:action)
 * @param limit Maximum allowed requests within the time window
 * @param windowSeconds Window length in seconds
 */
export async function rateLimit(
  identifier: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetUnix = Math.ceil((now + windowSeconds * 1000) / 1000);

  // 1. Upstash Redis distributed path (pipelined INCR + TTL to prevent orphan keys without expiry)
  if (isRedisConfigured && redis) {
    try {
      const key = `arthax:ratelimit:${identifier}`;
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.ttl(key);
      const [rawCount, rawTtl] = (await pipeline.exec()) as [number, number];
      const current = Number(rawCount) || 1;
      const ttl = Number(rawTtl);

      if (current === 1 || ttl < 0) {
        await redis.expire(key, windowSeconds);
      }

      const effectiveReset = ttl > 0 ? Math.ceil(now / 1000) + ttl : resetUnix;
      const remaining = Math.max(0, limit - current);
      return {
        success: current <= limit,
        limit,
        remaining,
        reset: effectiveReset,
      };
    } catch (err) {
      console.warn(`[RateLimit] Redis error for ${identifier}, falling back to memory:`, err);
    }
  }

  // 2. In-memory fallback path
  const record = inMemoryStore.get(identifier);
  if (!record || record.resetAt <= now) {
    pruneMemoryStoreIfNeeded(now);
    inMemoryStore.set(identifier, { count: 1, resetAt: now + windowSeconds * 1000 });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetUnix,
    };
  }

  record.count += 1;
  const remaining = Math.max(0, limit - record.count);
  return {
    success: record.count <= limit,
    limit,
    remaining,
    reset: Math.ceil(record.resetAt / 1000),
  };
}

/**
 * Atomic Idempotency Guard
 * Returns true if this is the first time the key is seen (claim accepted),
 * or false if this is a duplicate replay within the TTL window.
 */
export async function checkAndSetIdempotency(
  key: string,
  ttlSeconds: number = 86400
): Promise<boolean> {
  if (!key) return true;

  if (isRedisConfigured && redis) {
    try {
      const redisKey = `arthax:idempotency:${key}`;
      // SET key "1" NX EX ttlSeconds -> returns "OK" if set, null if key already exists
      const setSuccess = await redis.set(redisKey, "1", { nx: true, ex: ttlSeconds });
      return Boolean(setSuccess);
    } catch (err) {
      console.warn(`[Idempotency] Redis check failed for ${key}, falling back to memory:`, err);
    }
  }

  const memoryKey = `idemp:${key}`;
  const now = Date.now();
  const existing = inMemoryStore.get(memoryKey);

  if (existing && existing.resetAt > now) {
    return false; // Already processed
  }

  pruneMemoryStoreIfNeeded(now);
  inMemoryStore.set(memoryKey, { count: 1, resetAt: now + ttlSeconds * 1000 });
  return true;
}

/**
 * Releases an idempotency lock when an operation fails with a transient 5xx error
 * so the caller can safely retry without being blocked for the full TTL.
 */
export async function releaseIdempotency(key: string): Promise<void> {
  if (!key) return;
  inMemoryStore.delete(`idemp:${key}`);
  if (isRedisConfigured && redis) {
    try {
      await redis.del(`arthax:idempotency:${key}`);
    } catch {
      // Non-blocking cleanup
    }
  }
}
